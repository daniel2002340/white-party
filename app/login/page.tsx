import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Inloggen — White Party",
};

// Centered invitation card. Already-authenticated users skip the form.
export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.mustChangePassword ? "/wachtwoord-instellen" : "/");
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <Card>
        <p className="eyebrow text-center">White Party</p>
        <h1 className="mt-3 text-center font-display text-3xl font-semibold text-foreground">
          Welkom
        </h1>
        <p className="mt-2 text-center text-sm text-secondary">
          Log in met je e-mailadres om verder te gaan.
        </p>

        <LoginForm />
      </Card>
    </div>
  );
}
