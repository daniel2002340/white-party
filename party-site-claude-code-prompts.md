# Claude Code Prompts — Party Website (editions, photos, invites, RSVP)

Run these in order, each as a fresh prompt in Claude Code inside the project directory. Review and commit after each one before starting the next. Prompt 0 creates a `CLAUDE.md` so later prompts stay consistent.

---

## Prompt 0 — Project context (CLAUDE.md)

```
Create a CLAUDE.md file in the project root with the following project context, then stop (no other code yet):

# Project: Feestwebsite (party website)

A private website for a recurring party. Guests log in to view an invite + RSVP for the upcoming edition, and browse photo galleries of past editions. An admin manages editions, photos, and user accounts.

## Architecture (fixed decisions — do not deviate)
- Next.js (latest stable, App Router) + TypeScript + Tailwind CSS
- Prisma ORM with SQLite (file at ./data/app.db, path configurable via DATABASE_URL)
- Photo storage: Cloudflare R2 (S3-compatible), accessed with @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
- Image processing: sharp (runs on the server, Node runtime — never edge runtime)
- Email: nodemailer over plain SMTP (host/port/user/pass from env)
- Auth: hand-rolled session cookies (httpOnly, secure, sameSite=lax), passwords hashed with argon2. No NextAuth/Auth.js.
- Deployment target: a Linux VPS running Node with `next start`, behind a reverse proxy. Use `output: "standalone"` in next.config.
- All UI text is in Dutch. All code, comments, and identifiers in English.
- Keep dependencies minimal. No component libraries; plain Tailwind. No client state library; use React state + server components.

## Roles
- ADMIN: manages editions, photos, users, sees RSVPs. There can be multiple admins.
- GUEST: logs in, sees published editions, RSVPs, views photos.

## Conventions
- Server Actions for mutations where natural; route handlers for uploads/downloads.
- Zod for validating all external input (forms, route handlers).
- All pages behind login except /login and /wachtwoord-instellen (set password).
- Environment variables documented in .env.example, never committed with real values.
```

---

## Prompt 1 — Scaffold + base layout

```
Read CLAUDE.md first. Scaffold the project:

1. Initialize a Next.js app (App Router, TypeScript, Tailwind, ESLint) in the current directory. Set output: "standalone" in next.config.
2. Add Prisma with SQLite. DATABASE_URL="file:./data/app.db" in .env.example. Create the ./data directory with a .gitkeep and gitignore the .db files.
3. Install: @prisma/client, argon2, zod, nodemailer, sharp, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner. Dev: @types/nodemailer, prisma.
4. Create .env.example with all variables the project will need, each with a comment:
   DATABASE_URL, SESSION_SECRET, APP_URL,
   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM,
   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
5. Base layout and design system:
   - A warm, festive but clean look. Choose a dark background with one strong accent color, a display font for headings (via next/font, e.g. a friendly serif or bold display face) and a clean sans for body text. Subtle, tasteful — no confetti clutter.
   - Root layout with Dutch lang attribute (<html lang="nl">), a minimal header (site name left, nav right: "Edities", "Admin" [admins only, wire up later], "Uitloggen") and a small footer.
   - A components/ui folder with small primitives used everywhere: Button, Input, Label, Card, Badge. Plain Tailwind, consistent spacing and radius.
6. A placeholder home page at / that says "Welkom" (will become the editions overview later).
7. Add npm scripts: dev, build, start, db:migrate (prisma migrate dev), db:deploy (prisma migrate deploy), db:seed.

Acceptance: `npm run dev` renders the styled placeholder page without errors; `npx prisma migrate dev` runs against SQLite.
```

---

## Prompt 2 — Data model, auth, seed admin

