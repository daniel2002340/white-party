"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { sendInviteEmail } from "@/lib/email";
import { EditionStatus } from "@/lib/enums";

export type SendResult = { email: string; ok: boolean; error: string | null };

/** Send the invite email for one recipient. Never throws — reports per address. */
export async function sendInviteToRecipient(
  editionId: string,
  userId: string
): Promise<SendResult> {
  await requireAdmin();

  const [edition, user] = await Promise.all([
    prisma.edition.findUnique({ where: { id: editionId } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    }),
  ]);

  if (!user) return { email: "", ok: false, error: "Gebruiker niet gevonden." };
  if (!edition || edition.status !== EditionStatus.PUBLISHED) {
    return { email: user.email, ok: false, error: "Editie is niet gepubliceerd." };
  }

  try {
    await sendInviteEmail({
      to: user.email,
      edition: {
        title: edition.title,
        slug: edition.slug,
        eventDate: edition.eventDate,
        location: edition.location,
        inviteHtml: edition.inviteHtml,
      },
    });
    return { email: user.email, ok: true, error: null };
  } catch (error) {
    console.error("Invite send failed:", error);
    return { email: user.email, ok: false, error: "Verzenden mislukt." };
  }
}

/** Record that the invite mailing finished. */
export async function finalizeInviteSend(editionId: string): Promise<void> {
  await requireAdmin();
  await prisma.edition.update({
    where: { id: editionId },
    data: { lastInviteSentAt: new Date() },
  });
  revalidatePath(`/admin/edities/${editionId}/bewerken`);
}
