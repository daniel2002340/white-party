import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 access. The bucket is PRIVATE: every read/write goes through a
// presigned URL or a server-side call here — never a public object URL.
//
// Dev fallback: when R2 is not configured and we're not in production, objects
// live on local disk under ./data/r2-dev and "presigned" URLs point at the
// dev-only /api/dev-r2 route. This mirrors the SMTP fallback in lib/email.ts so
// the whole pipeline is runnable locally. Production always uses real R2.

const BUCKET = process.env.R2_BUCKET ?? "";
const PUT_EXPIRY_SECONDS = 600; // 10 min to complete a direct browser upload

export function isLocalR2(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (!process.env.R2_ENDPOINT ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY ||
      !process.env.R2_BUCKET)
  );
}

let cachedClient: S3Client | null = null;
function client(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
      },
      // R2 works most reliably with path-style addressing.
      forcePathStyle: true,
      // The AWS SDK adds a default CRC32 checksum to PutObject, which injects
      // x-amz-checksum-* params into presigned URLs and breaks direct browser
      // PUTs to R2 (the checksum is computed over an empty body at sign time).
      // Only add checksums when the operation actually requires them.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return cachedClient;
}

// ---- Local dev-fallback storage ----

function localPath(key: string): string {
  // Keys are already constrained to editions/{id}/{variant}/{photoId}.{ext}.
  // process.cwd() is resolved lazily (not at module scope) to keep the
  // production file tracer from treating it as a dynamic project root.
  return path.join(process.cwd(), "data", "r2-dev", key);
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

// ---- Public helpers ----

/**
 * Presigned URL for a direct browser PUT. `maxSize` is enforced by the caller
 * (the presign route rejects oversized reported sizes; the process step
 * re-checks the actual byte length). Binds Content-Type into the signature.
 */
export async function presignedPutUrl(
  key: string,
  contentType: string,
  maxSize: number
): Promise<string> {
  if (maxSize <= 0) throw new Error("maxSize must be positive");

  if (isLocalR2()) {
    return `${appUrl()}/api/dev-r2/${key}`;
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client(), command, { expiresIn: PUT_EXPIRY_SECONDS });
}

/**
 * Short-lived presigned URL for reading an object. Pass `downloadFilename` to
 * force a download (Content-Disposition: attachment) with that filename — used
 * by the lightbox download button so it works even cross-origin.
 */
export async function presignedGetUrl(
  key: string,
  expiresSeconds = 3600,
  downloadFilename?: string
): Promise<string> {
  if (isLocalR2()) {
    const base = `${appUrl()}/api/dev-r2/${key}`;
    return downloadFilename
      ? `${base}?download=${encodeURIComponent(downloadFilename)}`
      : base;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: downloadFilename
      ? `attachment; filename="${downloadFilename}"`
      : undefined,
  });
  return getSignedUrl(client(), command, { expiresIn: expiresSeconds });
}

/** Upload a buffer server-side (used for processed derivatives). */
export async function putObjectBuffer(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (isLocalR2()) {
    const file = localPath(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
    return;
  }

  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

/** Download an object into a Buffer (used to process the original). */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  if (isLocalR2()) {
    return fs.readFile(localPath(key));
  }

  const response = await client().send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  const bytes = await response.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

/** Delete an object. Missing objects are ignored. */
export async function deleteObject(key: string): Promise<void> {
  if (isLocalR2()) {
    await fs.rm(localPath(key), { force: true });
    return;
  }

  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
