# -*- coding: utf-8 -*-
"""Stripe checkout + FluxGrab Pro license keys."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import smtplib
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from email.message import EmailMessage

import db

ACTIVATION_LIMIT = int(os.environ.get("ACTIVATION_LIMIT", "3"))
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
STRIPE_PRICE_ID = os.environ.get("STRIPE_PRICE_ID", "").strip()
SITE_URL = os.environ.get("SITE_URL", "https://fluxgrab.com").strip().rstrip("/")

SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or "587")
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("SMTP_PASS", "").strip()
SMTP_FROM = os.environ.get("SMTP_FROM", "FluxGrab <support@fluxgrab.com>").strip()

DB_LOCK = threading.Lock()


def init_license_tables() -> None:
    with db._conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS licenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL,
                stripe_session_id TEXT UNIQUE,
                stripe_payment_intent TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                activation_limit INTEGER NOT NULL DEFAULT 3,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS activations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT NOT NULL,
                instance_id TEXT NOT NULL UNIQUE,
                instance_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(license_key, instance_name)
            );
            CREATE INDEX IF NOT EXISTS idx_activations_key ON activations(license_key);
            """
        )


def _gen_key() -> str:
    parts = [secrets.token_hex(2).upper() for _ in range(4)]
    return "FG-" + "-".join(parts)


def _license_row(key: str):
    with db._conn() as conn:
        return conn.execute(
            "SELECT * FROM licenses WHERE license_key = ? AND status = 'active'",
            (key,),
        ).fetchone()


def _activation_count(key: str) -> int:
    with db._conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM activations WHERE license_key = ?",
            (key,),
        ).fetchone()
    return int(row["c"] if row else 0)


def license_meta(key: str, row) -> dict:
    limit = int(row["activation_limit"] or ACTIVATION_LIMIT)
    return {
        "status": row["status"],
        "activation_limit": limit,
        "activation_usage": _activation_count(key),
    }


def _send_license_email(email: str, license_key: str, logger) -> bool:
    if not SMTP_HOST:
        logger.warning("SMTP not configured; license for %s: %s", email, license_key)
        return False
    msg = EmailMessage()
    msg["Subject"] = "Your FluxGrab Pro license key"
    msg["From"] = SMTP_FROM
    msg["To"] = email
    msg.set_content(
        "Thank you for purchasing FluxGrab Pro!\n\n"
        f"Your license key:\n\n{license_key}\n\n"
        "How to activate:\n"
        "1. Download FluxGrab from https://fluxgrab.com/#download\n"
        "2. Open the app and paste your license key\n"
        "3. Click Activate Pro\n\n"
        "Need help? Email support@fluxgrab.com\n\n"
        "— FluxGrab Team\nhttps://fluxgrab.com\n"
    )
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
            smtp.starttls()
            if SMTP_USER and SMTP_PASS:
                smtp.login(SMTP_USER, SMTP_PASS)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        logger.exception("License email failed: %s", exc)
        return False


def issue_license(email: str, stripe_session_id: str, payment_intent: str = "") -> str | None:
    email = (email or "").strip().lower()
    if not email or not stripe_session_id:
        return None
    now = db.utc_now().isoformat()
    with DB_LOCK:
        with db._conn() as conn:
            existing = conn.execute(
                "SELECT license_key FROM licenses WHERE stripe_session_id = ?",
                (stripe_session_id,),
            ).fetchone()
            if existing:
                return existing["license_key"]
            for _ in range(8):
                key = _gen_key()
                try:
                    conn.execute(
                        """
                        INSERT INTO licenses (
                            license_key, email, stripe_session_id, stripe_payment_intent,
                            activation_limit, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        """,
                        (
                            key,
                            email,
                            stripe_session_id,
                            payment_intent or None,
                            ACTIVATION_LIMIT,
                            now,
                        ),
                    )
                    return key
                except sqlite3.IntegrityError:
                    continue
    return None


def revoke_license_by_session(stripe_session_id: str) -> bool:
    now = db.utc_now().isoformat()
    with db._conn() as conn:
        cur = conn.execute(
            "UPDATE licenses SET status='revoked' WHERE stripe_session_id=? AND status='active'",
            (stripe_session_id,),
        )
        return cur.rowcount > 0


def revoke_license_by_payment_intent(payment_intent: str) -> bool:
    if not payment_intent:
        return False
    with db._conn() as conn:
        cur = conn.execute(
            "UPDATE licenses SET status='revoked' WHERE stripe_payment_intent=? AND status='active'",
            (payment_intent,),
        )
        return cur.rowcount > 0


def session_id_for_payment_intent(payment_intent: str) -> str:
    if not payment_intent:
        return ""
    with db._conn() as conn:
        row = conn.execute(
            "SELECT stripe_session_id FROM licenses WHERE stripe_payment_intent = ?",
            (payment_intent,),
        ).fetchone()
    return (row["stripe_session_id"] or "") if row else ""


