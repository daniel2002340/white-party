"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { deleteUser, resendPassword, type ResendState } from "./actions";

const resendInitialState: ResendState = {
  ok: false,
  error: null,
  message: null,
  fallbackPassword: null,
};

export function UserRowActions({
  userId,
  email,
  isSelf,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
}) {
  const [resendState, resendAction, resendPending] = useActionState(
    resendPassword,
    resendInitialState
  );

  return (
    <>
      <div className="flex items-center gap-2">
        <form action={resendAction}>
          <input type="hidden" name="userId" value={userId} />
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={resendPending}
          >
            {resendPending ? "Bezig…" : "Wachtwoord opnieuw versturen"}
          </Button>
        </form>

        {isSelf ? null : (
          <form
            action={deleteUser}
            onSubmit={(event) => {
              if (
                !window.confirm(
                  `Weet je zeker dat je ${email} wilt verwijderen? Dit verwijdert ook hun sessies en RSVP's. Dit kan niet ongedaan worden gemaakt.`
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="userId" value={userId} />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="text-danger hover:text-danger"
            >
              Verwijderen
            </Button>
          </form>
        )}
      </div>

      {/* Resend feedback wraps onto its own line (parent row is flex-wrap). */}
      {resendState.error ? (
        <p className="w-full text-sm text-danger" role="alert">
          {resendState.error}
        </p>
      ) : null}
      {resendState.ok ? (
        <div className="w-full text-sm text-secondary" role="status">
          {resendState.message}
          {resendState.fallbackPassword ? (
            <span className="mt-1 block">
              Tijdelijk wachtwoord (noteer en geef zelf door):{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono text-foreground">
                {resendState.fallbackPassword}
              </code>
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
