"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { EditionStatus, PhotoStatus, UserRole } from "@/lib/enums";

export type CommentActionState = { ok: boolean; error: string | null };

const bodySchema = z
  .string()
  .trim()
  .min(1, "Reactie mag niet leeg zijn.")
  .max(1000, "Reactie is te lang.");

const AddSchema = z.object({
  editionId: z.string().min(1),
  slug: z.string().min(1),
  photoId: z
    .string()
    .trim()
    .transform((v) => (v.length > 0 ? v : null))
    .nullable(),
  body: bodySchema,
});

const EditSchema = z.object({
  commentId: z.string().min(1),
  slug: z.string().min(1),
  body: bodySchema,
});

const DeleteSchema = z.object({
  commentId: z.string().min(1),
  slug: z.string().min(1),
});

export async function addComment(
  _prevState: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  const user = await requireUser();

  const parsed = AddSchema.safeParse({
    editionId: formData.get("editionId"),
    slug: formData.get("slug"),
    photoId: formData.get("photoId") ?? "",
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }
  const { editionId, slug, photoId, body } = parsed.data;

  const isAdmin = user.role === UserRole.ADMIN;

  // Only comment on an edition the user can actually see (guests: published
  // only), mirroring the detail page's visibility rule.
  const edition = await prisma.edition.findUnique({ where: { id: editionId } });
  if (
    !edition ||
    (edition.status !== EditionStatus.PUBLISHED && !isAdmin)
  ) {
    return { ok: false, error: "Reageren is hier niet mogelijk." };
  }

  // A photo comment must reference a READY photo that belongs to this edition.
  if (photoId) {
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (
      !photo ||
      photo.editionId !== editionId ||
      photo.status !== PhotoStatus.READY
    ) {
      return { ok: false, error: "Deze foto bestaat niet meer." };
    }
  }

  await prisma.comment.create({
    data: { body, userId: user.id, editionId, photoId },
  });

  revalidatePath(`/edities/${slug}`);
  return { ok: true, error: null };
}

export async function editComment(
  _prevState: CommentActionState,
  formData: FormData
): Promise<CommentActionState> {
  const user = await requireUser();

  const parsed = EditSchema.safeParse({
    commentId: formData.get("commentId"),
    slug: formData.get("slug"),
    body: formData.get("body") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }
  const { commentId, slug, body } = parsed.data;

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  // Only the author may edit their own comment.
  if (!comment || comment.userId !== user.id) {
    return { ok: false, error: "Je kunt deze reactie niet bewerken." };
  }

  await prisma.comment.update({ where: { id: commentId }, data: { body } });

  revalidatePath(`/edities/${slug}`);
  return { ok: true, error: null };
}

export async function deleteComment(formData: FormData): Promise<void> {
  const user = await requireUser();

  const parsed = DeleteSchema.safeParse({
    commentId: formData.get("commentId"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return;
  const { commentId, slug } = parsed.data;

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) return;

  // The author may delete their own comment; an admin may delete any.
  const isAdmin = user.role === UserRole.ADMIN;
  if (comment.userId !== user.id && !isAdmin) return;

  await prisma.comment.delete({ where: { id: commentId } });

  revalidatePath(`/edities/${slug}`);
}
