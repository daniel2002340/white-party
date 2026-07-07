import { NextResponse } from "next/server";
import { isLocalR2, getObjectBuffer, putObjectBuffer } from "@/lib/r2";

export const runtime = "nodejs";

// Dev-only stand-in for R2 object storage. Active ONLY when R2 is unconfigured
// and NODE_ENV !== production (see lib/r2.ts). Returns 404 otherwise so it can
// never serve as a public bucket in production. Storage itself is delegated to
// lib/r2 (which owns all filesystem access) so this route stays fs-free.

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
};

// Join the catch-all segments into an R2-style key, rejecting traversal.
function joinKey(segments: string[]): string | null {
  if (segments.some((s) => s === ".." || s.includes("/") || s.includes("\\"))) {
    return null;
  }
  return segments.join("/");
}

function contentTypeFor(key: string): string {
  const dot = key.lastIndexOf(".");
  const ext = dot >= 0 ? key.slice(dot).toLowerCase() : "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  if (!isLocalR2()) return new NextResponse(null, { status: 404 });

  const { key } = await params;
  const objectKey = joinKey(key);
  if (!objectKey) return new NextResponse(null, { status: 400 });

  const body = Buffer.from(await request.arrayBuffer());
  await putObjectBuffer(objectKey, body, contentTypeFor(objectKey));

  return new NextResponse(null, { status: 200 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  if (!isLocalR2()) return new NextResponse(null, { status: 404 });

  const { key } = await params;
  const objectKey = joinKey(key);
  if (!objectKey) return new NextResponse(null, { status: 400 });

  let data: Buffer;
  try {
    data = await getObjectBuffer(objectKey);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  const headers: Record<string, string> = {
    "content-type": contentTypeFor(objectKey),
    "cache-control": "private, max-age=60",
  };
  // Mirror R2's response-content-disposition override for downloads.
  const download = new URL(request.url).searchParams.get("download");
  if (download) {
    headers["content-disposition"] = `attachment; filename="${download}"`;
  }
  return new NextResponse(new Uint8Array(data), { status: 200, headers });
}
