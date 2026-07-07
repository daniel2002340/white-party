# Deploying White Party to a Linux VPS

This guide takes a **fresh Ubuntu/Debian VPS** to a running, HTTPS site. The app
is a Next.js standalone server (`node .next/standalone/server.js`) managed by
systemd, behind a reverse proxy (Caddy or nginx) that terminates TLS.

Conventions used below (adjust to taste, but keep them consistent everywhere):

| Thing            | Value                                   |
| ---------------- | --------------------------------------- |
| App user         | `whiteparty` (non-root, no login shell) |
| App directory    | `/srv/white-party`                      |
| SQLite database  | `/srv/white-party/data/app.db`          |
| Backups          | `/srv/white-party/backups`              |
| systemd service  | `white-party`                           |
| App listens on   | `127.0.0.1:3000` (proxy only)           |
| Public domain    | `feest.example.nl` (replace with yours) |

> **Build on the target VPS.** `sharp`, the Prisma query engine, and `argon2`
> ship **platform-specific native binaries**. Never copy a build (or
> `node_modules`) from a Mac/Windows machine — build on the Linux server so the
> Linux binaries are installed.

---

## 0. Prerequisites

- A VPS running Ubuntu 22.04/24.04 (or Debian 12), with root/sudo access.
- A domain name with an **A/AAAA record** pointing at the VPS IP. HTTPS
  (Caddy/certbot) needs this resolving before it can issue a certificate.
- A **Cloudflare account** (for R2 photo storage) — see §3.
- **SMTP credentials** from a transactional mail provider (or your own server) —
  see §4. Without SMTP the site still runs, but account/invite emails fail and
  the admin must relay temporary passwords manually.

---

## 1. Install system packages

Install Node.js 22 LTS from NodeSource (system-wide, so systemd finds
`/usr/bin/node`), plus git, sqlite3 (for backups) and build tooling (fallback
for any native module without a prebuilt binary):

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates git sqlite3 build-essential python3

# Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

node -v   # expect v22.x
npm -v
```

npm ships with Node; this project uses **npm** (there is a committed
`package-lock.json`). pnpm/yarn are not required.

> **nvm alternative:** you can install Node with nvm instead, but systemd runs
> without your shell's PATH, so the service file's `ExecStart` must use the
> **absolute** node path (e.g. `/home/whiteparty/.nvm/versions/node/v22.13.1/bin/node`).
> Find it with `which node`. Using the system Node above keeps `/usr/bin/node`
> valid and is simpler — recommended.

---

## 2. Create the app user and directories

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin whiteparty
sudo mkdir -p /srv/white-party
sudo chown whiteparty:whiteparty /srv/white-party
```

---

## 3. Create the Cloudflare R2 bucket, token and CORS

Photos are stored in a **private** R2 bucket; the app only ever issues presigned
URLs (never public object URLs).

1. **Create the bucket.** Cloudflare dashboard → **R2** → *Create bucket*, e.g.
   `white-party`. Leave public access **disabled**.
2. **Find the S3 endpoint.** R2 → *Overview* shows your account's S3 API
   endpoint: `https://<accountid>.r2.cloudflarestorage.com`. This is
   `R2_ENDPOINT` (no bucket name in the URL).
3. **Create a scoped API token.** R2 → *Manage R2 API Tokens* → *Create API
   token*:
   - Permissions: **Object Read & Write**.
   - Specify bucket: select **only** your `white-party` bucket.
   - Create. Copy the **Access Key ID** → `R2_ACCESS_KEY_ID` and the
     **Secret Access Key** → `R2_SECRET_ACCESS_KEY` (shown once).
   - `R2_BUCKET` = `white-party`.
4. **Set the CORS policy** so browsers can upload directly (presigned PUT). R2 →
   your bucket → **Settings → CORS policy** → *Edit* → paste, replacing the
   origin with your production URL (keep `http://localhost:3000` too if you also
   develop locally):

   ```json
   [
     {
       "AllowedOrigins": ["https://feest.example.nl", "http://localhost:3000"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": [],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Only `PUT` is required — uploads go browser→R2 directly. Thumbnails/photos are
   loaded as `<img src>` (no CORS) and downloads use `Content-Disposition`, so no
   `GET` rule is needed.

---

## 4. SMTP settings

From your mail provider, collect: host, port (587 STARTTLS or 465 implicit TLS),
username, password, and a verified **From** address. These become `SMTP_HOST`,
`SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.

---

## 5. Clone and configure

