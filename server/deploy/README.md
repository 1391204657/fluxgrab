# Deploy license server on api.fluxgrab.com

## 1. Upload to server

On your DigitalOcean droplet (`/opt/fluxgrab`):

```bash
cd /opt/fluxgrab
# copy deploy/ and license_server/ from this repo
```

## 2. Configure secrets

```bash
cd /opt/fluxgrab/deploy
cp .env.example .env
nano .env   # set STRIPE_WEBHOOK_SECRET=whsec_...
```

Optional SMTP so customers receive license keys by email automatically.

## 3. Update stack

```bash
docker compose down
docker compose up -d --build
```

Verify:

```bash
curl -s https://api.fluxgrab.com/license/health
# {"ok":true,"service":"fluxgrab-license"}
```

## 4. Lemon Squeezy webhook (refund → revoke license)

Dashboard → **Settings → Webhooks → +**

| Field | Value |
|---|---|
| URL | `https://api.fluxgrab.com/webhook/lemon` |
| Signing secret | random 32+ chars → copy to `.env` as `LEMONSQUEEZY_WEBHOOK_SECRET` |
| Events | **`order_refunded`** only |

Also create an API key: **Settings → API → +** → copy to `.env` as `LEMONSQUEEZY_API_KEY`.

When a customer gets a **full refund**, the server calls Lemon’s API and sets the license key to **`disabled`**. The desktop app’s next validate/activate will fail; they must buy again.

```bash
docker compose up -d --build
```

## 5. Stripe webhook (optional)

Dashboard → Developers → Webhooks → Add endpoint

- URL: `https://api.fluxgrab.com/webhook/stripe`
- Events: `checkout.session.completed`
- Copy signing secret → `STRIPE_WEBHOOK_SECRET` in `.env` → `docker compose up -d`

## 5. Payment Link settings

Edit FluxGrab Pro Payment Link:

- **After payment** → redirect to `https://fluxgrab.com/thanks.html`

## 6. Chinese payments

Stripe Dashboard → Settings → Payment methods → enable **Alipay**, **WeChat Pay**, **UnionPay**.

Checkout shows them automatically for eligible customers.

## 7. Manual license lookup (no SMTP yet)

```bash
docker exec -it license-api python -c "
import sqlite3
for row in sqlite3.connect('/data/licenses.db').execute('SELECT email,license_key,created_at FROM licenses ORDER BY id DESC LIMIT 5'):
    print(row)
"
```
