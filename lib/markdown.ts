import "server-only";
import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

// A limited markdown flavour for invite content: headings, bold, italic,
// links and lists. Everything else is stripped by the sanitizer, so raw HTML
// in the source cannot survive.
const marked = new Marked({ async: false, gfm: true, breaks: true });

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "a",
  "ul",
  "ol",
  "li",
];

/**
 * Render admin-authored markdown to sanitized, display-safe HTML.
 * Returns "" for empty input. Runs server-side only.
 */
export function renderInviteHtml(markdownSource: string): string {
  const trimmed = markdownSource.trim();
  if (!trimmed) return "";

  const rawHtml = marked.parse(trimmed) as string;

  return sanitizeHtml(rawHtml, {
    allowedTags: ALLOWED_TAGS,
    // rel/target must be allowed here or the transform below is stripped.
    allowedAttributes: { a: ["href", "title", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    // External links open safely in a new tab.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
  }).trim();
}
