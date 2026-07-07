"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword } from "@/lib/auth";
import { pruneRateLimits, rateLimit } from "@/lib/rate-limit";

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

// Generic Dutch error — never reveal whether the email or the password was wrong.
const GENERIC_ERROR = "Onjuiste inloggegevens.";
const RATE_LIMITED = "Te veel pogingen. Probeer het over een kwartier opnieuw.";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export type LoginState = { error: string | null; email?: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Echo the raw email back so the field stays filled after a failed attempt.
  const rawEmail = typeof formData.get("email") === "string"
    ? (formData.get("email") as string)
    : "";
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: GENERIC_ERROR, email: rawEmail };
  }
  const { email, password } = parsed.data;

  // Rate limit per IP + email.
  pruneRateLimits();
  const ip = await clientIp();
  const { allowed } = rateLimit(`login:${ip}:${email}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!allowed) {
    return { error: RATE_LIMITED, email: rawEmail };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return { error: GENERIC_ERROR, email: rawEmail };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return { error: GENERIC_ERROR, email: rawEmail };
  }

  await createSession(user.id);

  // redirect() throws NEXT_REDIRECT — keep it outside any try/catch above.
  redirect(user.mustChangePassword ? "/wachtwoord-instellen" : "/");
}
