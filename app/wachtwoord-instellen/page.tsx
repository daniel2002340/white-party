import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = {
  title: "Wachtwoord instellen — White Party",
};

// Centered invitation card for setting a new password. Requires a logged-in
// user (typically arriving here right after login with mustChangePassword set).
export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <Card>
        <p className="eyebrow text-center">White Party</p>
        <h1 className="mt-3 text-center font-display text-3xl font-semibold text-foreground">
          Kies je wachtwoord
        </h1>
        <p className="mt-2 text-center text-sm text-secondary">
          Stel een wachtwoord in van minstens 10 tekens om je account te
          activeren.
        </p>

        <SetPasswordForm />
      </Card>
    </div>
  );
}
