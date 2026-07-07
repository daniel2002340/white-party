import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Admin — White Party",
};

export default async function AdminPage() {
  const [editionCount, userCount, photoCount] = await Promise.all([
    prisma.edition.count(),
    prisma.user.count(),
    prisma.photo.count(),
  ]);

  const cards = [
    {
      title: "Edities",
      href: "/admin/edities",
      count: editionCount,
      unit: editionCount === 1 ? "editie" : "edities",
    },
    {
      title: "Gebruikers",
      href: "/admin/gebruikers",
      count: userCount,
      unit: userCount === 1 ? "gebruiker" : "gebruikers",
    },
    {
      title: "Foto's",
      href: null, // photos are managed per edition, not from a top-level page
      count: photoCount,
      unit: photoCount === 1 ? "foto" : "foto's",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <p className="eyebrow">Beheer</p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">
        Admin
      </h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const inner = (
            <Card className="h-full transition-colors hover:bg-background">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {card.title}
                </h2>
                <span className="font-display text-2xl font-semibold text-foreground">
                  {card.count}
                </span>
              </div>
              <p className="mt-2 text-sm text-secondary">
                {card.href ? (
                  <>{card.unit} — beheren →</>
                ) : (
                  <>{card.unit} — beheer je per editie</>
                )}
              </p>
            </Card>
          );

          return card.href ? (
            <Link key={card.title} href={card.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={card.title} className="opacity-70">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
