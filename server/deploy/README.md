# Deploy FluxGrab API stack on api.fluxgrab.com

Services: **Cobalt** (online parse) + **Analytics** (stats admin + Lemon webhooks) + **Caddy** (HTTPS).

## 1. Upload to server

On your DigitalOcean droplet (`/opt/fluxgrab`):

```bash
cd /opt/fluxgrab
git pull   # or copy server/ from repo
```

Directory layout:

```
/opt/fluxgrab/
  deploy/docker-compose.yml
  deploy/Caddyfile
  deploy/.env
  analytics_server/
  license_server/   # legacy, no longer required in compose
```

## 2. Configure `.env`

```bash
cd /opt/fluxgrab/deploy
cp .env.example .env
nano .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | **Yes** | Admin dashboard login password |
| `FLUXGRAB_SECRET` | Yes | Random 32+ chars for session cookies |
| `LEMONSQUEEZY_API_KEY` | For refunds | Lemon API key |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | For webhooks | Same as Lemon dashboard signing secret |
| `IP_SALT` | Optional | Salt for visitor hashing (privacy) |

## 3. Start / update stack

```bash
cd /opt/fluxgrab/deploy
docker compose down
docker compose up -d --build
```

Verify:

```bash
curl -s https://api.fluxgrab.com/health
# {"ok":true,"service":"fluxgrab-analytics"}
```

## 4. Admin dashboard

Open: **https://api.fluxgrab.com/admin/**

Log in with `ADMIN_PASSWORD` from `.env`.

Shows: daily pageviews, visitors, download clicks, parse stats, ad clicks, revenue, referrers, orders, feedback.

## 5. Lemon Squeezy webhooks

Dashboard → **Settings → Webhooks** → edit existing webhook:

| Field | Value |
|-------|-------|
| URL | `https://api.fluxgrab.com/webhook/lemon` |
| Signing secret | same as `LEMONSQUEEZY_WEBHOOK_SECRET` in `.env` |
| Events | **`order_created`** and **`order_refunded`** |

- `order_created` → records payment in admin stats
- `order_refunded` → records refund + disables license key (full refund)

After changing events, restart is not required.

## 6. Website analytics

The site sends events to `https://api.fluxgrab.com/v1/events` via `assets/analytics.js` (included on homepage).

Tracked events: `pageview`, `download_win`, `parse_ok`, `parse_fail`, `ad_impression`, `ad_click`, `buy_click`.

Deploy updated website (`git push` on fluxgrab.com repo) for tracking to start.

## 7. Migrate from old `license-api` container

If you previously ran `license-api`, the new stack replaces it:

```bash
docker stop license-api 2>/dev/null; docker rm license-api 2>/dev/null
docker compose up -d --build
```

Webhook URL stays the same; routing now goes to `analytics-api`.

## 8. Backup analytics data

```bash
docker run --rm -v fluxgrab_analytics_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/analytics-backup.tar.gz -C /data .
```

SQLite file: `/data/analytics.db` inside `analytics-api` volume.

## 9. Support email (`support@fluxgrab.com`)

**Receive mail at your inbox (recommended, free):**

1. Add domain **fluxgrab.com** to [Cloudflare](https://dash.cloudflare.com) (move DNS there if needed).
2. **Email → Email Routing → Get started** → create address `support@fluxgrab.com` → forward to your personal Gmail/Outlook.
3. Cloudflare adds the required MX records automatically.
4. Test by sending mail to `support@fluxgrab.com`.

No code changes needed — `mailto:support@fluxgrab.com` links across the site will work.

**Feedback form:** `contact.html` posts to `/v1/events` and appears in **Admin → Recent feedback**.

**Optional instant email alert** when someone submits the form (in addition to admin dashboard):

```env
FEEDBACK_NOTIFY_EMAIL=you@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx   # Gmail App Password, not your login password
SMTP_FROM=support@fluxgrab.com
```

Then `docker compose up -d --build` in `/opt/fluxgrab/deploy`.

## 10. Traffic source notes

`direct` = browser sent no referrer. This includes:

- Typed URL or bookmarks (cannot be distinguished — browsers do not expose this)
- In-app browsers (WeChat, Telegram, etc.) — now labeled separately when User-Agent matches
- Your own visits while testing
- Privacy extensions stripping referrer

When you share links later, add `?utm_source=wechat` (or `twitter`, `reddit`) to see campaign breakdown in admin referrers.
