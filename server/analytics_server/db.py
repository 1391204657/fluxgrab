# -*- coding: utf-8 -*-
"""SQLite storage for FluxGrab analytics."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
DB_PATH = DATA_DIR / "analytics.db"


def _conn() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                day TEXT NOT NULL,
                event TEXT NOT NULL,
                path TEXT,
                referrer TEXT,
                source TEXT,
                lang TEXT,
                meta TEXT,
                visitor TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_events_day ON events(day);
            CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL UNIQUE,
                email TEXT,
                amount INTEGER NOT NULL DEFAULT 0,
                currency TEXT NOT NULL DEFAULT 'USD',
                status TEXT NOT NULL DEFAULT 'paid',
                test_mode INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                refunded_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ts TEXT NOT NULL,
                email TEXT,
                message TEXT NOT NULL,
                path TEXT,
                status TEXT NOT NULL DEFAULT 'new',
                admin_note TEXT NOT NULL DEFAULT ''
            );
            """
        )
        _migrate_feedback(conn)


def _migrate_feedback(conn) -> None:
    cols = {row[1] for row in conn.execute("PRAGMA table_info(feedback)").fetchall()}
    if "status" not in cols:
        conn.execute(
            "ALTER TABLE feedback ADD COLUMN status TEXT NOT NULL DEFAULT 'new'"
        )
    if "admin_note" not in cols:
        conn.execute(
            "ALTER TABLE feedback ADD COLUMN admin_note TEXT NOT NULL DEFAULT ''"
        )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def today_key() -> str:
    return utc_now().date().isoformat()


def parse_source(referrer: str, user_agent: str = "") -> str:
    if referrer:
        try:
            host = (urlparse(referrer).hostname or "").lower()
        except Exception:
            return "other"
        if not host:
            pass
        elif "google." in host:
            return "google"
        elif "bing." in host:
            return "bing"
        elif "baidu." in host:
            return "baidu"
        elif host in ("t.co",) or "twitter." in host or "x.com" in host:
            return "twitter"
        elif "facebook." in host or "fb." in host:
            return "facebook"
        elif "youtube." in host:
            return "youtube"
        elif "reddit." in host:
            return "reddit"
        elif "fluxgrab.com" in host:
            return "fluxgrab"
        else:
            return host

    ua = (user_agent or "").lower()
    if "micromessenger" in ua:
        return "wechat"
    if "telegram" in ua:
        return "telegram"
    if "whatsapp" in ua:
        return "whatsapp"
    if "fbav" in ua or "fban" in ua or "fbios" in ua:
        return "facebook_app"
    if "twitter" in ua:
        return "twitter_app"
    if "linkedin" in ua:
        return "linkedin"
    if "discord" in ua:
        return "discord"
    if "line/" in ua:
        return "line"
    if "qq/" in ua:
        return "qq"
    return "direct"


def insert_event(
    *,
    event: str,
    path: str = "",
    referrer: str = "",
    lang: str = "",
    meta: dict | None = None,
    visitor: str = "",
    user_agent: str = "",
) -> None:
    now = utc_now().isoformat()
    day = today_key()
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO events (ts, day, event, path, referrer, source, lang, meta, visitor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now,
                day,
                event,
                path or "",
                referrer or "",
                parse_source(referrer or "", user_agent),
                lang or "",
                json.dumps(meta or {}, ensure_ascii=False),
                visitor or "",
            ),
        )


def upsert_order_paid(
    *,
    order_id: str,
    email: str,
    amount: int,
    currency: str,
    test_mode: bool,
) -> None:
    now = utc_now().isoformat()
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO orders (order_id, email, amount, currency, status, test_mode, created_at)
            VALUES (?, ?, ?, ?, 'paid', ?, ?)
            ON CONFLICT(order_id) DO UPDATE SET
                email=excluded.email,
                amount=excluded.amount,
                currency=excluded.currency,
                status='paid',
                test_mode=excluded.test_mode
            """,
            (order_id, email, amount, currency, 1 if test_mode else 0, now),
        )


def mark_order_refunded(order_id: str) -> None:
    now = utc_now().isoformat()
    with _conn() as conn:
        conn.execute(
            """
            UPDATE orders SET status='refunded', refunded_at=?
            WHERE order_id=?
            """,
            (now, order_id),
        )


def insert_feedback(email: str, message: str, path: str = "") -> int:
    with _conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO feedback (ts, email, message, path, status, admin_note)
            VALUES (?, ?, ?, ?, 'new', '')
            """,
            (utc_now().isoformat(), email or "", message, path or ""),
        )
        return int(cur.lastrowid)


