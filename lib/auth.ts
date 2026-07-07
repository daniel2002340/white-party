import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/enums";

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// The shape we expose to the app — never includes passwordHash.
export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  mustChangePassword: boolean;
};

// ---- Password hashing (argon2id) ----

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  // argon2.verify throws on malformed hashes; treat that as "no match".
  return argon2.verify(hash, password).catch(() => false);
}

// ---- Sessions ----

/**
 * Create a session for a user: random token, 30-day expiry, persisted in the DB
 * and set as the httpOnly "session" cookie. Must be called from a Server Action
 * or Route Handler (where setting cookies is allowed).
 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Load the current user from the session cookie. Returns null if there is no
 * cookie, the session is unknown, or it has expired. Cached per request so
 * repeated calls (layout + page + guards) hit the DB once.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          mustChangePassword: true,
        },
      },
    },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    // Best-effort cleanup of the expired row; ignore races.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
});

/** Clear the current session (DB row + cookie). Call from a Server Action. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

// ---- Page guards (redirect) ----
// Use these in Server Components, layouts and Server Actions.

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) redirect("/login");
  return user;
}

// ---- Route-handler guards (return a Response) ----
// Use these in route handlers (uploads/downloads) where a redirect is wrong;
// they return a 401/403 Response instead. Usage:
//   const auth = await requireAdminApi();
//   if (auth instanceof Response) return auth;
//   const { user } = auth;

export async function requireUserApi(): Promise<{ user: SessionUser } | Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  return { user };
}

export async function requireAdminApi(): Promise<{ user: SessionUser } | Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role !== UserRole.ADMIN) return new Response("Forbidden", { status: 403 });
  return { user };
}