```
Read CLAUDE.md. Implement the data model and authentication.

Prisma schema:
- User: id (cuid), email (unique, lowercase), name, role enum (ADMIN, GUEST), passwordHash, mustChangePassword Boolean default true, createdAt, updatedAt
- Session: id (cuid), token (unique, random 32+ bytes hex), userId -> User (cascade delete), expiresAt, createdAt
- Edition: id, title, slug (unique), eventDate (DateTime), location String?, inviteHtml String? (rich invite/info text, stored as sanitized HTML), status enum (DRAFT, PUBLISHED, ARCHIVED) default DRAFT, coverPhotoId String?, createdAt, updatedAt
- Photo: id, editionId -> Edition (cascade), r2Key (original), r2KeyWeb, r2KeyThumb, width Int, height Int, sizeBytes Int, sortOrder Int default 0, status enum (UPLOADING, PROCESSING, READY, FAILED) default UPLOADING, createdAt
- Rsvp: id, userId -> User, editionId -> Edition, attending Boolean, guestCount Int default 0, note String?, updatedAt. Unique constraint on (userId, editionId).

Auth implementation (lib/auth.ts):
- createSession(userId): random token, 30-day expiry, stored in DB, set as httpOnly cookie "session" (secure in production, sameSite lax, path /).
- getCurrentUser(): reads cookie, loads session + user, returns null if missing/expired. Cache per-request.
- requireUser() and requireAdmin() helpers that redirect to /login (or return 403 for route handlers).
- destroySession() for logout.
- Password hashing with argon2id.

Pages/flows:
- /login: email + password form (Dutch labels: "E-mailadres", "Wachtwoord", button "Inloggen"). On success: if mustChangePassword, redirect to /wachtwoord-instellen, else to /. Generic Dutch error on failure ("Onjuiste inloggegevens"). Rate limit: max 10 attempts per 15 minutes per IP+email (simple in-memory map is fine for this scale).
- /wachtwoord-instellen: form for new password (min 10 chars), confirms twice, sets mustChangePassword=false, redirects to /.
- Logout: server action clearing the session, header button.
- Middleware or per-layout guard so every page except /login and /wachtwoord-instellen requires a session. Admin routes (/admin/**) require ADMIN role.

Seed script (prisma/seed.ts): creates an ADMIN user from SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD env vars if no admin exists, with mustChangePassword=false.

Acceptance: seeded admin can log in, log out, wrong password shows Dutch error, guest pages redirect to /login when logged out.
```

---

## Prompt 3 — User management + credential emails (SMTP)

```
Read CLAUDE.md. Build admin user management with email delivery.

Email infrastructure (lib/email.ts):
- nodemailer transport from SMTP_* env vars.
- sendMail({to, subject, html, text}) helper with a shared, simple Dutch HTML layout (site name header, content block, small footer). Inline styles only (email-safe), no external images.
- If SMTP env vars are missing in development, log the email to the console instead of failing.

Admin pages under /admin/gebruikers:
- List all users: name, email, role, created date, "wachtwoord opnieuw versturen" and "verwijderen" actions. Deleting a user cascades sessions and removes their RSVPs; confirm with a dialog.
- "Nieuwe gebruiker" form: name, email, role (default GUEST). On submit:
  1. Generate a random temporary password (16 chars, unambiguous characters).
  2. Create the user with mustChangePassword=true.
  3. Send a Dutch email: subject "Je account voor [site name]", body explaining they've been invited to the party website, with their email, the temporary password, a login link (APP_URL/login), and a note that they must set their own password on first login.
  4. Show the admin a success message. If email sending fails, show the temp password once on screen as fallback so the admin can pass it on manually, and mark this clearly.
- "Wachtwoord opnieuw versturen": generates a new temp password, sets mustChangePassword=true, invalidates existing sessions for that user, sends the same email.
- Validate with zod; reject duplicate emails with a clear Dutch message.

Also create the /admin dashboard landing page: simple cards linking to "Edities", "Gebruikers", and (placeholder) "Foto's" with counts.

Acceptance: admin creates a user, email arrives (or logs in dev), new user logs in with temp password, is forced through /wachtwoord-instellen, then sees the site as GUEST and has no access to /admin.
```

---

## Prompt 4 — Editions: admin CRUD + guest pages

```
Read CLAUDE.md. Implement editions.

Admin (/admin/edities):
- List editions with status badge (Concept / Gepubliceerd / Gearchiveerd), event date, photo count, RSVP count.
- Create/edit form: title, slug (auto-generated from title, editable), event date + time, location, status, and invite content. For invite content use a plain <textarea> that accepts a limited set of markdown (headings, bold, italic, links, lists); render it to sanitized HTML on save (use a small markdown lib + sanitization, e.g. marked + sanitize-html or equivalent). Store result in inviteHtml.
- Delete edition (confirm dialog; warn it deletes photos and RSVPs).

Guest-facing:
- Home page / becomes the editions overview: PUBLISHED editions only, sorted by eventDate descending. The next upcoming edition (eventDate >= today) is shown as a large hero card ("Volgende editie") with title, date in Dutch format (e.g. "zaterdag 14 maart 2026"), location, and a button "Bekijk uitnodiging". Past editions below in a grid ("Eerdere edities") with cover image placeholder, title, year.
- Edition detail page /edities/[slug]: title, formatted date, location, the rendered invite HTML, and a photo section placeholder ("Foto's volgen na het feest" if no photos). Guests only see PUBLISHED editions; DRAFT/ARCHIVED return 404 for guests but are viewable by admins with a "Concept" banner.

Acceptance: admin creates a draft edition, previews it, publishes it; guest sees it on the home page and can open the invite page. Dutch date formatting via Intl.DateTimeFormat('nl-NL').
```