def list_feedback(*, status: str | None = None, limit: int = 100) -> list[dict]:
    with _conn() as conn:
        if status:
            rows = conn.execute(
                """
                SELECT id, ts, email, message, path, status, admin_note
                FROM feedback WHERE status=?
                ORDER BY id DESC LIMIT ?
                """,
                (status, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, ts, email, message, path, status, admin_note
                FROM feedback ORDER BY id DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()
    return [dict(r) for r in rows]


def feedback_open_count() -> int:
    with _conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM feedback WHERE status != 'resolved'"
        ).fetchone()
    return int(row["c"] if row else 0)


def update_feedback(
    feedback_id: int,
    *,
    status: str | None = None,
    admin_note: str | None = None,
) -> bool:
    fields: list[str] = []
    values: list[object] = []
    if status is not None:
        fields.append("status=?")
        values.append(status)
    if admin_note is not None:
        fields.append("admin_note=?")
        values.append(admin_note)
    if not fields:
        return False
    values.append(feedback_id)
    with _conn() as conn:
        cur = conn.execute(
            f"UPDATE feedback SET {', '.join(fields)} WHERE id=?",
            values,
        )
        return cur.rowcount > 0


def _count_events(day: str, event: str | None = None) -> int:
    with _conn() as conn:
        if event:
            row = conn.execute(
                "SELECT COUNT(*) AS c FROM events WHERE day=? AND event=?",
                (day, event),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT COUNT(*) AS c FROM events WHERE day=?",
                (day,),
            ).fetchone()
        return int(row["c"] if row else 0)


def _count_unique_visitors(day: str) -> int:
    with _conn() as conn:
        row = conn.execute(
            """
            SELECT COUNT(DISTINCT visitor) AS c FROM events
            WHERE day=? AND event='pageview' AND visitor != ''
            """,
            (day,),
        ).fetchone()
        return int(row["c"] if row else 0)


def revenue_summary(day: str | None = None) -> dict:
    with _conn() as conn:
        if day:
            paid = conn.execute(
                """
                SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS n
                FROM orders WHERE status='paid' AND date(created_at)=?
                """,
                (day,),
            ).fetchone()
            refunded = conn.execute(
                """
                SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS n
                FROM orders WHERE status='refunded' AND date(refunded_at)=?
                """,
                (day,),
            ).fetchone()
        else:
            paid = conn.execute(
                """
                SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS n
                FROM orders WHERE status='paid'
                """
            ).fetchone()
            refunded = conn.execute(
                """
                SELECT COALESCE(SUM(amount),0) AS total, COUNT(*) AS n
                FROM orders WHERE status='refunded'
                """
            ).fetchone()
    return {
        "paid_cents": int(paid["total"] if paid else 0),
        "paid_count": int(paid["n"] if paid else 0),
        "refunded_cents": int(refunded["total"] if refunded else 0),
        "refund_count": int(refunded["n"] if refunded else 0),
    }


def dashboard_stats() -> dict:
    day = today_key()
    rev = revenue_summary(day)
    with _conn() as conn:
        sources = conn.execute(
            """
            SELECT source, COUNT(*) AS c FROM events
            WHERE day=? AND event='pageview'
            GROUP BY source ORDER BY c DESC LIMIT 10
            """,
            (day,),
        ).fetchall()
        recent_events = conn.execute(
            "SELECT ts, event, path, source FROM events ORDER BY id DESC LIMIT 30"
        ).fetchall()
        recent_orders = conn.execute(
            "SELECT order_id, email, amount, currency, status, created_at, test_mode FROM orders ORDER BY id DESC LIMIT 20"
        ).fetchall()
        recent_feedback = conn.execute(
            """
            SELECT id, ts, email, message, path, status, admin_note
            FROM feedback ORDER BY id DESC LIMIT 8
            """
        ).fetchall()
        days = []
        for i in range(6, -1, -1):
            d = (date.today() - timedelta(days=i)).isoformat()
            days.append(
                {
                    "day": d,
                    "pageviews": _count_events(d, "pageview"),
                    "downloads": _count_events(d, "download_win"),
                    "parses": _count_events(d, "parse_ok"),
                }
            )
    return {
        "day": day,
        "pageviews": _count_events(day, "pageview"),
        "visitors": _count_unique_visitors(day),
        "downloads": _count_events(day, "download_win"),
        "parse_ok": _count_events(day, "parse_ok"),
        "parse_fail": _count_events(day, "parse_fail"),
        "ad_impressions": _count_events(day, "ad_impression"),
        "ad_clicks": _count_events(day, "ad_click"),
        "buy_clicks": _count_events(day, "buy_click"),
        "revenue": rev,
        "sources": [dict(r) for r in sources],
        "recent_events": [dict(r) for r in recent_events],
        "recent_orders": [dict(r) for r in recent_orders],
        "recent_feedback": [dict(r) for r in recent_feedback],
        "feedback_open": feedback_open_count(),
        "trend": days,
    }
