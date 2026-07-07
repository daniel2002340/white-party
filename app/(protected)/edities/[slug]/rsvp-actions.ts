"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { EditionStatus } from "@/lib/enums";

export type RsvpAnswer = {
  attending: boolean;
  guestCount: number;
  note: string | null;
};

export type RsvpState = {
  ok: boolean;
  error: string | null;
  rsvp: RsvpAnswer | null;
};

const RsvpSchema = z.object({
  editionId: z.string().min(1),
  slug: z.string().min(1),
  attending: z.enum(["true", "false"]).transform((v) => v === "true"),
  guestCount: z.coerce.number().int().min(0).max(5),
  note: z
    .string()
    .trim()
    .max(500, "Opmerking is te lang.")
    .transform((v) => (v.length > 0 ? v : null)),
});

export async function submitRsvp(
  _prevState: RsvpState,
  formData: FormData
): Promise<RsvpState> {
  const user = await requireUser();

  const parsed = RsvpSchema.safeParse({
    editionId: formData.get("editionId"),
    slug: formData.get("slug"),
    attending: formData.get("attending"),
    guestCount: formData.get("guestCount") ?? 0,
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
      rsvp: null,
    };
  }
  const { editionId, slug, attending, guestCount, note } = parsed.data;

  // RSVP only for a published edition that hasn't happened yet.
  const edition = await prisma.edition.findUnique({ where: { id: editionId } });
  if (
    !edition ||
    edition.status !== EditionStatus.PUBLISHED ||
    edition.eventDate.getTime() <= Date.now()
  ) {
    return { ok: false, error: "Aanmelden is niet meer mogelijk.", rsvp: null };
  }

  // Not attending → guest count is always 0.
  const finalGuestCount = attending ? guestCount : 0;

  await prisma.rsvp.upsert({
    where: { userId_editionId: { userId: user.id, editionId } },
    update: { attending, guestCount: finalGuestCount, note },
    create: {
      userId: user.id,
      editionId,
      attending,
      guestCount: finalGuestCount,
      note,
    },
  });

  revalidatePath(`/edities/${slug}`);
  revalidatePath(`/admin/edities/${editionId}/rsvps`);

  return {
    ok: true,
    error: null,
    rsvp: { attending, guestCount: finalGuestCount, note },
  };
}