---

## Prompt 5 — Photo upload pipeline (R2 + sharp)

```
Read CLAUDE.md. Implement the photo pipeline. Photos are private: the R2 bucket must NOT be public; all access goes through presigned URLs.

lib/r2.ts:
- S3 client configured for R2 (endpoint, region "auto", credentials from env).
- Helpers: presignedPutUrl(key, contentType, maxSize), presignedGetUrl(key, expiresSeconds=3600), deleteObject(key), getObjectBuffer(key).

Upload flow (admin only), on /admin/edities/[id]/fotos:
1. Drag-and-drop zone accepting multiple JPEG/PNG/WebP/HEIC files, max 30 MB each. Show a per-file progress list.
2. For each file, client calls POST /api/admin/photos/presign with editionId, filename, contentType, size. Server validates (admin, edition exists, type/size), creates a Photo row (status UPLOADING, r2Key = editions/{editionId}/orig/{photoId}.{ext}), returns photoId + presigned PUT URL.
3. Client PUTs the file directly to R2, then calls POST /api/admin/photos/{photoId}/process.
4. The process handler (Node runtime): downloads the original from R2, uses sharp to auto-rotate (EXIF), strip metadata, and generate:
   - web version: max 1800px on the long edge, JPEG quality 80 -> r2KeyWeb (editions/{editionId}/web/{photoId}.jpg)
   - thumbnail: 400px long edge, JPEG quality 75 -> r2KeyThumb (editions/{editionId}/thumb/{photoId}.jpg)
   Store width/height of the web version and set status READY. On any error set FAILED and log.
   Process uploads client-side sequentially with concurrency 2 so the server isn't overwhelmed by a 300-photo batch.
5. HEIC: if sharp in this environment can't decode HEIC, reject HEIC at presign time with a clear Dutch message asking for JPEG export instead — do not silently fail.
6. Admin photo grid for the edition: thumbnails (presigned GET URLs), drag-to-reorder (updates sortOrder; a simple up/down or HTML5 drag is fine), set-as-cover action (sets edition.coverPhotoId), delete (removes all three R2 objects + row).

Also add a GET /api/photos/[id]/url?variant=thumb|web route: requires login, checks the photo's edition is PUBLISHED (or user is admin), returns a short-lived presigned URL. Guest-facing pages will use this.

Add a note in CLAUDE.md about the required R2 CORS configuration for direct browser PUTs (allowed origins = APP_URL, methods PUT, headers content-type) and include the JSON snippet to paste in the Cloudflare dashboard.

Acceptance: admin uploads 10 photos in one drop, sees progress, all become READY, thumbnails render, reorder and cover selection work, deleting removes objects from R2.
```

---

## Prompt 6 — Guest gallery + lightbox

```
Read CLAUDE.md. Build the guest-facing photo gallery on /edities/[slug].

- Below the invite content, a "Foto's" section: responsive masonry-style grid (CSS columns or a simple row-based justified layout) of thumbnails, lazy-loaded (loading="lazy"), using the photo's stored width/height to reserve space and avoid layout shift.
- URL strategy: the server component fetches all READY photos for the edition and generates presigned GET URLs server-side in one pass (thumb for grid, web for lightbox), valid 1 hour, passed to the client component as props. No client-side URL fetching per image.
- Lightbox: click a photo to open a full-screen overlay showing the web version. Keyboard navigation (arrows, Escape), previous/next buttons, photo counter ("12 / 87"), tap/swipe navigation on mobile. Preload the adjacent image. Build this by hand, no heavy gallery dependency.
- Download button in the lightbox that downloads the web version.
- Empty state: "Nog geen foto's — die volgen na het feest!" for upcoming editions.
- Home page past-edition cards now use edition cover photo thumbnails (presigned server-side).

Acceptance: an edition with ~100 photos loads fast (only thumbs load initially), lightbox navigation is smooth on desktop and mobile, no layout shift while scrolling.
```

---

## Prompt 7 — RSVP + invite mailing

