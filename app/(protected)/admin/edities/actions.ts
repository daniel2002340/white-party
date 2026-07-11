"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { renderInviteHtml } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import { EditionStatus } from "@/lib/enums";

const LIST_PATH = "/admin/edities";

const EditionSchema = z
  .object({
    title: z.string().trim().min(1, "Titel is verplicht."),
    slug: z
      .string()
      .transform((value) => slugify(value))
      .refine((value) => value.length > 0, "Voer een geldige slug in."),
    // Empty when the date is not yet known (dateUnknown checked).
    eventDate: z.string(),
    dateUnknown: z.boolean(),
    location: z
      .string()
      .trim()
      .transform((value) => (value.length > 0 ? value : null)),
    inviteMarkdown: z.string(),
  })
  .superRefine((value, ctx) => {
    if (
      !value.dateUnknown &&
      (value.eventDate.length === 0 ||
        Number.isNaN(new Date(value.eventDate).getTime()))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventDate"],
        message: "Voer een geldige datum en tijd in.",
      });
    }
  });

export type EditionFormState = { error: string | null };

export async function saveEdition(
  _prevState: EditionFormState,
  formData: FormData
): Promise<EditionFormState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim() || null;

  const parsed = EditionSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    eventDate: formData.get("eventDate") ?? "",
    dateUnknown: formData.get("dateUnknown") === "on",
    location: formData.get("location") ?? "",
    inviteMarkdown: formData.get("inviteMarkdown") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const { title, slug, eventDate, dateUnknown, location, inviteMarkdown } =
    parsed.data;
  const trimmedMarkdown = inviteMarkdown.trim();
  const inviteHtml = trimmedMarkdown ? renderInviteHtml(trimmedMarkdown) : null;

  const data = {
    title,
    slug,
    eventDate: dateUnknown ? null : new Date(eventDate),
    location,
    inviteMarkdown: trimmedMarkdown || null,
    inviteHtml,
  };

  try {
    if (id) {
      // Status is managed elsewhere; editing never changes it.
      await prisma.edition.update({ where: { id }, data });
    } else {
      // New editions are always published.
      await prisma.edition.create({
        data: { ...data, status: EditionStatus.PUBLISHED },
      });
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Er bestaat al een editie met deze slug." };
    }
    throw error;
  }

  revalidatePath(LIST_PATH);
  revalidatePath("/");
  revalidatePath(`/edities/${slug}`);
  redirect(LIST_PATH);
}

export async function deleteEdition(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Cascades photos and RSVPs via the schema's onDelete: Cascade rules.
  await prisma.edition.delete({ where: { id } }).catch(() => {});

  revalidatePath(LIST_PATH);
  revalidatePath("/");
}
