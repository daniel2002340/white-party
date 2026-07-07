"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { generateTempPassword } from "@/lib/temp-password";
import { sendAccountEmail } from "@/lib/email";
import { UserRole } from "@/lib/enums";

const LIST_PATH = "/admin/gebruikers";

const CreateUserSchema = z.object({
  name: z.string().trim().min(1, "Naam is verplicht."),
  email: z.string().trim().toLowerCase().email("Voer een geldig e-mailadres in."),
  role: z.enum([UserRole.GUEST, UserRole.ADMIN]).default(UserRole.GUEST),
});

export type CreateUserState = {
  ok: boolean;
  error: string | null;
  message: string | null;
  // When email delivery fails, we surface the temp password once so the admin
  // can pass it on manually.
  fallbackPassword: string | null;
};

// Local only — "use server" files may not export non-function values.
const createUserInitialState: CreateUserState = {
  ok: false,
  error: null,
  message: null,
  fallbackPassword: null,
};

export async function createUser(
  _prevState: CreateUserState,
  formData: FormData
): Promise<CreateUserState> {
  await requireAdmin();

  const parsed = CreateUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role") ?? undefined,
  });
  if (!parsed.success) {
    return {
      ...createUserInitialState,
      error: parsed.error.issues[0]?.message ?? "Ongeldige invoer.",
    };
  }
  const { name, email, role } = parsed.data;

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  let user;
  try {
    user = await prisma.user.create({
      data: { name, email, role, passwordHash, mustChangePassword: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ...createUserInitialState,
        error: "Er bestaat al een gebruiker met dit e-mailadres.",
      };
    }
    throw error;
  }

  revalidatePath(LIST_PATH);

  // Try to email the credentials; on failure show the temp password on screen.
  try {
    await sendAccountEmail({ to: user.email, name: user.name, tempPassword });
    return {
      ...createUserInitialState,
      ok: true,
      message: `Gebruiker ${user.email} is aangemaakt en de uitnodiging is verstuurd.`,
    };
  } catch (error) {
    console.error("Failed to send account email:", error);
    return {
      ...createUserInitialState,
      ok: true,
      message: `Gebruiker ${user.email} is aangemaakt, maar de e-mail kon niet worden verzonden.`,
      fallbackPassword: tempPassword,
    };
  }
}

export type ResendState = {
  ok: boolean;
  error: string | null;
  message: string | null;
  fallbackPassword: string | null;
};

const resendInitialState: ResendState = {
  ok: false,
  error: null,
  message: null,
  fallbackPassword: null,
};

export async function resendPassword(
  _prevState: ResendState,
  formData: FormData
): Promise<ResendState> {
  await requireAdmin();

  const userId = z.string().min(1).safeParse(formData.get("userId"));
  if (!userId.success) {
    return { ...resendInitialState, error: "Onbekende gebruiker." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId.data } });
  if (!user) {
    return { ...resendInitialState, error: "Gebruiker niet gevonden." };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  // New temp password, force a reset, and invalidate all existing sessions so
  // the old credentials stop working immediately.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  revalidatePath(LIST_PATH);

  try {
    await sendAccountEmail({ to: user.email, name: user.name, tempPassword });
    return {
      ...resendInitialState,
      ok: true,
      message: `Nieuw wachtwoord verstuurd naar ${user.email}.`,
    };
  } catch (error) {
    console.error("Failed to send account email:", error);
    return {
      ...resendInitialState,
      ok: true,
      message: `Nieuw wachtwoord ingesteld voor ${user.email}, maar de e-mail kon niet worden verzonden.`,
      fallbackPassword: tempPassword,
    };
  }
}

export async function deleteUser(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  // Guard against an admin deleting their own account.
  if (userId === admin.id) return;

  // Cascades sessions and RSVPs via the schema's onDelete: Cascade rules.
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});

  revalidatePath(LIST_PATH);
}
