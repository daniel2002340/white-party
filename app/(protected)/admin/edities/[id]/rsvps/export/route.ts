import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { roleLabel } from "@/lib/enums";
import { loadRsvpRows } from "../data";

export const runtime = "nodejs";

// Quote a CSV field and escape embedded quotes.
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const edition = await prisma.edition.findUnique({
    where: { id },
    select: { slug: true },
  });
  if (!edition) return new Response("Niet gevonden.", { status: 404 });

  const rows = await loadRsvpRows(id);

  const header = [
    "Naam",
    "E-mail",
    "Rol",
    "Antwoord",
    "Introducés",
    "Opmerking",
    "Laatst bijgewerkt",
  ];
  const lines = [header.map(csvField).join(",")];
  for (const r of rows) {
    const answer =
      r.attending === true ? "Ja" : r.attending === false ? "Nee" : "Geen antwoord";
    lines.push(
      [
        r.name ?? "",
        r.email,
        roleLabel[r.role] ?? r.role,
        answer,
        r.attending === true ? String(r.guestCount) : "",
        r.note ?? "",
        r.updatedAt ? dateFmt.format(r.updatedAt) : "",
      ]
        .map((v) => csvField(String(v)))
        .join(",")
    );
  }

  // UTF-8 BOM so Excel reads accented characters correctly.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="rsvps-${edition.slug}.csv"`,
    },
  });
}
