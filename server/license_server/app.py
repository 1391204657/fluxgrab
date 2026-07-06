# -*- coding: utf-8 -*-
"""Lemon Squeezy webhook: disable license keys on full refund."""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request

from flask import Flask, jsonify, request

APP = Flask(__name__)

LEMON_API_KEY = os.environ.get("LEMONSQUEEZY_API_KEY", "").strip()
LEMON_WEBHOOK_SECRET = os.environ.get("LEMONSQUEEZY_WEBHOOK_SECRET", "").strip()
LEMON_API_BASE = "https://api.lemonsqueezy.com/v1"


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


@APP.route("/health")
def health():
    return jsonify({"ok": True, "service": "fluxgrab-lemon-webhook"})


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

    order = body.get("data") or {}
    order_id = str(order.get("id") or "")
    if not order_id:
        return jsonify({"error": "Missing order id"}), 400

    if not _order_fully_refunded(order):
        return jsonify({"ok": True, "partial": True})

    disabled, errors = [], []
    for lid in _license_ids_for_order(order_id):
        try:
            _disable_license_key(lid)
            disabled.append(lid)
        except RuntimeError as exc:
            errors.append({"id": lid, "error": str(exc)})
            APP.logger.exception("disable %s failed", lid)

    APP.logger.info("order_refunded %s disabled=%s", order_id, disabled)
    return jsonify({"ok": True, "disabled": disabled, "errors": errors})


if __name__ == "__main__":
    APP.run(host="0.0.0.0", port=8080)