def _stripe_request(method: str, path: str, data: dict | None = None) -> dict:
    if not STRIPE_SECRET_KEY:
        raise RuntimeError("STRIPE_SECRET_KEY not set")
    body = None
    headers = {
        "Authorization": f"Bearer {STRIPE_SECRET_KEY}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    if data is not None:
        body = urllib.parse.urlencode(data, doseq=True).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.stripe.com/v1{path}",
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Stripe API {exc.code}: {detail}") from exc


def create_checkout_session(lang: str = "", method: str = "") -> dict:
    if not STRIPE_PRICE_ID:
        raise RuntimeError("STRIPE_PRICE_ID not set")
    lang_q = f"?lang={urllib.parse.quote(lang)}" if lang and lang != "en" else ""
    success = f"{SITE_URL}/thanks.html{lang_q}"
    cancel = f"{SITE_URL}/premium.html{lang_q}#payment"
    payload = {
        "mode": "payment",
        "success_url": success,
        "cancel_url": cancel,
        "line_items[0][price]": STRIPE_PRICE_ID,
        "line_items[0][quantity]": "1",
        "allow_promotion_codes": "true",
        "billing_address_collection": "auto",
        "customer_creation": "always",
        "metadata[product]": "fluxgrab-pro",
    }
    method = (method or "").strip().lower()
    if method == "wechat":
        payload["payment_method_types[0]"] = "wechat_pay"
        payload["payment_method_options[wechat_pay][client]"] = "web"
    elif method == "alipay":
        payload["payment_method_types[0]"] = "alipay"
    elif method == "card":
        payload["payment_method_types[0]"] = "card"
    elif method == "paypal":
        payload["payment_method_types[0]"] = "paypal"
    # else: omit payment_method_types — Stripe Dashboard dynamic methods (CTA button)
    return _stripe_request("POST", "/checkout/sessions", payload)


def verify_stripe_signature(payload: bytes, sig_header: str) -> dict | None:
    if not STRIPE_WEBHOOK_SECRET:
        return None
    parts = {}
    for item in sig_header.split(","):
        if "=" in item:
            k, v = item.split("=", 1)
            parts[k.strip()] = v.strip()
    timestamp = parts.get("t")
    v1 = parts.get("v1")
    if not timestamp or not v1:
        return None
    signed = timestamp.encode() + b"." + payload
    expected = hmac.new(
        STRIPE_WEBHOOK_SECRET.encode(),
        signed,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, v1):
        return None
    if abs(time.time() - int(timestamp)) > 300:
        return None
    return json.loads(payload.decode("utf-8"))


def activate_license(license_key: str, instance_name: str) -> tuple[dict, int]:
    key = (license_key or "").strip().upper()
    name = (instance_name or "").strip() or "FluxGrab"
    if not key:
        return {"error": "Missing license_key"}, 400
    row = _license_row(key)
    if not row:
        return {"error": "Invalid license key."}, 400
    limit = int(row["activation_limit"] or ACTIVATION_LIMIT)
    usage = _activation_count(key)
    now = db.utc_now().isoformat()
    with db._conn() as conn:
        existing = conn.execute(
            "SELECT instance_id FROM activations WHERE license_key = ? AND instance_name = ?",
            (key, name),
        ).fetchone()
        if existing:
            return {
                "activated": True,
                "instance": {"id": existing["instance_id"], "name": name},
                "license_key": license_meta(key, row),
            }, 200
        if usage >= limit:
            return {"error": f"Activation limit reached ({limit} devices)."}, 400
        instance_id = uuid.uuid4().hex
        conn.execute(
            "INSERT INTO activations (license_key, instance_id, instance_name, created_at) VALUES (?, ?, ?, ?)",
            (key, instance_id, name, now),
        )
    row = _license_row(key)
    return {
        "activated": True,
        "instance": {"id": instance_id, "name": name},
        "license_key": license_meta(key, row),
    }, 200


def validate_license(license_key: str, instance_id: str) -> dict:
    key = (license_key or "").strip().upper()
    iid = (instance_id or "").strip()
    if not key or not iid:
        return {"valid": False, "error": "Missing fields"}
    row = _license_row(key)
    if not row:
        return {"valid": False}
    with db._conn() as conn:
        inst = conn.execute(
            "SELECT 1 FROM activations WHERE license_key = ? AND instance_id = ?",
            (key, iid),
        ).fetchone()
    valid = inst is not None
    return {
        "valid": valid,
        "license_key": license_meta(key, row) if valid else {"status": "inactive"},
    }


def handle_stripe_event(event: dict, logger) -> dict:
    etype = event.get("type")
    if etype == "checkout.session.completed":
        session = event.get("data", {}).get("object", {}) or {}
        if session.get("payment_status") not in (None, "paid", "no_payment_required"):
            return {"ok": True, "skipped": "unpaid"}
        email = (
            (session.get("customer_details") or {}).get("email")
            or session.get("customer_email")
            or ""
        )
        sid = session.get("id") or ""
        pi = session.get("payment_intent") or ""
        amount = int(session.get("amount_total") or 0)
        currency = (session.get("currency") or "usd").upper()
        key = issue_license(email, sid, str(pi) if pi else "")
        if key:
            _send_license_email(email, key, logger)
            db.upsert_order_paid(
                order_id=sid,
                email=email,
                amount=amount,
                currency=currency,
                test_mode=not bool(session.get("livemode")),
            )
            db.insert_event(
                event="order_paid",
                meta={"order_id": sid, "amount": amount, "provider": "stripe"},
                visitor="stripe",
            )
            logger.info("stripe checkout completed %s", sid)
        return {"ok": True, "issued": bool(key)}

    if etype in ("charge.refunded", "refund.created"):
        obj = event.get("data", {}).get("object", {}) or {}
        pi = obj.get("payment_intent") or ""
        if isinstance(pi, dict):
            pi = pi.get("id") or ""
        pi = str(pi or "")
        revoked = revoke_license_by_payment_intent(pi)
        sid = session_id_for_payment_intent(pi)
        if sid:
            db.mark_order_refunded(sid)
        db.insert_event(
            event="order_refunded",
            meta={"payment_intent": pi, "session_id": sid, "provider": "stripe"},
            visitor="stripe",
        )
        return {"ok": True, "revoked": revoked}

    return {"ok": True, "skipped": etype or "unknown"}
