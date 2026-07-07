#!/usr/bin/env bash
#
# Build + package the standalone output and restart the service.
# Run from the project root, as the app user, on the target VPS.
# See DEPLOY.md for first-time setup.
#
# Usage:
#   ./deploy.sh                # full deploy: install, build, migrate, restart
#   SKIP_INSTALL=1 ./deploy.sh # skip `npm ci` (deps unchanged)
#   SKIP_RESTART=1 ./deploy.sh # build only, don't restart the service
#
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-white-party}"

cd "$(dirname "$0")"

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
  echo "==> Restarting service: ${SERVICE_NAME}"
  sudo systemctl restart "${SERVICE_NAME}"
  sudo systemctl --no-pager --lines=0 status "${SERVICE_NAME}" || true
else
  echo "==> Skipping restart (SKIP_RESTART=1)"
fi

echo "==> Done."
