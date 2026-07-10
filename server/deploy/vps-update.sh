#!/bin/bash
# FluxGrab VPS — pull latest API routes (/v1/ads, /v1/preview, /v1/media/parse) and rebuild.
# Run on the Linux server (DigitalOcean Web Console), NOT on Windows PowerShell:
#   curl -fsSL https://raw.githubusercontent.com/1391204657/fluxgrab/main/server/deploy/vps-update.sh | bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/1391204657/fluxgrab.git}"
BASE="${BASE:-/opt/fluxgrab}"
DEPLOY="$BASE/server/deploy"
LEGACY_DEPLOY="$BASE/deploy"
ENV_FILE="$DEPLOY/.env"

echo "== FluxGrab VPS update =="

if [ -d "$BASE/.git" ]; then
  echo "-> git pull in $BASE"
  git -C "$BASE" pull origin main
elif [ -d "$BASE" ]; then
  echo "-> no git repo; syncing from GitHub"
  rm -rf "$BASE/repo-sync"
  git clone --depth 1 "$REPO_URL" "$BASE/repo-sync"
  mkdir -p "$DEPLOY"
  cp -f "$BASE/repo-sync/server/deploy/"* "$DEPLOY/" 2>/dev/null || true
  # Keep analytics_server in sync when not a full git checkout
  if [ -d "$BASE/repo-sync/server/analytics_server" ]; then
    rm -rf "$BASE/server/analytics_server"
    mkdir -p "$BASE/server"
    cp -a "$BASE/repo-sync/server/analytics_server" "$BASE/server/"
  fi
  rm -rf "$BASE/repo-sync"
else
  echo "-> fresh clone to $BASE"
  git clone --depth 1 "$REPO_URL" "$BASE"
fi

mkdir -p "$DEPLOY"

# Keep secrets from older layout (/opt/fluxgrab/deploy/.env)
if [ -f "$LEGACY_DEPLOY/.env" ] && [ ! -f "$ENV_FILE" ]; then
  echo "-> migrate .env from $LEGACY_DEPLOY"
  cp "$LEGACY_DEPLOY/.env" "$ENV_FILE"
fi
if [ ! -f "$ENV_FILE" ] && [ -f "$DEPLOY/.env.example" ]; then
  cp "$DEPLOY/.env.example" "$ENV_FILE"
fi

if [ ! -f "$DEPLOY/docker-compose.yml" ]; then
  echo "ERROR: missing $DEPLOY/docker-compose.yml"
  echo "Expected repo layout: $BASE/server/deploy/docker-compose.yml"
  exit 1
fi

cd "$DEPLOY"
echo "-> docker compose rebuild (in $DEPLOY)"
docker compose down 2>/dev/null || true
docker compose up -d --build

echo "-> wait"
sleep 8
echo ""
echo "health:"
curl -fsSL "https://api.fluxgrab.com/health" || curl -fsSL "http://127.0.0.1/health" || true
echo ""
echo "media parse route:"
curl -fsSL -X POST "https://api.fluxgrab.com/v1/media/parse" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"url":"https://www.bilibili.com/video/BV1xx411c7mD"}' | head -c 400 || true
echo ""
echo "ads:"
curl -fsSL "https://api.fluxgrab.com/v1/ads" || true
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}"
