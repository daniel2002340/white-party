#!/usr/bin/env bash
#
# Build + package the standalone output and (re)start the pm2 process.
# Run from the project root, as the app user, on the target VPS.
# See DEPLOY.md for first-time setup.
#
# Usage:
#   ./deploy.sh                # full deploy: install, build, migrate, restart
#   SKIP_INSTALL=1 ./deploy.sh # skip `npm ci` (deps unchanged)
#   SKIP_RESTART=1 ./deploy.sh # build only, don't (re)start the process
#
set -euo pipefail

APP_NAME="${APP_NAME:-white-party}"

cd "$(dirname "$0")"

# Load .env into the environment so the pm2 process (and prisma) see PORT,
# HOSTNAME, DATABASE_URL, etc. Prisma auto-reads .env, but the standalone
# server needs them in its actual environment — pm2 captures them below.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

echo "==> Installing dependencies"
if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  # NOTE: do NOT set NODE_ENV=production here — devDependencies (prisma CLI,
  # tsx, the build toolchain) are needed to build, migrate and seed.
  npm ci
fi

echo "==> Building (Next.js standalone output)"
npm run build

echo "==> Copying static assets into the standalone bundle"
# `output: "standalone"` does not include these; the standalone server serves
# them from paths next to server.js, so they must be copied in after each build.
rm -rf .next/standalone/.next/static .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then
  cp -r public .next/standalone/public
fi

echo "==> Applying database migrations"
npm run db:deploy

if [ "${SKIP_RESTART:-0}" != "1" ]; then
  if pm2 describe "${APP_NAME}" > /dev/null 2>&1; then
    echo "==> Reloading pm2 process: ${APP_NAME}"
    pm2 reload "${APP_NAME}" --update-env
  else
    echo "==> Starting pm2 process: ${APP_NAME}"
    pm2 start .next/standalone/server.js --name "${APP_NAME}" --update-env
  fi
  pm2 save
  pm2 --no-color status "${APP_NAME}" || true
else
  echo "==> Skipping restart (SKIP_RESTART=1)"
fi

echo "==> Done."
