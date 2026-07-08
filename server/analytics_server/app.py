# -*- coding: utf-8 -*-
"""FluxGrab analytics API, admin dashboard, Stripe licenses, and Lemon webhooks."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import smtplib
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage

from flask import (
    Flask,
    Response,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)

import db
import licenses

APP = Flask(__name__)
APP.secret_key = os.environ.get("FLUXGRAB_SECRET", "change-me-in-production")

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "").strip()
LEMON_API_KEY = os.environ.get("LEMONSQUEEZY_API_KEY", "").strip()
LEMON_WEBHOOK_SECRET = os.environ.get("LEMONSQUEEZY_WEBHOOK_SECRET", "").strip()
LEMON_API_BASE = "https://api.lemonsqueezy.com/v1"
IP_SALT = os.environ.get("IP_SALT", "fluxgrab")
ALLOWED_ORIGINS = {
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS",
        "https://fluxgrab.com,https://www.fluxgrab.com",
    ).split(",")
    if o.strip()
}
FEEDBACK_NOTIFY_EMAIL = os.environ.get("FEEDBACK_NOTIFY_EMAIL", "").strip()
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or "587")
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("SMTP_PASS", "").strip()
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER or "noreply@fluxgrab.com").strip()

db.init_db()
licenses.init_license_tables()


def _visitor_id() -> str:
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    ip = ip.split(",")[0].strip()
    ua = request.headers.get("User-Agent", "")[:120]
    return hashlib.sha256(f"{IP_SALT}:{ip}:{ua}".encode()).hexdigest()[:20]


def _cors(resp: Response) -> Response:
    origin = request.headers.get("Origin", "")
    if origin in ALLOWED_ORIGINS:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Vary"] = "Origin"
    return resp


def _notify_feedback_email(email: str, message: str, path: str) -> None:
    """Optional: email new feedback when SMTP + FEEDBACK_NOTIFY_EMAIL are set."""
    if not FEEDBACK_NOTIFY_EMAIL or not SMTP_HOST:
        return
    try:
        msg = EmailMessage()
        msg["Subject"] = "FluxGrab feedback"
        msg["From"] = SMTP_FROM
        msg["To"] = FEEDBACK_NOTIFY_EMAIL
        if email:
            msg["Reply-To"] = email
        body = f"From: {email or '(no email)'}\nPage: {path or '/'}\n\n{message}"
        msg.set_content(body)
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if SMTP_USER and SMTP_PASS:
                smtp.login(SMTP_USER, SMTP_PASS)
            smtp.send_message(msg)
    except Exception as exc:
        APP.logger.warning("feedback email failed: %s", exc)


def _verify_lemon_sig(raw: bytes) -> bool:
    if not LEMON_WEBHOOK_SECRET:
        APP.logger.error("LEMONSQUEEZY_WEBHOOK_SECRET not set")
        return False
    sent = request.headers.get("X-Signature", "")
    digest = hmac.new(
        LEMON_WEBHOOK_SECRET.encode(), raw, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(digest, sent)


def _lemon_request(method: str, path: str, payload: dict | None = None) -> dict:
    if not LEMON_API_KEY:
        raise RuntimeError("LEMONSQUEEZY_API_KEY not set")
    headers = {
        "Accept": "application/vnd.api+json",
        "Authorization": f"Bearer {LEMON_API_KEY}",
    }
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/vnd.api+json"
        body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{LEMON_API_BASE}{path}", data=body, headers=headers, method=method
    )
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
    return [str(i["id"]) for i in (data.get("data") or []) if i.get("id") is not None]


def _order_fully_refunded(order: dict) -> bool:
    attrs = order.get("attributes") or {}
    if attrs.get("refunded") is True:
        return True
    total = int(attrs.get("total") or 0)
    refunded = int(attrs.get("refunded_amount") or 0)
    return total > 0 and refunded >= total


def _fmt_money(cents: int, currency: str = "USD") -> str:
    return f"{currency} {cents / 100:.2f}"


@APP.route("/health")
def health():
    return jsonify({"ok": True, "service": "fluxgrab-analytics"})


@APP.route("/v1/ads", methods=["GET", "OPTIONS"])
def public_ads():
    """Affiliate URLs served from API (single source of truth on the server)."""
    if request.method == "OPTIONS":
        return _cors(Response("", 204))
    return _cors(
        jsonify(
            {
                "vpn_url": "https://go.nordvpn.net/aff_c?offer_id=15&aff_id=152040&aff_sub=fluxgrab",
                "vpn_name": "NordVPN",
            }
        )
    )


@APP.route("/v1/preview", methods=["GET", "OPTIONS"])
def link_preview():
    """Server-side oEmbed/noembed fetch for web preview cards (avoids browser CORS)."""
    if request.method == "OPTIONS":
        return _cors(Response("", 204))

    page_url = (request.args.get("url") or "").strip()
    if not page_url:
        return _cors(jsonify({"error": "missing url"})), 400

    host = urllib.parse.urlparse(page_url).netloc.lower().replace("www.", "")
    if host == "x.com" or "twitter.com" in host:
        page_url = page_url.replace("://x.com", "://twitter.com").split("/video/")[0]

    endpoints = [
        "https://noembed.com/embed?url="
        + urllib.parse.quote(page_url, safe=""),
    ]
    if host == "x.com" or "twitter.com" in host:
        endpoints.insert(
            0,
            "https://publish.twitter.com/oembed?url="
            + urllib.parse.quote(page_url, safe=""),
        )

    title = ""
    thumb = ""
    for ep in endpoints:
        try:
            req = urllib.request.Request(
                ep, headers={"User-Agent": "FluxGrab/1.0 (+https://fluxgrab.com)"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            continue
        if data.get("error"):
            continue
        title = title or data.get("title") or data.get("author_name") or ""
        thumb = thumb or data.get("thumbnail_url") or data.get("thumbnail_url_with_play_button") or ""
        if not thumb and data.get("html"):
            m = re.search(r"https://pbs\.twimg\.com/[^\"'\s]+", data["html"])
            if m:
                thumb = m.group(0)
        if thumb or title:
            break

    return _cors(jsonify({"title": title, "thumb": thumb}))


@APP.route("/v1/events", methods=["POST", "OPTIONS"])
def ingest_event():
    if request.method == "OPTIONS":
        return _cors(Response("", 204))

    data = request.get_json(silent=True) or {}
    event = (data.get("event") or "").strip()[:64]
    if not event:
        return _cors(jsonify({"error": "missing event"})), 400

    allowed = {
        "pageview",
        "download_win",
        "parse_start",
        "parse_ok",
        "parse_fail",
        "ad_impression",
        "ad_click",
        "buy_click",
        "feedback",
    }
    if event not in allowed:
        return _cors(jsonify({"error": "invalid event"})), 400

    path = (data.get("path") or "")[:500]
    referrer = (data.get("referrer") or "")[:500]
    lang = (data.get("lang") or "")[:32]
    meta = data.get("meta") if isinstance(data.get("meta"), dict) else {}

    ua = request.headers.get("User-Agent", "")[:500]

    if event == "feedback":
        message = (meta.get("message") or data.get("message") or "").strip()
        if len(message) < 3:
            return _cors(jsonify({"error": "message too short"})), 400
        email = meta.get("email") or data.get("email") or ""
        db.insert_feedback(email, message, path)
        db.insert_event(
            event="feedback",
            path=path,
            referrer=referrer,
            lang=lang,
            meta={"email": email},
            visitor=_visitor_id(),
            user_agent=ua,
        )
        _notify_feedback_email(email, message, path)
        return _cors(jsonify({"ok": True}))

    db.insert_event(
        event=event,
        path=path,
        referrer=referrer,
        lang=lang,
        meta=meta,
        visitor=_visitor_id(),
        user_agent=ua,
    )
    return _cors(jsonify({"ok": True}))


@APP.route("/v1/checkout/session", methods=["POST", "OPTIONS"])
def checkout_session():
    if request.method == "OPTIONS":
        return _cors(Response("", 204))
    data = request.get_json(silent=True) or {}
    lang = (data.get("lang") or "")[:16]
    try:
        session_data = licenses.create_checkout_session(lang=lang)
    except RuntimeError as exc:
        APP.logger.exception("checkout session failed")
        return _cors(jsonify({"error": str(exc)})), 503
    url = session_data.get("url") or ""
    if not url:
        return _cors(jsonify({"error": "No checkout URL"})), 502
    return _cors(jsonify({"url": url, "id": session_data.get("id")}))


@APP.route("/v1/licenses/activate", methods=["POST"])
def license_activate():
    data = request.get_json(silent=True) or {}
    body, code = licenses.activate_license(
        data.get("license_key") or data.get("licenseKey") or "",
        data.get("instance_name") or data.get("instanceName") or "",
    )
    return jsonify(body), code


@APP.route("/v1/licenses/validate", methods=["POST"])
def license_validate():
    data = request.get_json(silent=True) or {}
    body = licenses.validate_license(
        data.get("license_key") or data.get("licenseKey") or "",
        data.get("instance_id") or data.get("instanceId") or "",
    )
    return jsonify(body)


@APP.route("/webhook/stripe", methods=["POST"])
def stripe_webhook():
    raw = request.get_data()
    sig = request.headers.get("Stripe-Signature", "")
    event = licenses.verify_stripe_signature(raw, sig)
    if not event:
        return jsonify({"error": "Invalid signature"}), 400
    result = licenses.handle_stripe_event(event, APP.logger)
    return jsonify(result)


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
    order = body.get("data") or {}
    order_id = str(order.get("id") or "")
    attrs = order.get("attributes") or {}

    if event == "order_created":
        if not order_id:
            return jsonify({"error": "Missing order id"}), 400
        db.upsert_order_paid(
            order_id=order_id,
            email=(attrs.get("user_email") or attrs.get("customer_email") or ""),
            amount=int(attrs.get("total") or 0),
            currency=(attrs.get("currency") or "USD").upper(),
            test_mode=bool(attrs.get("test_mode")),
        )
        db.insert_event(
            event="order_paid",
            meta={"order_id": order_id, "amount": int(attrs.get("total") or 0)},
            visitor="lemon",
        )
        APP.logger.info("order_created %s", order_id)
        return jsonify({"ok": True, "recorded": order_id})

    if event == "order_refunded":
        if not order_id:
            return jsonify({"error": "Missing order id"}), 400
        db.mark_order_refunded(order_id)
        db.insert_event(event="order_refunded", meta={"order_id": order_id}, visitor="lemon")

        disabled, errors = [], []
        if _order_fully_refunded(order):
            for lid in _license_ids_for_order(order_id):
                try:
                    _disable_license_key(lid)
                    disabled.append(lid)
                except RuntimeError as exc:
                    errors.append({"id": lid, "error": str(exc)})
                    APP.logger.exception("disable %s failed", lid)
        APP.logger.info("order_refunded %s disabled=%s", order_id, disabled)
        return jsonify({"ok": True, "disabled": disabled, "errors": errors})

    return jsonify({"ok": True, "skipped": event or "unknown"})


def _admin_required():
    if not ADMIN_PASSWORD:
        return "Admin password not configured on server."
    if session.get("admin"):
        return None
    return redirect(url_for("admin_login"))


@APP.route("/admin/static/<path:filename>")
def admin_static(filename):
    return send_from_directory("static", filename)


@APP.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if not ADMIN_PASSWORD:
        return render_template("login.html", error="Server: set ADMIN_PASSWORD in .env")
    if request.method == "POST":
        if request.form.get("password") == ADMIN_PASSWORD:
            session["admin"] = True
            return redirect(url_for("admin_dashboard"))
        return render_template("login.html", error="密码错误")
    return render_template("login.html", error="")


@APP.route("/admin/logout")
def admin_logout():
    session.pop("admin", None)
    return redirect(url_for("admin_login"))


@APP.route("/admin/")
@APP.route("/admin")
def admin_dashboard():
    gate = _admin_required()
    if gate:
        return gate
    stats = db.dashboard_stats()
    stats["revenue_paid_fmt"] = _fmt_money(stats["revenue"]["paid_cents"])
    stats["revenue_refunded_fmt"] = _fmt_money(stats["revenue"]["refunded_cents"])
    for o in stats["recent_orders"]:
        o["amount_fmt"] = _fmt_money(int(o["amount"]), o.get("currency") or "USD")
    return render_template("dashboard.html", s=stats)


@APP.route("/admin/feedback", methods=["GET", "POST"])
def admin_feedback():
    gate = _admin_required()
    if gate:
        return gate

    if request.method == "POST":
        fid = request.form.get("id", type=int)
        action = (request.form.get("action") or "").strip()
        if fid and action in ("new", "in_progress", "resolved"):
            db.update_feedback(fid, status=action)
        elif fid and action == "save_note":
            db.update_feedback(fid, admin_note=(request.form.get("admin_note") or "")[:2000])
        status_filter = request.form.get("status") or request.args.get("status")
        return redirect(url_for("admin_feedback", status=status_filter or None))

    status_filter = request.args.get("status")
    items = db.list_feedback(status=status_filter or None, limit=200)
    return render_template(
        "feedback.html",
        items=items,
        status_filter=status_filter or "",
        open_count=db.feedback_open_count(),
    )


if __name__ == "__main__":
    APP.run(host="0.0.0.0", port=8090, debug=True)
