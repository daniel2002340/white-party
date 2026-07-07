import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { formatLongDateTime } from "@/lib/dates";

const SITE_NAME = "White Party";

export type MailInput = {
  to: string;
  subject: string;
  html: string; // the content block; wrapped in the shared layout by sendMail
  text?: string; // optional plain-text alternative (derived from html if omitted)
};

// Build a transport from SMTP_* env vars, or null if SMTP is not configured.
function getTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // implicit TLS on 465, STARTTLS otherwise
    auth: user ? { user, pass } : undefined,
  });
}

// Shared, simple Dutch email layout. Inline styles only (email-safe), no
// external images. Palette mirrors the site design system.
function renderLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
  <body style="margin:0;padding:0;background-color:#FAFAF7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAF7;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:480px;">
            <tr>
              <td style="padding:0 4px 20px 4px;font-family:Arial,Helvetica,sans-serif;">
                <span style="font-size:20px;font-weight:700;color:#1B1B1B;">${SITE_NAME}<span style="color:#A8823C;">.</span></span>
              </td>
            </tr>
            <tr>
              <td style="background-color:#FFFFFF;border:1px solid #E9E8E3;border-radius:6px;padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1B1B1B;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 4px 0 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#98989D;">
                ${SITE_NAME} — alleen op uitnodiging.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Naive HTML-to-text fallback for clients that prefer plain text.
function htmlToText(html: string): string {
  return html
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Send an email. The `html` argument is the content block; it is wrapped in the
 * shared Dutch layout. If SMTP is not configured, we log the email to the
 * console in development (rather than failing); in production a missing SMTP
 * configuration throws, so callers can fall back appropriately.
 */
export async function sendMail({ to, subject, html, text }: MailInput): Promise<void> {
  const from = process.env.SMTP_FROM || `${SITE_NAME} <noreply@localhost>`;
  const fullHtml = renderLayout(html);
  const fullText = text ?? htmlToText(html);

  const transport = getTransport();
  if (!transport) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP is niet geconfigureerd (SMTP_HOST ontbreekt).");
    }
    // Development fallback: log instead of sending.
    console.log(
      [
        "",
        "──────── EMAIL (dev, SMTP niet geconfigureerd) ────────",
        `Van:      ${from}`,
        `Aan:      ${to}`,
        `Onderwerp: ${subject}`,
        "",
        fullText,
        "───────────────────────────────────────────────────────",
        "",
      ].join("\n")
    );
    return;
  }

  await transport.sendMail({ from, to, subject, html: fullHtml, text: fullText });
}

/**
 * Send the "your account" invite email to a new (or reset) user, in Dutch.
 * Contains their email, temporary password, a login link, and a note that they
 * must set their own password on first login. Throws if delivery fails.
 */
export async function sendAccountEmail(params: {
  to: string;
  name: string | null;
  tempPassword: string;
}): Promise<void> {
  const { to, name, tempPassword } = params;
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const loginUrl = `${appUrl}/login`;
  const greeting = name ? `Hoi ${escapeHtml(name)},` : "Hoi,";

  const content = `
    <p style="margin:0 0 16px 0;">${greeting}</p>
    <p style="margin:0 0 16px 0;">Je bent uitgenodigd voor de <strong>${SITE_NAME}</strong>. We hebben een account voor je aangemaakt op de feestwebsite, waar je de uitnodiging kunt bekijken, je aanwezigheid kunt doorgeven en foto&#39;s van eerdere edities kunt bekijken.</p>
    <p style="margin:0 0 8px 0;">Je inloggegevens:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;background-color:#FAFAF7;border:1px solid #E9E8E3;border-radius:6px;">
      <tr><td style="padding:14px 16px;font-family:'Courier New',Courier,monospace;font-size:14px;color:#1B1B1B;line-height:1.7;">
        E-mailadres:&nbsp;<strong>${escapeHtml(to)}</strong><br />
        Tijdelijk wachtwoord:&nbsp;<strong>${escapeHtml(tempPassword)}</strong>
      </td></tr>
    </table>
    <p style="margin:0 0 20px 0;">
      <a href="${loginUrl}" style="display:inline-block;background-color:#1B1B1B;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:6px;">Inloggen</a>
    </p>
    <p style="margin:0;color:#5A5A5F;font-size:14px;">Bij je eerste keer inloggen vragen we je om zelf een nieuw wachtwoord in te stellen. Inloggen kan ook via <a href="${loginUrl}" style="color:#8A6A2F;">${loginUrl}</a>.</p>
  `;

  await sendMail({
    to,
    subject: `Je account voor ${SITE_NAME}`,
    html: content,
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Invite mailing ----

export type InviteEdition = {
  title: string;
  slug: string;
  eventDate: Date;
  location: string | null;
  inviteHtml: string | null;
};

/**
 * Plain-text rendering of the first ~`max` paragraphs of the invite HTML,
 * used in the invite email body and the admin preview.
 */
export function invitePreviewParagraphs(
  inviteHtml: string | null,
  max = 2
): string[] {
  if (!inviteHtml) return [];
  const text = inviteHtml
    .replace(/<\/(p|h1|h2|h3|li|ul|ol)>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Build the invite email (subject + content) for an edition. Returned pieces
 * are reused by the admin preview so the preview matches what is sent.
 */
export function buildInviteEmail(edition: InviteEdition) {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const url = `${appUrl}/edities/${edition.slug}`;
  const dateText = formatLongDateTime(edition.eventDate);
  const paragraphs = invitePreviewParagraphs(edition.inviteHtml);
  const subject = `Uitnodiging: ${edition.title}`;

  const paragraphsHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;color:#5A5A5F;">${escapeHtml(p)}</p>`
    )
    .join("");

  const content = `
    <p style="margin:0 0 20px 0;">Je bent uitgenodigd voor de <strong>${SITE_NAME}</strong>:</p>
    <p style="margin:0 0 4px 0;font-size:24px;font-weight:700;color:#1B1B1B;">${escapeHtml(edition.title)}</p>
    <p style="margin:0 0 20px 0;color:#5A5A5F;">${escapeHtml(dateText)}${
      edition.location ? ` &middot; ${escapeHtml(edition.location)}` : ""
    }</p>
    ${paragraphsHtml}
    <p style="margin:24px 0 4px 0;">
      <a href="${url}" style="display:inline-block;background-color:#1B1B1B;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:6px;">Bekijk uitnodiging &amp; meld je aan</a>
    </p>
  `;

  return { subject, content, url, dateText, paragraphs };
}

/**
 * Send the invite email for an edition to one recipient. Throws on delivery
 * failure so the caller can record it in the send report.
 */
export async function sendInviteEmail(params: {
  to: string;
  edition: InviteEdition;
}): Promise<void> {
  const { to, edition } = params;
  const { subject, content } = buildInviteEmail(edition);
  await sendMail({ to, subject, html: content });
}
