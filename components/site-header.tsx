"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { logout } from "@/lib/auth-actions";
import { UserRole } from "@/lib/enums";
import type { SessionUser } from "@/lib/auth";

// Minimal top bar: wordmark left, navigation right. On desktop the nav is
// inline; on narrow screens it collapses into a toggled menu. Nav (and logout)
// only appear when logged in; the "Admin" link only for admins.
export function SiteHeader({ user }: { user: SessionUser | null }) {
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === UserRole.ADMIN;

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const navLinks = (
    <>
      <Link
        href="/edities"
        onClick={() => setOpen(false)}
        className="text-secondary transition-colors hover:text-foreground"
      >
        Edities
      </Link>
      {isAdmin ? (
        <Link
          href="/admin"
          onClick={() => setOpen(false)}
          className="text-secondary transition-colors hover:text-foreground"
        >
          Admin
        </Link>
      ) : null}
      <form action={logout}>
        <button
          type="submit"
          className="text-secondary transition-colors hover:text-foreground"
        >
          Uitloggen
        </button>
      </form>
    </>
  );

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        {/* Wordmark: Fraunces 600 with a flag-blue period after it. */}
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="font-display text-xl font-semibold tracking-tight text-foreground"
        >
          White Party<span className="text-accent">.</span>
        </Link>

        {user ? (
          <>
            {/* Desktop nav */}
            <nav className="hidden items-center gap-8 text-sm sm:flex">
              {navLinks}
            </nav>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Menu sluiten" : "Menu openen"}
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] text-foreground transition-colors hover:bg-background sm:hidden"
            >
              {/* Simple hamburger / close glyph */}
              <span aria-hidden="true" className="text-xl leading-none">
                {open ? "✕" : "☰"}
              </span>
            </button>
          </>
        ) : null}
      </div>

      {/* Mobile menu panel */}
      {user && open ? (
        <nav
          id="mobile-menu"
          className="flex flex-col gap-4 border-t border-border px-6 py-4 text-sm sm:hidden"
        >
          {navLinks}
        </nav>
      ) : null}
    </header>
  );
}
