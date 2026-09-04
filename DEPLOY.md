# Deploying White Party to a Linux VPS

This guide takes a **fresh Ubuntu/Debian VPS** to a running, HTTPS site. The app
is a Next.js server (`next start`, i.e. `npm run start`) managed by **pm2**,
behind a reverse proxy (Caddy or nginx) that terminates TLS.

> **Do not set `output: "standalone"` in `next.config.ts`.** Next refuses to
> combine it with `next start`, and the standalone bundle additionally needs
> `.next/static` copied in beside `server.js` plus an explicit pm2 `--cwd` —
> both of which a host control panel will undo when it regenerates its process
> config.

Conventions used below (adjust to taste, but keep them consistent everywhere):

| Thing            | Value                                   |
| ---------------- | --------------------------------------- |
| App user         | `whiteparty` (non-root)                  |
| App directory    | `/srv/white-party`                      |
| SQLite database  | `/srv/white-party/data/app.db`          |
| Backups          | `/srv/white-party/backups`              |
| pm2 app name     | `white-party`                           |
| App listens on   | `127.0.0.1:6353` (proxy only)           |
| Public domain    | `feest.example.nl` (replace with yours) |

> The app user needs a login shell for pm2 (so `sudo -iu whiteparty` works and
> pm2 can install its own boot service). If you created it with `--shell
> /usr/sbin/nologin`, switch it: `sudo usermod --shell /bin/bash whiteparty`.

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

Install Node.js 22 LTS from NodeSource (system-wide, so pm2, cron and the boot
service all find `/usr/bin/node` on `PATH`), plus git, sqlite3 (for backups) and
build tooling (fallback for any native module without a prebuilt binary):

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

Install **pm2** globally (the process manager that keeps the app running and
restarts it on boot):

```bash
sudo npm install -g pm2
pm2 -v
```

> **nvm alternative:** you can install Node with nvm instead. pm2 then runs
> under that Node automatically (it uses whichever `node` started it), so no
> absolute paths are needed — but install pm2 with that same Node
> (`npm install -g pm2`, no sudo), and run `pm2 startup` as the app user so the
> boot service points at the nvm Node. Using the system Node above is simpler.

---

## 2. Create the app user and directories

```bash
sudo useradd --system --create-home --shell /bin/bash whiteparty
sudo mkdir -p /srv/white-party
sudo chown whiteparty:whiteparty /srv/white-party
```

(pm2 needs a real shell for the app user, so use `/bin/bash` rather than
`nologin`.)

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

Fill in `/srv/white-party/.env`. Next loads this file itself at startup;
`deploy.sh` deliberately does **not** source it.

> **Escaping.** Next expands `$VAR` references when it loads `.env`, so a
> literal `$` in a value must be written `\$` — otherwise it is silently
> replaced with an empty string. Single quotes do **not** prevent this. Some
> host panels (xCloud) additionally *shell-source* `.env` into the process
> environment, where an unescaped backtick would **execute as a command**;
> write it `` \` ``. Quote any value containing a space (in practice
> `SMTP_FROM`). See §13 for how this shows up: SMTP `535`, or a truncated
> password.

```ini
# Absolute path — see the note below. Prefix with file:
DATABASE_URL=file:/srv/white-party/data/app.db

# Port/host the server listens on (reverse proxy targets this).
PORT=6353
HOSTNAME=127.0.0.1

# 32+ byte random secret. Generate with: openssl rand -base64 32
SESSION_SECRET=<paste output of: openssl rand -base64 32>

# Public HTTPS base URL (no trailing slash). Used in email links.
APP_URL=https://feest.example.nl

# SMTP
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM="White Party <noreply@feest.example.nl>"

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
  SQLite paths resolve relative to wherever Prisma finds `schema.prisma`, which
  differs between the Prisma CLI and the running server. Getting this wrong
  gives `Error code 14: Unable to open the database file`. An absolute path
  makes migrate/seed and the server agree on one file.
- **`PORT` / `HOSTNAME`** — `next start` reads these from its environment.
  `HOSTNAME=127.0.0.1` binds it to localhost so only the reverse proxy can
  reach it. Change `PORT` to whatever your proxy targets (this guide uses
  `6353`).

  > The variable is `HOSTNAME`, **not** `HOST` — Next ignores `HOST`. Some host
  > panels export `HOST=127.0.0.1`, which does nothing: the app then binds
  > `0.0.0.0` and is reachable directly on its port, bypassing the proxy and its
  > TLS. Check with `ss -ltnp | grep <port>`; you want `127.0.0.1:<port>`, not
  > `0.0.0.0:<port>`. Set `HOSTNAME` in `.env` to be sure.
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
sudo -u whiteparty npm ci --include=dev   # --include=dev: keep build tooling even if NODE_ENV=production
sudo -u whiteparty npm run build

# create the schema and the initial admin
sudo -u whiteparty npm run db:deploy   # applies prisma/migrations
sudo -u whiteparty npm run db:seed     # creates the admin from SEED_ADMIN_*
```

The build + migrate steps are also wrapped in `deploy.sh` (§9), so after the
first run you can just use that.

---

## 7. Start with pm2

Run all of this **as the app user** (`sudo -iu whiteparty`, then
`cd /srv/white-party`). pm2 keeps the app running, restarts it on crash, and —
via `pm2 startup` + `pm2 save` — brings it back after a reboot.

The `deploy.sh` script (§9) already starts/reloads the pm2 process for you, so
the normal flow is just to run it. To start it manually the first time:

```bash
cd /srv/white-party
export NODE_ENV=production

