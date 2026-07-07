import type { Metadata } from "next";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { formatShortDate } from "@/lib/dates";
import { EditionStatus, editionStatusLabel } from "@/lib/enums";
import { EditionRowActions } from "./edition-row-actions";

export const metadata: Metadata = {
  title: "Edities — White Party",
};

function statusBadgeVariant(
  status: string
): "default" | "success" | "accent" {
  if (status === EditionStatus.PUBLISHED) return "success";
  return "default";
}

export default async function AdminEditionsPage() {
  await requireAdmin();

  const editions = await prisma.edition.findMany({
    orderBy: { eventDate: "desc" },
    include: { _count: { select: { photos: true, rsvps: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Beheer</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">
            Edities
          </h1>
        </div>
        <Link href="/admin/edities/nieuw" className={buttonClassName()}>
          Nieuwe editie
        </Link>
      </div>

      <p className="mt-4 text-sm text-secondary">
        {editions.length} {editions.length === 1 ? "editie" : "edities"}.
      </p>

      {editions.length === 0 ? (
        <p className="mt-10 text-secondary">
          Er zijn nog geen edities. Maak de eerste aan.
        </p>
      ) : (
        <div className="mt-8 border-t border-border">
          {editions.map((edition) => (
            <div
              key={edition.id}
              className="flex flex-wrap items-center gap-4 border-b border-border py-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {edition.title}
                  </span>
                  <Badge variant={statusBadgeVariant(edition.status)}>
                    {editionStatusLabel[edition.status] ?? edition.status}
                  </Badge>
                </div>
                <div className="mt-0.5 text-sm text-secondary">
                  {formatShortDate(edition.eventDate)}
                  {edition.location ? ` · ${edition.location}` : ""}
                </div>
              </div>

              <div className="hidden text-sm text-muted sm:block">
                {edition._count.photos}{" "}
                {edition._count.photos === 1 ? "foto" : "foto's"}
              </div>
              <div className="hidden text-sm text-muted sm:block">
                {edition._count.rsvps} RSVP
                {edition._count.rsvps === 1 ? "" : "'s"}
              </div>

              <EditionRowActions editionId={edition.id} title={edition.title} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
