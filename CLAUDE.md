# Project: White Party (party website)

A private website for a recurring party called "White Party" (dresscode: wit). Guests log in to view an invite + RSVP for the upcoming edition, and browse photo galleries of past editions. An admin manages editions, photos, and user accounts.

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

## Design system ("White Party" — bright, elegant, editorial; think engraved fashion invitation, not SaaS dashboard)

Defined as CSS variables / Tailwind theme tokens in globals.css. Apply everywhere, follow exactly. All pages are built from the ui primitives (Button, Input, Label, Card, Badge).

- Page background: warm white #FAFAF7. Cards/raised surfaces: #FFFFFF with
  1px border #E9E8E3 and a very subtle shadow (0 1px 2px rgba(0,0,0,0.04)).
- Text: primary #1B1B1B, secondary #5A5A5F, muted #98989D.
- Single accent: champagne gold #A8823C — used ONLY for eyebrow labels, the
  wordmark dot, hairline details, active/focus states. Never as a button
  background, never for large areas.
- Buttons: primary = solid #1B1B1B with white text (hover #333333);
  secondary = white with 1px #D9D8D2 border. Border-radius 6px.
- Fonts via next/font/google: Fraunces (500/600/700) for headings and the
  wordmark; Inter for all body/UI text.
- Header wordmark: "White Party" in Fraunces 600 with a gold period after it.
- Editorial poster feel: edition titles very large (clamp 40–72px) in
  Fraunces, tight line-height (1.05); eyebrow labels 11px uppercase with
  0.2em letter-spacing in gold; dates/locations small and quiet beneath.
- Prefer hairline rules (1px #E9E8E3) and whitespace as separators over
  boxes-in-boxes. Generous vertical whitespace throughout.
- Photos (for later prompts): edge-to-edge grid, 4px gaps, no borders or
  shadows on photos, hover scale 1.02. Past-edition cards: cover photo with
  a subtle bottom scrim and the year as a large white Fraunces numeral,
  bottom-left. Lightbox: pure black background, white controls that fade
  after 1.5s of inactivity.
- No gradients, no emoji in headings, no decorative illustrations, no gray
  dashboard aesthetics. Restraint and whitespace carry the elegance.
- Gold as *text* must stay ≥ AA contrast on white; darken toward #8A6A2F
  if needed at small sizes.

## Conventions
- Server Actions for mutations where natural; route handlers for uploads/downloads.
- Zod for validating all external input (forms, route handlers).
- All pages behind login except /login and /wachtwoord-instellen (set password).
- Environment variables documented in .env.example, never committed with real values.

## Photos & R2
- The R2 bucket is PRIVATE. It must NOT be public. Every read/write goes through
  a presigned URL or a server-side call in lib/r2.ts — never a public object URL.
- Object layout: `editions/{editionId}/orig|web|thumb/{photoId}.{ext}`.
- Direct browser PUT uploads require CORS on the R2 bucket. In the Cloudflare
  dashboard (R2 → your bucket → Settings → CORS policy), paste the following,
  replacing the origin with your APP_URL (add the production origin too):

  ```json
  [
    {
      "AllowedOrigins": ["http://localhost:3000"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["content-type"],
      "ExposeHeaders": [],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

- Dev fallback: when the R2_* env vars are unset and NODE_ENV !== production,
  lib/r2.ts stores objects on local disk under ./data/r2-dev and serves them via
  the dev-only /api/dev-r2 route (returns 404 in production). This mirrors the
  SMTP fallback and lets the full upload pipeline run locally without R2.
