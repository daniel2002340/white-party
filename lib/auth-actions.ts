"use server";

import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";

// Logout server action, used by the header form.
export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