```
Read CLAUDE.md. Implement RSVP and the invite email.

Guest RSVP on /edities/[slug] (only when eventDate is in the future and status PUBLISHED):
- A card at the top under the invite: "Ben je erbij?" with two buttons "Ja, ik kom!" / "Nee, helaas". If yes: a number input "Aantal introducés" (0–5, default 0) and optional note field ("Opmerking, bijv. dieetwensen"). Submits via server action, upserts the Rsvp row.
- After responding, show their current answer with an "Antwoord wijzigen" option. The state should feel friendly and confirm clearly ("Je staat op de lijst met 2 introducés").

Admin RSVP overview on /admin/edities/[id]/rsvps:
- Summary: X ja (+Y introducés = Z totaal), X nee, X nog geen antwoord (all users vs responded).
- Table: name, email, answer, guest count, note, last updated. Filter tabs: Alle / Ja / Nee / Geen antwoord.
- CSV export button.

Invite mailing, on the edition admin page:
- Button "Uitnodiging versturen". Opens a confirm step showing the recipient count (all GUEST + ADMIN users, or only users without an RSVP for this edition — radio choice) and a preview of the email.
- The email (Dutch): subject "Uitnodiging: [edition title]", body with title, date, location, the first ~2 paragraphs of invite text (plain-text rendering of inviteHtml), and a button "Bekijk uitnodiging & meld je aan" linking to APP_URL/edities/[slug].
- Send sequentially with a small delay (e.g. 200ms) between mails to be polite to the SMTP server; show progress and a final report (sent/failed per address). Record lastInviteSentAt on the edition.

Acceptance: guest can RSVP yes with 2 guests, change to no, admin sees live counts, CSV downloads, invite mail arrives with a working link.
```

---

## Prompt 8 — Polish pass

```
Read CLAUDE.md. Do a polish pass over the whole app. Do not add features.

- Review every page for visual consistency: spacing, typography scale, button styles, form styling, focus states, hover states.
- Mobile: test every page at 375px width; header collapses to a simple menu; lightbox and RSVP card work well on touch.
- Loading and error states: skeletons or spinners for slow pages, Dutch error messages everywhere (no raw English errors or stack traces reaching the UI), a friendly Dutch 404 page.
- Empty states with helpful text for: no editions yet (guest + admin), no users, no photos, no RSVPs.
- Accessibility basics: alt texts (photo alt = edition title + number), labels tied to inputs, lightbox focus trap, prefers-reduced-motion respected for transitions.
- Dutch copy review: consistent informal "je" form everywhere, no mixed English strings.
- Run the production build (npm run build) and fix all type errors and warnings.

Acceptance: clean production build, every page presentable on mobile and desktop.
```

---

## Prompt 9 — Deployment (VPS)

```
Read CLAUDE.md. Prepare deployment to a Linux VPS (Node via next start behind a reverse proxy).

1. Write DEPLOY.md with concrete steps:
   - Node LTS via nvm or system package, pnpm/npm.
   - Clone, cp .env.example .env, fill values (explain each: SESSION_SECRET generation command, R2 credentials location in Cloudflare dashboard, SMTP settings).
   - npm ci && npm run build && npm run db:deploy && npm run db:seed.
   - systemd service file (include the full unit file) running `node .next/standalone/server.js` with WorkingDirectory, EnvironmentFile=.env, Restart=always, a dedicated non-root user. Note: with output standalone, copy public/ and .next/static into the standalone folder — include those cp commands in the build step or a small deploy script.
   - Caddy config block (include it): reverse_proxy localhost:3000 with the domain, automatic HTTPS. Also include an nginx alternative block.
   - R2 bucket creation + CORS JSON (from CLAUDE.md) + creating an API token scoped to this bucket.
   - Backup: a cron line that copies data/app.db to a dated file nightly (sqlite3 .backup command) and keeps 14 days. Note that photos live in R2 and are not part of this backup.
   - Update procedure: git pull, build, migrate deploy, systemctl restart.
2. Add a deploy.sh script implementing build + static copy + restart steps.
3. Add a /api/health route returning {ok: true, db: true/false} for monitoring.
4. Double-check next.config for standalone output and that sharp works in production build.

Acceptance: DEPLOY.md is complete enough that following it top-to-bottom on a fresh VPS results in a running site.
```

---

## Tips while running these

- After each prompt, actually click through the acceptance criteria before continuing — Claude Code fixes issues much better while the context is fresh.
- If a prompt produces something you don't like visually, iterate with short follow-ups ("maak de hero rustiger", "meer witruimte in de galerij") before moving to the next prompt.
- Commit after every prompt: `git commit -m "prompt N: ..."` so you can roll back.
- Keep real secrets out of the repo; only .env.example gets committed.
