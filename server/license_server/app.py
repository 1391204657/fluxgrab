# -*- coding: utf-8 -*-
"""FluxGrab License Server — Stripe webhook + Pro license keys."""

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
import urllib.request
import uuid
from email.message import EmailMessage
from pathlib import Path

from flask import Flask, jsonify, request

APP = Flask(__name__)

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
DB_PATH = DATA_DIR / "licenses.db"
ACTIVATION_LIMIT = int(os.environ.get("ACTIVATION_LIMIT", "3"))
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
STRIPE_PRODUCT_NAME = os.environ.get("STRIPE_PRODUCT_NAME", "FluxGrab Pro").strip()

SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("SMTP_PASS", "").strip()
SMTP_FROM = os.environ.get("SMTP_FROM", "FluxGrab <support@fluxgrab.com>").strip()

LEMON_API_KEY = os.environ.get("LEMONSQUEEZY_API_KEY", "").strip()
LEMON_WEBHOOK_SECRET = os.environ.get("LEMONSQUEEZY_WEBHOOK_SECRET", "").strip()
LEMON_API_BASE = "https://api.lemonsqueezy.com/v1"

DB_LOCK = threading.Lock()


def _conn():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with DB_LOCK:
        conn = _conn()
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS licenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL,
                stripe_session_id TEXT UNIQUE,
                status TEXT NOT NULL DEFAULT 'active',
                activation_limit INTEGER NOT NULL DEFAULT 3,
                created_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS activations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                license_key TEXT NOT NULL,
                instance_id TEXT NOT NULL UNIQUE,
                instance_name TEXT NOT NULL,
                created_at REAL NOT NULL,
                UNIQUE(license_key, instance_name)
            );
            CREATE INDEX IF NOT EXISTS idx_activations_key ON activations(license_key);
            """
        )
        conn.commit()
        conn.close()


def _now():
    return time.time()


def _gen_key() -> str:
    parts = [secrets.token_hex(2).upper() for _ in range(4)]
    return "FG-" + "-".join(parts)


def _license_row(key: str):
    conn = _conn()
    row = conn.execute(
        "SELECT * FROM licenses WHERE license_key = ? AND status = 'active'",
        (key,),
    ).fetchone()
    conn.close()
    return row


def _activation_count(key: str) -> int:
    conn = _conn()
    n = conn.execute(
        "SELECT COUNT(*) AS c FROM activations WHERE license_key = ?",
        (key,),
    ).fetchone()["c"]
    conn.close()
    return int(n)


def _license_meta(key: str, row) -> dict:
    limit = int(row["activation_limit"] or ACTIVATION_LIMIT)
    usage = _activation_count(key)
    return {
        "status": row["status"],
        "activation_limit": limit,
        "activation_usage": usage,
    }


def _send_license_email(email: str, license_key: str) -> bool:
    if not SMTP_HOST:
        APP.logger.warning("SMTP not configured; license for %s: %s", email, license_key)
        return False
    msg = EmailMessage()
    msg["Subject"] = "Your FluxGrab Pro license key"
    msg["From"] = SMTP_FROM
    msg["To"] = email
    msg.set_content(
        "Thank you for purchasing FluxGrab Pro!\n\n"
        f"Your license key:\n\n{license_key}\n\n"
        "How to activate:\n"
        "1. Open FluxGrab desktop app\n"
        "2. Paste the key in the license box\n"
        "3. Click Activate Pro\n\n"
        "Need help? Reply to support@fluxgrab.com\n\n"
        "— FluxGrab Team\nhttps://fluxgrab.com\n"
    )
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
            smtp.starttls()
            if SMTP_USER:
                smtp.login(SMTP_USER, SMTP_PASS)
            smtp.send_message(msg)
        return True
    except Exception as exc:
        APP.logger.exception("Email failed: %s", exc)
        return False


def _issue_license(email: str, stripe_session_id: str) -> str | None:
    email = (email or "").strip().lower()
    if not email:
        return None
    with DB_LOCK:
        conn = _conn()
        existing = conn.execute(
            "SELECT license_key FROM licenses WHERE stripe_session_id = ?",
            (stripe_session_id,),
        ).fetchone()
        if existing:
            conn.close()
            return existing["license_key"]
        for _ in range(8):
            key = _gen_key()
            try:
                conn.execute(
                    "INSERT INTO licenses (license_key, email, stripe_session_id, activation_limit, created_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (key, email, stripe_session_id, ACTIVATION_LIMIT, _now()),
                )
                conn.commit()
                conn.close()
                return key
            except sqlite3.IntegrityError:
                continue
        conn.close()
    return None


def _verify_stripe_sig(payload: bytes) -> dict | None:
    if not STRIPE_WEBHOOK_SECRET:
        APP.logger.error("STRIPE_WEBHOOK_SECRET not set")
        return None
    sig = request.headers.get("Stripe-Signature", "")
    parts = {}
    for item in sig.split(","):
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


@APP.route("/health")
def health():
    return jsonify({"ok": True, "service": "fluxgrab-license"})


@APP.route("/v1/licenses/activate", methods=["POST"])
def activate():
    if request.is_json:
        data = request.get_json(silent=True) or {}
        key = (data.get("license_key") or "").strip().upper()
        name = (data.get("instance_name") or "").strip() or "FluxGrab"
    else:
        key = (request.form.get("license_key") or "").strip().upper()
        name = (request.form.get("instance_name") or "").strip() or "FluxGrab"
    if not key:
        return jsonify({"error": "Missing license_key"}), 400
    row = _license_row(key)
    if not row:
        return jsonify({"error": "Invalid license key."}), 400
    limit = int(row["activation_limit"] or ACTIVATION_LIMIT)
    usage = _activation_count(key)
    conn = _conn()
    existing = conn.execute(
        "SELECT instance_id FROM activations WHERE license_key = ? AND instance_name = ?",
        (key, name),
    ).fetchone()
    if existing:
        instance_id = existing["instance_id"]
        conn.close()
        return jsonify(
            {
                "activated": True,
                "instance": {"id": instance_id, "name": name},
                "license_key": _license_meta(key, row),
            }
        )
    if usage >= limit:
        conn.close()
        return jsonify({"error": f"Activation limit reached ({limit} devices)."}), 400
    instance_id = uuid.uuid4().hex
    conn.execute(
        "INSERT INTO activations (license_key, instance_id, instance_name, created_at) VALUES (?, ?, ?, ?)",
        (key, instance_id, name, _now()),
    )
    conn.commit()
    conn.close()
    row = _license_row(key)
    return jsonify(
        {
            "activated": True,
            "instance": {"id": instance_id, "name": name},
            "license_key": _license_meta(key, row),
        }
    )


@APP.route("/v1/licenses/validate", methods=["POST"])
def validate():
    key = (request.form.get("license_key") or "").strip().upper()
    instance_id = (request.form.get("instance_id") or "").strip()
    if not key or not instance_id:
        return jsonify({"valid": False, "error": "Missing fields"}), 400
    row = _license_row(key)
    if not row:
        return jsonify({"valid": False}), 200
    conn = _conn()
    inst = conn.execute(
        "SELECT 1 FROM activations WHERE license_key = ? AND instance_id = ?",
        (key, instance_id),
    ).fetchone()
    conn.close()
    valid = inst is not None
    return jsonify(
        {
            "valid": valid,
            "license_key": _license_meta(key, row) if valid else {"status": "inactive"},
        }
    )


@APP.route("/webhook/stripe", methods=["POST"])
def stripe_webhook():
    payload = request.get_data()
    event = _verify_stripe_sig(payload)
    if event is None:
        return jsonify({"error": "Invalid signature"}), 400
    etype = event.get("type")
    if etype == "checkout.session.completed":
        session = event.get("data", {}).get("object", {})
        if session.get("payment_status") not in (None, "paid", "no_payment_required"):
            return jsonify({"ok": True, "skipped": "unpaid"})
        email = (
            session.get("customer_details", {}).get("email")
            or session.get("customer_email")
            or ""
        )
        sid = session.get("id") or ""
        key = _issue_license(email, sid)
        if key:
            _send_license_email(email, key)
            APP.logger.info("Issued license for %s session %s", email, sid)
    return jsonify({"ok": True})


def _verify_lemon_sig(raw: bytes) -> bool:
    if not LEMON_WEBHOOK_SECRET:
        APP.logger.error("LEMONSQUEEZY_WEBHOOK_SECRET not set")
        return False
    sent = request.headers.get("X-Signature", "")
    digest = hmac.new(
        LEMON_WEBHOOK_SECRET.encode(),
        raw,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(digest, sent)


def _lemon_request(method: str, path: str, payload: dict | None = None) -> dict:
    if not LEMON_API_KEY:
        raise RuntimeError("LEMONSQUEEZY_API_KEY not set")
    url = f"{LEMON_API_BASE}{path}"
    headers = {
        "Accept": "application/vnd.api+json",
        "Authorization": f"Bearer {LEMON_API_KEY}",
    }
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/vnd.api+json"
        body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Lemon API {exc.code}: {detail}") from exc


def _disable_license_key(license_id: str) -> None:
    _lemon_request(
        "PATCH",
        f"/license-keys/{license_id}",
        {
            "data": {
                "type": "license-keys",
                "id": str(license_id),
                "attributes": {"disabled": True},
            }
        },
    )


def _license_ids_for_order(order_id: str) -> list[str]:
    data = _lemon_request("GET", f"/license-keys?filter[order_id]={order_id}")
    ids = []
    for item in data.get("data") or []:
        lid = item.get("id")
        if lid is not None:
            ids.append(str(lid))
    return ids


def _order_fully_refunded(order: dict) -> bool:
    attrs = order.get("attributes") or {}
    if attrs.get("refunded") is True:
        return True
    total = int(attrs.get("total") or 0)
    refunded = int(attrs.get("refunded_amount") or 0)
    return total > 0 and refunded >= total


@APP.route("/webhook/lemon", methods=["POST"])
def lemon_webhook():
    raw = request.get_data()
    if not _verify_lemon_sig(raw):
        return jsonify({"error": "Invalid signature"}), 400
    try:
        body = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        return jsonify({"error": "Bad JSON"}), 400

    event = (body.get("meta") or {}).get("event_name") or ""
    if event != "order_refunded":
        return jsonify({"ok": True, "skipped": event or "unknown"})

    order = (body.get("data") or {})
    order_id = str(order.get("id") or "")
    if not order_id:
        return jsonify({"error": "Missing order id"}), 400

    if not _order_fully_refunded(order):
        APP.logger.info("Partial refund for order %s — license kept active", order_id)
        return jsonify({"ok": True, "partial": True})

    if not LEMON_API_KEY:
        APP.logger.error("Refund for order %s but LEMONSQUEEZY_API_KEY missing", order_id)
        return jsonify({"error": "API key not configured"}), 500

    disabled = []
    errors = []
    for lid in _license_ids_for_order(order_id):
        try:
            _disable_license_key(lid)
            disabled.append(lid)
        except RuntimeError as exc:
            errors.append({"id": lid, "error": str(exc)})
            APP.logger.exception("Failed to disable license %s", lid)

    APP.logger.info(
        "order_refunded %s: disabled %s license(s)",
        order_id,
        len(disabled),
    )
    return jsonify({"ok": True, "disabled": disabled, "errors": errors})


init_db()

if __name__ == "__main__":
    APP.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