```bash
# clone into the app directory as the app user
sudo -u whiteparty git clone <your-repo-url> /srv/white-party
cd /srv/white-party
sudo -u whiteparty cp .env.example .env
sudo -u whiteparty mkdir -p data backups
sudo -u whiteparty nano .env    # fill in the values below
```

Fill in `/srv/white-party/.env`. **Write plain `KEY=value` lines** (no
surrounding quotes — the file is read by both Next and systemd's
`EnvironmentFile=`; modern systemd, v240+, is fine with unquoted values that
contain spaces such as `SMTP_FROM`):

```ini
# Absolute path — see the note below. Prefix with file:
DATABASE_URL=file:/srv/white-party/data/app.db

# 32+ byte random secret. Generate with: openssl rand -base64 32
SESSION_SECRET=<paste output of: openssl rand -base64 32>

# Public HTTPS base URL (no trailing slash). Used in email links.
APP_URL=https://feest.example.nl

# SMTP
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=White Party <noreply@feest.example.nl>

# Cloudflare R2 (from §3)
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access key id>
R2_SECRET_ACCESS_KEY=<secret access key>
R2_BUCKET=white-party

# Initial admin — used ONCE by the seed step, then can be blanked
SEED_ADMIN_EMAIL=admin@feest.example.nl
SEED_ADMIN_PASSWORD=<a strong initial password>
```

Notes on individual variables:

- **`DATABASE_URL` must be an absolute `file:` path in production.** Relative
  SQLite paths resolve relative to `schema.prisma`, which in the standalone
  build lives deep under `node_modules/.prisma/client/`. An absolute path makes
  the Prisma CLI (migrate/seed) and the running server agree on the same file.
- **`SESSION_SECRET`** — generate with `openssl rand -base64 32`. (Sessions
  currently use random tokens stored in the database, so this value isn't read
  by the app yet; it's documented in `.env.example` and set as a defensive
  default. Set it anyway — no harm, and it's ready if signing is added later.)
- **`APP_URL`** must be the real `https://` URL. It's used to build the login
  and invite links in emails; a wrong value produces broken links.
- **`SEED_ADMIN_*`** are only read by the one-time seed (§6). After the admin
  logs in and sets a real password, you can blank these.

Lock down the secrets file:

```bash
sudo chown whiteparty:whiteparty /srv/white-party/.env
sudo chmod 600 /srv/white-party/.env
```

---

## 6. Install, build, migrate, seed (first deploy)

Run these as the app user, from `/srv/white-party`.

> Do **not** export `NODE_ENV=production` in this shell — the build, migrations
> and seed need devDependencies (the Prisma CLI, `tsx`, the build toolchain).
> `NODE_ENV=production` is set only for the running service (§7).

```bash
cd /srv/white-party
sudo -u whiteparty npm ci
sudo -u whiteparty npm run build

# output: "standalone" does NOT include public/ or .next/static — copy them
# into the bundle so the standalone server can serve them:
sudo -u whiteparty cp -r public .next/standalone/public
sudo -u whiteparty mkdir -p .next/standalone/.next/static
sudo -u whiteparty cp -r .next/static .next/standalone/.next/static

# create the schema and the initial admin
sudo -u whiteparty npm run db:deploy   # applies prisma/migrations
sudo -u whiteparty npm run db:seed     # creates the admin from SEED_ADMIN_*
```

The build + static-copy + migrate steps are also wrapped in `deploy.sh` (§9), so
after the first run you can just use that. The static copy is easy to forget —
without it the site loads unstyled (missing CSS/JS).

---

## 7. systemd service

Create `/etc/systemd/system/white-party.service`:

```ini
[Unit]
Description=White Party (Next.js standalone)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=whiteparty
Group=whiteparty
WorkingDirectory=/srv/white-party
EnvironmentFile=/srv/white-party/.env
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node .next/standalone/server.js
Restart=always
RestartSec=5

# Hardening (safe with outbound SMTP/R2 — network stays available)
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/srv/white-party/data /srv/white-party/backups

[Install]
WantedBy=multi-user.target
```

`HOSTNAME=127.0.0.1` binds the app to localhost only — it's reachable solely
through the reverse proxy. Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now white-party
sudo systemctl status white-party        # should be active (running)
curl -s http://127.0.0.1:3000/api/health # {"ok":true,"db":true}
journalctl -u white-party -f             # live logs
```

---

## 8. Reverse proxy + HTTPS

The app sets **Secure** session cookies in production, so it must be served over
HTTPS. The proxy also **must forward `X-Forwarded-For`** — the login rate limiter
uses it to identify clients.

### Option A — Caddy (automatic HTTPS, recommended)

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
```

Replace `/etc/caddy/Caddyfile` with:

```caddy
feest.example.nl {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Caddy sets `X-Forwarded-For`/`X-Forwarded-Proto` by default and obtains/renews a
Let's Encrypt certificate automatically. Reload:

```bash
sudo systemctl reload caddy
```

Photo uploads bypass the app (browser → R2 directly), so no large
`request_body`/`client_max_body_size` tuning is needed.

### Option B — nginx (with certbot)

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/white-party`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name feest.example.nl;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/white-party /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d feest.example.nl   # issues the cert + adds the 443 block
```

---

## 9. The deploy script

`deploy.sh` (in the repo root) runs install → build → static-copy → migrate →
restart. Use it for the first deploy's build steps and for all updates:

```bash
cd /srv/white-party
sudo -u whiteparty ./deploy.sh
```

It runs `sudo systemctl restart white-party` at the end, so allow the
`whiteparty` user that one command without a password:

```bash
echo 'whiteparty ALL=(root) NOPASSWD: /usr/bin/systemctl restart white-party' | sudo tee /etc/sudoers.d/white-party-deploy
sudo chmod 440 /etc/sudoers.d/white-party-deploy
```

(Or run `./deploy.sh` with `SKIP_RESTART=1` and restart the service yourself.)

---

## 10. Verify

```bash
curl -s https://feest.example.nl/api/health    # {"ok":true,"db":true}
```

Then open `https://feest.example.nl/login` and sign in with the seeded admin
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). Create an edition, upload a photo
(confirms R2 + CORS), and send a test invite (confirms SMTP).

