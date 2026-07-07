"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonClassName } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserRole } from "@/lib/enums";
import { createUser, type CreateUserState } from "../actions";

const initialState: CreateUserState = {
  ok: false,
  error: null,
  message: null,
  fallbackPassword: null,
};

export function NewUserForm() {
  const [state, formAction, pending] = useActionState(createUser, initialState);

  // After a successful create, show the result (and any fallback password)
  // instead of the form.
  if (state.ok) {
    return (
      <div className="mt-8">
        <p className="text-sm text-foreground" role="status">
          {state.message}
        </p>

        {state.fallbackPassword ? (
          <div className="mt-4 rounded-[var(--radius)] border border-danger/40 bg-surface p-4">
            <p className="text-sm font-medium text-danger">
              E-mail niet verzonden — geef dit wachtwoord zelf door.
            </p>
            <p className="mt-2 text-sm text-secondary">
              Dit tijdelijke wachtwoord wordt maar één keer getoond:
            </p>
            <code className="mt-2 block rounded bg-background px-3 py-2 font-mono text-sm text-foreground">
              {state.fallbackPassword}
            </code>
          </div>
        ) : null}

        <div className="mt-6 flex gap-3">
          <Link href="/admin/gebruikers" className={buttonClassName()}>
            Terug naar gebruikers
          </Link>
          <Link
            href="/admin/gebruikers/nieuw"
            className={buttonClassName({ variant: "secondary" })}
          >
            Nog een toevoegen
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <Label htmlFor="name">Naam</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">E-mailadres</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          placeholder="gast@voorbeeld.nl"
          required
        />
      </div>
      <div>
        <Label htmlFor="role">Rol</Label>
        <select
          id="role"
          name="role"
          defaultValue={UserRole.GUEST}
          className="h-11 w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 text-sm text-foreground transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
        >
          <option value={UserRole.GUEST}>Gast</option>
          <option value={UserRole.ADMIN}>Beheerder</option>
        </select>
      </div>

      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Bezig…" : "Gebruiker aanmaken en uitnodigen"}
      </Button>
    </form>
  );
}
