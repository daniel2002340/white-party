import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignedGetUrl } from "@/lib/r2";
import { PhotoStatus } from "@/lib/enums";
import { PhotoUploader } from "./photo-uploader";
import { PhotoGrid, type GridPhoto } from "./photo-grid";

export const metadata: Metadata = {
  title: "Foto's — White Party",
};

export default async function EditionPhotosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const edition = await prisma.edition.findUnique({
    where: { id },
    include: {
      photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!edition) notFound();

  // Presign short-lived thumbnail URLs for READY photos (admin view).
  const gridPhotos: GridPhoto[] = await Promise.all(
    edition.photos.map(async (photo) => ({
      id: photo.id,
      status: photo.status,
      isCover: edition.coverPhotoId === photo.id,
      thumbUrl:
        photo.status === PhotoStatus.READY
          ? await presignedGetUrl(photo.r2KeyThumb, 600)
          : null,
    }))
  );

  const readyCount = edition.photos.filter(
    (p) => p.status === PhotoStatus.READY
  ).length;

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
          <p className="eyebrow">Foto&apos;s</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">
            {edition.title}
          </h1>
        </div>
        <Link
          href={`/admin/edities/${edition.id}/bewerken`}
          className="text-sm text-secondary transition-colors hover:text-foreground"
        >
          Editie bewerken →
        </Link>
      </div>

      <p className="mt-4 text-sm text-secondary">
        {readyCount} {readyCount === 1 ? "foto" : "foto's"} klaar
        {edition.photos.length !== readyCount
          ? ` · ${edition.photos.length - readyCount} in verwerking`
          : ""}
        .
      </p>

      <div className="mt-8">
        <PhotoUploader editionId={edition.id} />
      </div>

      <PhotoGrid photos={gridPhotos} />
    </div>
  );
}
