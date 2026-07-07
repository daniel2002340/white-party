import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { EditionStatus } from "@/lib/enums";
import { EditionForm } from "../edition-form";

export const metadata: Metadata = {
  title: "Nieuwe editie — White Party",
};

export default async function NewEditionPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/admin/edities"
        className="text-sm text-secondary transition-colors hover:text-foreground"
      >
        ← Terug naar edities
      </Link>

      <p className="eyebrow mt-8">Beheer</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">
        Nieuwe editie
      </h1>

      <EditionForm
        defaults={{
          title: "",
          slug: "",
          eventDate: "",
          location: "",
          status: EditionStatus.DRAFT,
          inviteMarkdown: "",
        }}
      />
    </div>
  );
}
