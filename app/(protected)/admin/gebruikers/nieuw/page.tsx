import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { NewUserForm } from "./new-user-form";

export const metadata: Metadata = {
  title: "Nieuwe gebruiker — White Party",
};

export default async function NewUserPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <Link
        href="/admin/gebruikers"
        className="text-sm text-secondary transition-colors hover:text-foreground"
      >
        ← Terug naar gebruikers
      </Link>

      <p className="eyebrow mt-8">Beheer</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">
        Nieuwe gebruiker
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-secondary">
        De gebruiker krijgt per e-mail een tijdelijk wachtwoord en stelt bij de
        eerste keer inloggen zelf een wachtwoord in.
      </p>

      <NewUserForm />
    </div>
  );
}
