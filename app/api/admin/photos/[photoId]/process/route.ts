import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { processPhoto } from "@/lib/photos";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> }
) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { photoId } = await params;

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo) {
    return NextResponse.json({ error: "Foto niet gevonden." }, { status: 404 });
  }

  try {
    await processPhoto(photoId);
    return NextResponse.json({ ok: true, status: "READY" });
  } catch {
    // processPhoto already logged and set status FAILED.
    return NextResponse.json(
      { ok: false, status: "FAILED", error: "Verwerking mislukt." },
      { status: 500 }
    );
  }
}
