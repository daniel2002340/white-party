import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toDatetimeLocalValue } from "@/lib/dates";
import { buildInviteEmail } from "@/lib/email";
import { EditionStatus } from "@/lib/enums";
import { EditionForm } from "../../edition-form";
import { InviteSender } from "../invite-sender";

export const metadata: Metadata = {
  title: "Editie bewerken — White Party",
};

const sentFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function EditEditionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const edition = await prisma.edition.findUnique({ where: { id } });
  if (!edition) notFound();

  // Recipient lists for the invite mailing.
  const [allUsers, rsvps] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, name: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
    }),
    prisma.rsvp.findMany({
      where: { editionId: edition.id },
      select: { userId: true },
    }),
  ]);
  const respondedIds = new Set(rsvps.map((r) => r.userId));
  const pendingRecipients = allUsers.filter((u) => !respondedIds.has(u.id));

  const email = buildInviteEmail(edition);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/admin/edities"
        className="text-sm text-secondary transition-colors hover:text-foreground"
      >
        ← Terug naar edities
      </Link>

      <p className="eyebrow mt-8">Beheer</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">
        Editie bewerken
      </h1>
      <p className="mt-4 flex flex-wrap gap-4 text-sm text-secondary">
        <Link
          href={`/edities/${edition.slug}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Bekijk deze editie →
        </Link>
        <Link
          href={`/admin/edities/${edition.id}/fotos`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          Foto&apos;s beheren →
        </Link>
        <Link
          href={`/admin/edities/${edition.id}/rsvps`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          RSVP&apos;s bekijken →
        </Link>
      </p>

      <EditionForm
        defaults={{
          id: edition.id,
          title: edition.title,
          slug: edition.slug,
          eventDate: edition.eventDate
            ? toDatetimeLocalValue(edition.eventDate)
            : "",
          dateUnknown: edition.eventDate === null,
          location: edition.location ?? "",
          inviteMarkdown: edition.inviteMarkdown ?? "",
        }}
      />

      <InviteSender
        editionId={edition.id}
        isPublished={edition.status === EditionStatus.PUBLISHED}
        allRecipients={allUsers}
        pendingRecipients={pendingRecipients}
        preview={{
          subject: email.subject,
          title: edition.title,
          dateText: email.dateText,
          location: edition.location,
          paragraphs: email.paragraphs,
          url: email.url,
        }}
        lastInviteSentAt={
          edition.lastInviteSentAt
            ? sentFormatter.format(edition.lastInviteSentAt)
            : null
        }
      />
    </div>
  );
}
