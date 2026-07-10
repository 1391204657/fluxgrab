# Deploy FluxGrab API stack on api.fluxgrab.com

Services: **Cobalt** (online parse) + **Analytics** (stats, Stripe, `/v1/media/parse` for CN platforms) + **Caddy** (HTTPS).

## China platforms (Douyin / Bilibili / …)

`POST https://api.fluxgrab.com/v1/media/parse` with `{"url":"..."}` returns Cobalt-compatible JSON (`status` + direct `url`). Runs on the existing analytics container (yt-dlp + optional Cobalt fallback). No extra VPS cost.

Optional server cookies (improves Douyin/Bilibili success rate):

```bash
docker exec -it analytics-api mkdir -p /data/cookies
# copy a Netscape cookies.txt from your browser export:
docker cp cookies.txt analytics-api:/data/cookies/cookies.txt
```

Website and desktop app call this endpoint for CN hosts; other sites still use Cobalt / local yt-dlp.

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

## 5. Stripe (FluxGrab Pro checkout)

1. Create a **one-time** product in [Stripe Dashboard](https://dashboard.stripe.com/products) (e.g. FluxGrab Pro, $9.99).
2. Copy the **Price ID** (`price_...`) into `.env` as `STRIPE_PRICE_ID`.
3. **Developers → API keys** → copy **Secret key** → `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks** → Add endpoint:
   - URL: `https://api.fluxgrab.com/webhook/stripe`
   - Events: `checkout.session.completed`, `charge.refunded`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`
5. Set SMTP vars in `.env` so buyers receive license keys by email (`support@fluxgrab.com` as From).
6. Rebuild: `docker compose up -d --build`

`ACTIVATION_LIMIT=3` caps each key to 3 PCs (desktop app calls `/v1/licenses/activate`).

### Legacy Lemon webhooks (optional)

If you still have Lemon orders, keep the Lemon webhook configured:

| Field | Value |
|-------|-------|
| URL | `https://api.fluxgrab.com/webhook/lemon` |
| Signing secret | same as `LEMONSQUEEZY_WEBHOOK_SECRET` in `.env` |
| Events | **`order_created`** and **`order_refunded`** |

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
