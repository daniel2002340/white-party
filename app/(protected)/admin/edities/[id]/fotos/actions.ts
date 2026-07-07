"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { deleteObject } from "@/lib/r2";
import { PhotoStatus } from "@/lib/enums";

function fotosPath(editionId: string): string {
  return `/admin/edities/${editionId}/fotos`;
}

export async function movePhoto(formData: FormData): Promise<void> {
  await requireAdmin();

  const photoId = String(formData.get("photoId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!photoId || (direction !== "up" && direction !== "down")) return;

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) return;

  const photos = await prisma.photo.findMany({
    where: { editionId: photo.editionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const index = photos.findIndex((p) => p.id === photoId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= photos.length) return;

  // Swap, then re-index the whole list so sortOrder stays contiguous
  // (robust against any legacy equal/zero values).
  [photos[index], photos[target]] = [photos[target], photos[index]];
  await prisma.$transaction(
    photos.map((p, i) =>
      prisma.photo.update({ where: { id: p.id }, data: { sortOrder: i } })
    )
  );

  revalidatePath(fotosPath(photo.editionId));
}

export async function setCoverPhoto(formData: FormData): Promise<void> {
  await requireAdmin();

  const photoId = String(formData.get("photoId") ?? "");
  if (!photoId) return;

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo || photo.status !== PhotoStatus.READY) return;

  await prisma.edition.update({
    where: { id: photo.editionId },
    data: { coverPhotoId: photo.id },
  });

  revalidatePath(fotosPath(photo.editionId));
}

export async function deletePhoto(formData: FormData): Promise<void> {
  await requireAdmin();

  const photoId = String(formData.get("photoId") ?? "");
  if (!photoId) return;

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) return;

  // Remove all three R2 objects (skip keys that were never set).
  const keys = [photo.r2Key, photo.r2KeyWeb, photo.r2KeyThumb].filter(Boolean);
  await Promise.all(keys.map((key) => deleteObject(key).catch(() => {})));

  // Clear the cover reference if this photo was the cover.
  await prisma.edition.updateMany({
    where: { id: photo.editionId, coverPhotoId: photo.id },
    data: { coverPhotoId: null },
  });

  await prisma.photo.delete({ where: { id: photo.id } });

  revalidatePath(fotosPath(photo.editionId));
}
