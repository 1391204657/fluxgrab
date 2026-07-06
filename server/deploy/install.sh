#!/bin/bash
# FluxGrab API stack updater — run on the Droplet as root
set -euo pipefail
BASE=/opt/fluxgrab
REPO=https://github.com/1391204657/fluxgrab.git
TMP=$(mktemp -d)
echo "==> Fetch server files from GitHub..."
git clone --depth 1 "$REPO" "$TMP"
mkdir -p "$BASE"
cp -r "$TMP/server/license_server" "$BASE/"
mkdir -p "$BASE/deploy"
cp "$TMP/server/deploy/docker-compose.yml" "$BASE/deploy/"
cp "$TMP/server/deploy/Caddyfile" "$BASE/deploy/"
cp "$TMP/server/deploy/.env.example" "$BASE/deploy/" 2>/dev/null || true
rm -rf "$TMP"
cd "$BASE/deploy"
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "!! Edit $BASE/deploy/.env — set LEMONSQUEEZY_API_KEY and LEMONSQUEEZY_WEBHOOK_SECRET"
  echo "   nano $BASE/deploy/.env"
fi
echo "==> Rebuild and start..."
docker compose up -d --build
echo "==> Health check..."
sleep 3
curl -sf https://api.fluxgrab.com/license/health && echo "" || echo "health check pending (DNS/SSL may need a minute)"
echo "Done. Webhook URL: https://api.fluxgrab.com/webhook/lemon"
