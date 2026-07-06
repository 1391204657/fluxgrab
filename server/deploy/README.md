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
