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

const EditionSchema = z.object({
  title: z.string().trim().min(1, "Titel is verplicht."),
  slug: z
    .string()
    .transform((value) => slugify(value))
    .refine((value) => value.length > 0, "Voer een geldige slug in."),
  eventDate: z
    .string()
    .min(1, "Datum en tijd zijn verplicht.")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Voer een geldige datum en tijd in.",
    }),
  location: z
    .string()
    .trim()
    .transform((value) => (value.length > 0 ? value : null)),
  status: z.enum([
    EditionStatus.DRAFT,
    EditionStatus.PUBLISHED,
    EditionStatus.ARCHIVED,
  ]),
  inviteMarkdown: z.string(),
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
    eventDate: formData.get("eventDate"),
    location: formData.get("location") ?? "",
    status: formData.get("status"),
    inviteMarkdown: formData.get("inviteMarkdown") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const { title, slug, eventDate, location, status, inviteMarkdown } =
    parsed.data;
  const trimmedMarkdown = inviteMarkdown.trim();
  const inviteHtml = trimmedMarkdown ? renderInviteHtml(trimmedMarkdown) : null;

  const data = {
    title,
    slug,
    eventDate: new Date(eventDate),
    location,
    status,
    inviteMarkdown: trimmedMarkdown || null,
    inviteHtml,
  };

  try {
    if (id) {
      await prisma.edition.update({ where: { id }, data });
    } else {
      await prisma.edition.create({ data });
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
