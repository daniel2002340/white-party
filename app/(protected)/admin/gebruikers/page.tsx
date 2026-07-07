import type { Metadata } from "next";
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { roleLabel, UserRole } from "@/lib/enums";
import { UserRowActions } from "./user-row-actions";

export const metadata: Metadata = {
  title: "Gebruikers — White Party",
};

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Beheer</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-foreground">
            Gebruikers
          </h1>
        </div>
        <Link href="/admin/gebruikers/nieuw" className={buttonClassName()}>
          Nieuwe gebruiker
        </Link>
      </div>

      <p className="mt-4 text-sm text-secondary">
        {users.length} {users.length === 1 ? "gebruiker" : "gebruikers"}.
      </p>

      {/* Hairline-separated rows rather than boxes-in-boxes. */}
      <div className="mt-8 border-t border-border">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center gap-4 border-b border-border py-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-foreground">
                  {user.name ?? "—"}
                </span>
                {user.role === UserRole.ADMIN ? (
                  <Badge>{roleLabel[user.role]}</Badge>
                ) : null}
              </div>
              <div className="mt-0.5 truncate text-sm text-secondary">
                {user.email}
              </div>
            </div>

            <div className="hidden text-sm text-muted sm:block">
              {user.role !== UserRole.ADMIN ? roleLabel[user.role] : null}
            </div>

            <div className="hidden text-sm text-muted md:block">
              Aangemaakt {dateFormatter.format(user.createdAt)}
            </div>

            <UserRowActions
              userId={user.id}
              email={user.email}
              isSelf={user.id === admin.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
