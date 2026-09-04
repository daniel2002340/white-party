#!/usr/bin/env bash
#
# Build and (re)start the pm2 process.
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

# IMPORTANT: do NOT source .env before the build/install steps. If .env sets
# NODE_ENV=production, `npm ci` would omit devDependencies (the Prisma CLI, tsx,
# and the build toolchain such as @tailwindcss/postcss), and the build fails.
# .env is sourced further down, only for the pm2 runtime. Prisma auto-reads
# .env, so `npm run db:deploy` still finds DATABASE_URL without sourcing.

echo "==> Installing dependencies"
if [ "${SKIP_INSTALL:-0}" != "1" ]; then
  # --include=dev forces devDependencies even if NODE_ENV=production is set in
  # the environment — they're needed to build, migrate and seed.
  npm ci --include=dev
fi

echo "==> Building"
npm run build

echo "==> Applying database migrations"
npm run db:deploy

if [ "${SKIP_RESTART:-0}" != "1" ]; then
  # Deliberately NOT sourcing .env here. Next loads .env itself at startup, and
  # shell-sourcing it is actively harmful: bash expands `$` and executes
  # backticks inside the values, so a secret containing either is silently
  # corrupted (or run as a command). Leaving it to Next also avoids a stale
  # copy of a variable getting baked into pm2's saved environment, which then
  # wins over .env forever after (process.env takes precedence over .env files).
  #
  # Consequence: `.env` must sit in the directory the process is started from.

  if pm2 describe "${APP_NAME}" > /dev/null 2>&1; then
    echo "==> Reloading pm2 process: ${APP_NAME}"
    pm2 reload "${APP_NAME}" --update-env
  elif [ -f ecosystem.config.cjs ]; then
    # Host panels (e.g. xCloud) generate this and own the process definition.
    echo "==> Starting pm2 from ecosystem.config.cjs"
    pm2 start ecosystem.config.cjs
  else
    echo "==> Starting pm2 process: ${APP_NAME}"
    pm2 start npm --name "${APP_NAME}" --cwd "$PWD" -- run start
  fi
  pm2 save
  pm2 --no-color status "${APP_NAME}" || true
else
  echo "==> Skipping restart (SKIP_RESTART=1)"
fi

echo "==> Done."