---

## 11. Nightly database backups

The SQLite database is the only local state worth backing up. **Photos live in
R2 and are not part of this backup.** Use SQLite's online `.backup` (WAL-safe)
and keep 14 days.

Create the backups directory (done in §5) and add a cron job for the app user:

```bash
sudo -u whiteparty crontab -e
```

Add this line (runs 03:00 daily; `\%` escapes `%` for cron):

```cron
0 3 * * * cd /srv/white-party && /usr/bin/sqlite3 data/app.db ".backup 'backups/app-$(date +\%F).db'" && /usr/bin/find backups -name 'app-*.db' -mtime +14 -delete
```

Restore is just copying a dated file back to `data/app.db` while the service is
stopped:

```bash
sudo systemctl stop white-party
sudo -u whiteparty cp /srv/white-party/backups/app-2026-07-01.db /srv/white-party/data/app.db
sudo systemctl start white-party
```

Consider shipping the `backups/` files off-box (e.g. `rclone` to R2 or another
provider) so a lost VPS doesn't lose the database.

---

## 12. Updating to a new version

```bash
cd /srv/white-party
sudo -u whiteparty git pull
sudo -u whiteparty ./deploy.sh      # npm ci, build, static copy, migrate, restart
```

`./deploy.sh` runs `npm run db:deploy` (applies any new migrations; a no-op if
none). It does **not** re-seed. Watch it come back up:

```bash
journalctl -u white-party -f
curl -s https://feest.example.nl/api/health
```

---

## 13. Troubleshooting

- **Site loads unstyled / 404s on `/_next/static/...`** — the static copy step
  was skipped. Re-run `./deploy.sh` (or the `cp -r .next/static ...` +
  `cp -r public ...` commands) and restart.
- **`Cannot find module` for sharp / Prisma engine, or a native crash on
  start** — the build was produced on the wrong platform. Rebuild **on the VPS**
  (`sudo -u whiteparty ./deploy.sh`); don't copy `node_modules`/`.next` from
  another OS.
- **DB errors / "unable to open database file"** — check `DATABASE_URL` is an
  **absolute** `file:/srv/white-party/data/app.db`, that `data/` exists and is
  owned by `whiteparty`, and that systemd `ReadWritePaths` includes it.
- **Login always fails right after deploy** — cookies are `Secure`; you must be
  on `https://` (via the proxy), not hitting `http://` or the raw
  `127.0.0.1:3000` directly.
- **Everyone shares one rate-limit bucket / wrong client IPs** — the proxy isn't
  forwarding `X-Forwarded-For` (Caddy does by default; check the nginx block).
- **Emails not arriving** — verify SMTP vars; check `journalctl -u white-party`
  for send errors. The admin "create user" flow shows the temporary password
  on-screen when a send fails, as a fallback.
- **Env var not picked up** — `EnvironmentFile` values wrapped in quotes on old
  systemd, or a missing `sudo systemctl daemon-reload` after editing the unit.
  Restart the service after changing `.env`.
