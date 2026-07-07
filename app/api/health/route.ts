import { prisma } from "@/lib/prisma";

// Lightweight health check for monitoring/uptime probes. Public (no auth).
// Returns { ok, db } — ok reflects overall health, db reflects a live query.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  return Response.json(
    { ok: db, db },
    {
      status: db ? 200 : 503,
      headers: { "cache-control": "no-store" },
    }
  );
}
