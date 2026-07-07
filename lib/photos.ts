import "server-only";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { PhotoStatus } from "@/lib/enums";
import { getObjectBuffer, putObjectBuffer } from "@/lib/r2";

export const MAX_PHOTO_BYTES = 30 * 1024 * 1024; // 30 MB

// Accepted upload MIME types mapped to the extension used for the original.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

export const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

const WEB_MAX_EDGE = 1800;
const THUMB_MAX_EDGE = 400;

// ---- R2 key builders ----

export function origKey(editionId: string, photoId: string, ext: string): string {
  return `editions/${editionId}/orig/${photoId}.${ext}`;
}
export function webKey(editionId: string, photoId: string): string {
  return `editions/${editionId}/web/${photoId}.jpg`;
}
export function thumbKey(editionId: string, photoId: string): string {
  return `editions/${editionId}/thumb/${photoId}.jpg`;
}

/**
 * Whether sharp in this environment can decode HEIC/HEIF. The prebuilt sharp
 * binaries often ship without the HEVC codec, so we detect and reject rather
 * than fail silently at process time.
 */
let heicSupportCache: boolean | null = null;
export function heicDecodeSupported(): boolean {
  if (heicSupportCache === null) {
    heicSupportCache = Boolean(sharp.format.heif?.input?.buffer);
  }
  return heicSupportCache;
}

/**
 * Process an uploaded original into web + thumbnail JPEGs:
 * auto-rotate by EXIF, strip metadata, resize, store derivatives in R2, and
 * record the web dimensions. Sets status READY on success, FAILED on error.
 * Node runtime only (sharp).
 */
export async function processPhoto(photoId: string): Promise<void> {
  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) throw new Error(`Photo ${photoId} not found`);

  try {
    await prisma.photo.update({
      where: { id: photoId },
      data: { status: PhotoStatus.PROCESSING },
    });

    const original = await getObjectBuffer(photo.r2Key);

    // .rotate() with no args applies EXIF orientation; sharp strips metadata
    // from the output by default (we never call withMetadata).
    const web = await sharp(original)
      .rotate()
      .resize(WEB_MAX_EDGE, WEB_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

    const thumb = await sharp(original)
      .rotate()
      .resize(THUMB_MAX_EDGE, THUMB_MAX_EDGE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 75 })
      .toBuffer();

    const keyWeb = webKey(photo.editionId, photo.id);
    const keyThumb = thumbKey(photo.editionId, photo.id);

    await putObjectBuffer(keyWeb, web.data, "image/jpeg");
    await putObjectBuffer(keyThumb, thumb, "image/jpeg");

    await prisma.photo.update({
      where: { id: photoId },
      data: {
        r2KeyWeb: keyWeb,
        r2KeyThumb: keyThumb,
        width: web.info.width,
        height: web.info.height,
        status: PhotoStatus.READY,
      },
    });
  } catch (error) {
    console.error(`Photo processing failed for ${photoId}:`, error);
    await prisma.photo
      .update({ where: { id: photoId }, data: { status: PhotoStatus.FAILED } })
      .catch(() => {});
    throw error;
  }
}
