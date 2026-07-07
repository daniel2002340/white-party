import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignedGetUrl } from "@/lib/r2";
import { formatLongDateTime, formatShortDateTime } from "@/lib/dates";
import { EditionStatus, editionStatusLabel, PhotoStatus, UserRole } from "@/lib/enums";
import {
  PhotoGallery,
  type GalleryPhoto,
  type PhotoComments,
} from "@/components/photo-gallery";
import { CommentSection, type CommentView } from "@/components/comment-section";
import { RsvpCard } from "./rsvp-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const edition = await prisma.edition.findUnique({
    where: { slug },
    select: { title: true },
  });
  return { title: edition ? `${edition.title} — White Party` : "White Party" };
}

export default async function EditionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;

  const edition = await prisma.edition.findUnique({ where: { slug } });
  if (!edition) notFound();

  const isAdmin = user.role === UserRole.ADMIN;
  const isPublished = edition.status === EditionStatus.PUBLISHED;

  // Guests can only see published editions; drafts/archived are 404 for them.
  if (!isPublished && !isAdmin) notFound();

  // RSVP is available only for a published edition that is still upcoming.
  const rsvpOpen =
    isPublished && edition.eventDate.getTime() > new Date().getTime();
  const existingRsvp = rsvpOpen
    ? await prisma.rsvp.findUnique({
        where: { userId_editionId: { userId: user.id, editionId: edition.id } },
        select: { attending: true, guestCount: true, note: true },
      })
    : null;

  // All READY photos, in display order.
  const photos = await prisma.photo.findMany({
    where: { editionId: edition.id, status: PhotoStatus.READY },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, r2KeyThumb: true, r2KeyWeb: true, width: true, height: true },
  });

  // Presign every URL server-side in one pass — thumb (grid), web (lightbox),
  // and a forced-download variant. No per-image client fetching. Valid 1 hour.
  const galleryPhotos: GalleryPhoto[] = await Promise.all(
    photos.map(async (photo, i) => ({
      id: photo.id,
      width: photo.width,
      height: photo.height,
      thumbUrl: await presignedGetUrl(photo.r2KeyThumb, 3600),
      webUrl: await presignedGetUrl(photo.r2KeyWeb, 3600),
      downloadUrl: await presignedGetUrl(
        photo.r2KeyWeb,
        3600,
        `${edition.slug}-${i + 1}.jpg`
      ),
    }))
  );

  // All comments for this edition, oldest-first so they read as a thread.
  // photoId === null → edition-level; otherwise grouped under that photo.
  const commentRows = await prisma.comment.findMany({
    where: { editionId: edition.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  const toView = (row: (typeof commentRows)[number]): CommentView => ({
    id: row.id,
    body: row.body,
    authorName: row.user.name ?? row.user.email,
    createdAtLabel: formatShortDateTime(row.createdAt),
    isOwn: row.userId === user.id,
  });

  const editionComments = commentRows.filter((r) => r.photoId === null).map(toView);

  const photoComments: PhotoComments = {
    editionId: edition.id,
    slug: edition.slug,
    canModerate: isAdmin,
    byPhotoId: commentRows.reduce<Record<string, CommentView[]>>((acc, row) => {
      if (row.photoId === null) return acc;
      (acc[row.photoId] ??= []).push(toView(row));
      return acc;
    }, {}),
  };

  return (
    <div className="py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-6">
        {/* Admin-only banner when viewing a non-published edition. */}
        {!isPublished ? (
          <div className="mb-8 rounded-[var(--radius)] border border-border bg-surface px-4 py-3 text-sm text-secondary">
            <span className="font-medium text-foreground">
              {editionStatusLabel[edition.status] ?? edition.status}
            </span>{" "}
            — deze editie is nog niet zichtbaar voor gasten.
          </div>
        ) : null}

        <p className="eyebrow">White Party</p>
        <h1 className="poster-title mt-5">{edition.title}</h1>

        <p className="mt-5 text-lg text-secondary">
          {formatLongDateTime(edition.eventDate)}
          {edition.location ? (
            <>
              <span className="mx-2 text-border">·</span>
              {edition.location}
            </>
          ) : null}
        </p>

        {edition.inviteHtml ? (
          <div
            className="invite-content mt-12"
            dangerouslySetInnerHTML={{ __html: edition.inviteHtml }}
          />
        ) : null}

        {rsvpOpen ? (
          <RsvpCard
            editionId={edition.id}
            slug={edition.slug}
            initialRsvp={existingRsvp}
          />
        ) : null}
      </div>

      {/* Photo gallery — wider than the reading column, edge-to-edge grid. */}
      <section className="mx-auto mt-16 max-w-6xl px-6">
        <div className="border-t border-border pt-10">
          <p className="eyebrow">Foto&apos;s</p>
        </div>
        {galleryPhotos.length > 0 ? (
          <div className="mt-6">
            <PhotoGallery
              photos={galleryPhotos}
              filenamePrefix={edition.slug}
              altPrefix={edition.title}
              comments={photoComments}
            />
          </div>
        ) : (
          <p className="mt-3 text-secondary">
            Nog geen foto&apos;s — die volgen na het feest!
          </p>
        )}
      </section>

      {/* Edition-level comments. */}
      <section className="mx-auto mt-16 max-w-3xl px-6">
        <div className="border-t border-border pt-10">
          <p className="eyebrow">Reacties</p>
        </div>
        <div className="mt-6">
          <CommentSection
            editionId={edition.id}
            slug={edition.slug}
            comments={editionComments}
            canModerate={isAdmin}
            tone="light"
          />
        </div>
      </section>
    </div>
  );
}
