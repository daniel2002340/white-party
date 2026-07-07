import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { presignedPutUrl } from "@/lib/r2";
import {
  ALLOWED_IMAGE_TYPES,
  HEIC_TYPES,
  MAX_PHOTO_BYTES,
  heicDecodeSupported,
  origKey,
} from "@/lib/photos";
import { PhotoStatus } from "@/lib/enums";

export const runtime = "nodejs";

const PresignSchema = z.object({
  editionId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  const parsed = PresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  const { editionId, contentType, size } = parsed.data;

  const edition = await prisma.edition.findUnique({ where: { id: editionId } });
  if (!edition) {
    return NextResponse.json({ error: "Editie niet gevonden." }, { status: 404 });
  }

  // HEIC needs a decoder that may not be present; reject clearly rather than
  // failing silently later during processing.
  if (HEIC_TYPES.has(contentType) && !heicDecodeSupported()) {
    return NextResponse.json(
      {
        error:
          "HEIC-bestanden worden hier niet ondersteund. Exporteer de foto als JPEG en probeer opnieuw.",
      },
      { status: 415 }
    );
  }

  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) {
    return NextResponse.json(
      { error: "Alleen JPEG, PNG, WebP of HEIC is toegestaan." },
      { status: 415 }
    );
  }

  if (size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: "Bestand is te groot (max 30 MB)." },
      { status: 413 }
    );
  }

  // Append to the end of the edition's current ordering.
  const agg = await prisma.photo.aggregate({
    where: { editionId },
    _max: { sortOrder: true },
  });
  const sortOrder = (agg._max.sortOrder ?? -1) + 1;

  // Create the row first so we own the id used in the key.
  const photo = await prisma.photo.create({
    data: {
      editionId,
      r2Key: "", // set below once we know the id
      r2KeyWeb: "",
      r2KeyThumb: "",
      width: 0,
      height: 0,
      sizeBytes: size,
      sortOrder,
      status: PhotoStatus.UPLOADING,
    },
  });

  const key = origKey(editionId, photo.id, ext);
  await prisma.photo.update({ where: { id: photo.id }, data: { r2Key: key } });

  const uploadUrl = await presignedPutUrl(key, contentType, MAX_PHOTO_BYTES);

  return NextResponse.json({ photoId: photo.id, uploadUrl, key });
}