# Next reads .env itself from the working directory — do NOT `. ./.env` here.
# Sourcing it bakes a copy into pm2's saved environment, and process.env then
# wins over .env forever after, so later edits to the file appear to do nothing.
pm2 start npm --name white-party --cwd /srv/white-party -- run start
pm2 save            # remember this process list across reboots
pm2 startup         # prints ONE sudo command — copy/paste and run it
```

`pm2 startup` prints a `sudo env PATH=… pm2 startup systemd -u whiteparty …`
command; run exactly what it prints (it registers a boot service that resurrects
the saved process list). Then verify:

```bash
pm2 status                                  # white-party should be "online"
pm2 logs white-party --lines 50             # live logs
curl -s http://127.0.0.1:6353/api/health    # {"ok":true,"db":true}
```

Handy pm2 commands: `pm2 restart white-party`, `pm2 reload white-party`
(zero-downtime), `pm2 stop white-party`, `pm2 logs white-party`.

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
    reverse_proxy 127.0.0.1:6353
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
        proxy_pass http://127.0.0.1:6353;
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

`deploy.sh` (in the repo root) runs install → build → migrate → pm2 (re)start.
Run it **as the app user** (it uses that user's pm2):

```bash
sudo -iu whiteparty
cd /srv/white-party
./deploy.sh
```

It starts the pm2 process on the first run and `pm2 reload`s it (zero-downtime)
on subsequent runs, then calls `pm2 save`. No sudo/systemctl needed — pm2 runs
entirely under the app user. If an `ecosystem.config.cjs` is present (host
panels such as xCloud generate one and own the process definition) it starts
from that instead.

(Run `./deploy.sh` with `SKIP_RESTART=1` to build without touching the running
process. Override the pm2 app name with `APP_NAME=... ./deploy.sh`.)

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

Restore is just copying a dated file back to `data/app.db` while the app is
stopped (run as the `whiteparty` user):

```bash
pm2 stop white-party
cp /srv/white-party/backups/app-2026-07-01.db /srv/white-party/data/app.db
pm2 start white-party
```

Consider shipping the `backups/` files off-box (e.g. `rclone` to R2 or another
provider) so a lost VPS doesn't lose the database.

---

## 12. Updating to a new version

```bash
sudo -iu whiteparty
cd /srv/white-party
git pull
./deploy.sh      # npm ci, build, migrate, pm2 reload
```

`./deploy.sh` runs `npm run db:deploy` (applies any new migrations; a no-op if
none). It does **not** re-seed. Watch it come back up:

```bash
pm2 logs white-party
curl -s https://feest.example.nl/api/health
```

---

## 13. Troubleshooting

- **Site loads unstyled / 404s on `/_next/static/...`** — almost always
  `output: "standalone"` having crept back into `next.config.ts` while the
  process runs `next start`. Remove it and rebuild. (The standalone bundle
  excludes `.next/static`, so it must be copied in beside `server.js` — which
  is exactly the fragility this project avoids by not using standalone.)
- **`Cannot find module` for sharp / Prisma engine, or a native crash on
  start** — the build was produced on the wrong platform. Rebuild **on the VPS**
  (`sudo -u whiteparty ./deploy.sh`); don't copy `node_modules`/`.next` from
  another OS.
- **DB errors / "unable to open database file"** — check `DATABASE_URL` is an
  **absolute** `file:/srv/white-party/data/app.db`, and that `data/` exists and
  is owned by the pm2 app user (`whiteparty`).
- **Login always fails right after deploy** — cookies are `Secure`; you must be
  on `https://` (via the proxy), not hitting `http://` or the raw
  `127.0.0.1:6353` directly.
- **Everyone shares one rate-limit bucket / wrong client IPs** — the proxy isn't
  forwarding `X-Forwarded-For` (Caddy does by default; check the nginx block).
- **Emails not arriving** — verify SMTP vars; check `pm2 logs white-party` for
  send errors. The admin "create user" flow shows the temporary password
  on-screen when a send fails, as a fallback.
- **Env var not picked up / edits to `.env` appear to do nothing** — Next looks
  up `process.env` **before** `.env`, so any copy already in the process
  environment wins permanently. If `.env` was ever shell-sourced before `pm2
  start`, that stale copy is saved in pm2's dump and re-injected on every
  restart. `--update-env` only refreshes from your *current shell*; it does not
  clear a stale entry. Check what the process actually holds, then rebuild it:

  ```bash
  pm2 env 0 | grep '^SMTP_PASS='          # empty is GOOD: means .env is the only source
  pm2 delete white-party
  cd /srv/white-party && ./deploy.sh
  ```

- **SMTP fails with `535 ... wrong user/password` but the password is right** —
  an unescaped `$` in `SMTP_PASS`. Next expanded it away, so a shorter string
  was sent. Write it `\$` (see §5) and restart. To confirm without printing the
  secret, compare lengths:

  ```bash
  node -e 'require(require.resolve("@next/env",{paths:[process.cwd()]})).loadEnvConfig(process.cwd());console.log(process.env.SMTP_PASS.length)'
  ```

- **SMTP fails with `ETIMEDOUT` / `command: 'CONN'`** — a blocked outbound port,
  not a credentials problem. Most providers block 25 and 465 by default
  (Hetzner unblocks only after ~30 days and a support request); **587 is
  normally open**. Test with
  `timeout 8 bash -c "cat </dev/null >/dev/tcp/$SMTP_HOST/587"`.
- **`pm2: command not found` in `deploy.sh` / cron** — pm2 is a global npm
  binary; ensure it's on the app user's `PATH` (installed with the same Node,
  `sudo -iu whiteparty` for a login shell). After a reboot, `pm2 status` should
  show the app already `online` if you ran the `pm2 startup` command.
