#!/bin/bash
# FluxGrab VPS one-click upgrade: license-api -> analytics-api + admin dashboard
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/fluxgrab}"
DEPLOY_DIR="$REPO_DIR/deploy"
ENV_FILE="$DEPLOY_DIR/.env"

echo "== FluxGrab analytics upgrade =="

if [ ! -d "$REPO_DIR/.git" ]; then
  echo "ERROR: $REPO_DIR is not a git repo. Clone first:"
  echo "  git clone https://github.com/1391204657/fluxgrab.git $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"
echo "-> git pull"
git pull origin main

mkdir -p "$DEPLOY_DIR"
if [ ! -f "$ENV_FILE" ]; then
  cp "$DEPLOY_DIR/.env.example" "$ENV_FILE" 2>/dev/null || cp "$REPO_DIR/server/deploy/.env.example" "$ENV_FILE"
fi

# Generate secrets if missing
touch "$ENV_FILE"
grep -q '^ADMIN_PASSWORD=.' "$ENV_FILE" 2>/dev/null || {
  AP="$(openssl rand -base64 24 | tr -d '/+=' | head -c 20)"
  echo "ADMIN_PASSWORD=$AP" >> "$ENV_FILE"
  echo ">> Created ADMIN_PASSWORD (save this!): $AP"
}
grep -q '^FLUXGRAB_SECRET=.' "$ENV_FILE" 2>/dev/null || {
  FS="$(openssl rand -hex 24)"
  echo "FLUXGRAB_SECRET=$FS" >> "$ENV_FILE"
}
grep -q '^IP_SALT=.' "$ENV_FILE" 2>/dev/null || echo "IP_SALT=fluxgrab" >> "$ENV_FILE"

# Show admin password for user (without exposing Lemon keys)
ADMIN_PW="$(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)"
echo ""
echo "============================================"
echo " Admin login: https://api.fluxgrab.com/admin/"
echo " Password:    $ADMIN_PW"
echo "============================================"
echo ""

cd "$DEPLOY_DIR"

echo "-> stop old containers"
docker compose down 2>/dev/null || true
docker stop cobalt-api caddy license-api analytics-api 2>/dev/null || true
docker rm cobalt-api caddy license-api analytics-api 2>/dev/null || true

echo "-> build & start"
docker compose up -d --build

echo "-> wait for health"
sleep 4
curl -fsSL "https://api.fluxgrab.com/health" || curl -fsSL "http://127.0.0.1/health" || true
echo ""

docker ps --format "table {{.Names}}\t{{.Status}}"

if docker ps --format '{{.Names}}' | grep -q '^analytics-api$'; then
  echo ""
  echo "OK — analytics-api is running."
  echo "Open https://api.fluxgrab.com/admin/"
else
  echo ""
  echo "WARN — analytics-api not found. Run: docker compose logs --tail=50"
  exit 1
fi
