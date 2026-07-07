import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserApi } from "@/lib/auth";
import { presignedGetUrl } from "@/lib/r2";
import { EditionStatus, PhotoStatus, UserRole } from "@/lib/enums";

export const runtime = "nodejs";

// Short-lived read URL for a single photo variant. Used by guest-facing pages.
const URL_TTL_SECONDS = 600; // 10 minutes

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUserApi();
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const { id } = await params;
  const variant =
    new URL(request.url).searchParams.get("variant") === "web" ? "web" : "thumb";

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: { edition: { select: { status: true } } },
  });
  if (!photo) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  // Guests may only read photos of a published edition.
  const isAdmin = user.role === UserRole.ADMIN;
  if (photo.edition.status !== EditionStatus.PUBLISHED && !isAdmin) {
    return NextResponse.json({ error: "Niet gevonden." }, { status: 404 });
  }

  if (photo.status !== PhotoStatus.READY) {
    return NextResponse.json({ error: "Foto is nog niet klaar." }, { status: 404 });
  }

  const key = variant === "web" ? photo.r2KeyWeb : photo.r2KeyThumb;
  const url = await presignedGetUrl(key, URL_TTL_SECONDS);

  return NextResponse.json({ url });
}
