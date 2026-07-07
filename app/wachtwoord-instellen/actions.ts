"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

const SetPasswordSchema = z
  .object({
    password: z.string().min(10, "Wachtwoord moet minstens 10 tekens bevatten."),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "De wachtwoorden komen niet overeen.",
    path: ["confirm"],
  });

export type SetPasswordState = { error: string | null };

export async function setPassword(
  _prevState: SetPasswordState,
  formData: FormData
): Promise<SetPasswordState> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const parsed = SetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  redirect("/");
}
