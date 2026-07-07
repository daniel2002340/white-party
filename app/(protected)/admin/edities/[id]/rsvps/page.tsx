import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadRsvpRows, summarize, type RsvpRow } from "./data";

export const metadata: Metadata = {
  title: "RSVP's — White Party",
};

const FILTERS = [
  { key: "alle", label: "Alle" },
  { key: "ja", label: "Ja" },
  { key: "nee", label: "Nee" },
  { key: "geen", label: "Geen antwoord" },
] as const;

const updatedFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function matchesFilter(row: RsvpRow, filter: string): boolean {
  if (filter === "ja") return row.attending === true;
  if (filter === "nee") return row.attending === false;
  if (filter === "geen") return row.attending === null;
  return true;
}

export default async function RsvpsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { filter: rawFilter } = await searchParams;
  const filter = FILTERS.some((f) => f.key === rawFilter) ? rawFilter! : "alle";

  const edition = await prisma.edition.findUnique({ where: { id } });
  if (!edition) notFound();

  const rows = await loadRsvpRows(id);
  const summary = summarize(rows);
  const visible = rows.filter((r) => matchesFilter(r, filter));

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <Link
        href="/admin/edities"
        className="text-sm text-secondary transition-colors hover:text-foreground"
      >
        ← Terug naar edities
      </Link>

      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">RSVP&apos;s</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">
            {edition.title}
          </h1>
        </div>
        <a
          href={`/admin/edities/${id}/rsvps/export`}
          className={buttonClassName({ variant: "secondary" })}
        >
          Exporteer CSV
        </a>
      </div>

      {/* Summary */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-[var(--radius)] border border-border bg-surface p-5 shadow-card">
          <p className="text-sm text-secondary">Ja</p>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">
            {summary.yes}
          </p>
          <p className="mt-1 text-sm text-muted">
            +{summary.guests} introducés = {summary.total} totaal
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-5 shadow-card">
          <p className="text-sm text-secondary">Nee</p>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">
            {summary.no}
          </p>
        </div>
        <div className="rounded-[var(--radius)] border border-border bg-surface p-5 shadow-card">
          <p className="text-sm text-secondary">Nog geen antwoord</p>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">
            {summary.noAnswer}
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mt-10 flex flex-wrap gap-2 border-b border-border pb-3">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/edities/${id}/rsvps${f.key === "alle" ? "" : `?filter=${f.key}`}`}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              filter === f.key
                ? "bg-ink text-white"
                : "text-secondary hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <p className="mt-8 text-secondary">Geen resultaten voor dit filter.</p>
      ) : (
        <div className="mt-2">
          {visible.map((row) => (
            <div
              key={row.userId}
              className="flex flex-wrap items-center gap-4 border-b border-border py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">
                  {row.name ?? "—"}
                </div>
                <div className="truncate text-sm text-secondary">{row.email}</div>
                {row.note ? (
                  <div className="mt-1 text-sm text-muted">“{row.note}”</div>
                ) : null}
              </div>

              <div className="w-16 text-sm">
                {row.attending === true ? (
                  <Badge variant="success">Ja</Badge>
                ) : row.attending === false ? (
                  <Badge>Nee</Badge>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>

              <div className="hidden w-24 text-sm text-muted sm:block">
                {row.attending === true
                  ? `${row.guestCount} introducé${row.guestCount === 1 ? "" : "s"}`
                  : ""}
              </div>

              <div className="hidden w-40 text-right text-sm text-muted md:block">
                {row.updatedAt ? updatedFormatter.format(row.updatedAt) : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
