"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  submitRsvp,
  type RsvpAnswer,
  type RsvpState,
} from "./rsvp-actions";

function guestSummary(count: number): string {
  if (count === 0) return "Je staat op de lijst!";
  if (count === 1) return "Je staat op de lijst met 1 introducé.";
  return `Je staat op de lijst met ${count} introducés.`;
}

export function RsvpCard({
  editionId,
  slug,
  initialRsvp,
}: {
  editionId: string;
  slug: string;
  initialRsvp: RsvpAnswer | null;
}) {
  const [state, formAction, pending] = useActionState<RsvpState, FormData>(
    submitRsvp,
    { ok: false, error: null, rsvp: initialRsvp }
  );

  const answer = state.rsvp ?? initialRsvp;
  const [editing, setEditing] = useState(false);
  // Which choice is expanded in the ask view ("yes" reveals the guest fields).
  const [choice, setChoice] = useState<"yes" | "no" | null>(
    initialRsvp?.attending ? "yes" : null
  );

  // Collapse back to the confirmation view whenever a new submit succeeds.
  // (Render-phase adjustment on a changed value — no effect needed.)
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.ok) setEditing(false);
  }

  const hidden = (
    <>
      <input type="hidden" name="editionId" value={editionId} />
      <input type="hidden" name="slug" value={slug} />
    </>
  );

  // ---- Confirmation view (already answered, not editing) ----
  if (answer && !editing) {
    return (
      <Card className="mt-12">
        <p className="eyebrow">Jouw antwoord</p>
        {answer.attending ? (
          <p className="mt-3 font-display text-2xl font-semibold text-foreground">
            {guestSummary(answer.guestCount)}
          </p>
        ) : (
          <p className="mt-3 font-display text-2xl font-semibold text-foreground">
            Je hebt je afgemeld — jammer!
          </p>
        )}
        {answer.note ? (
          <p className="mt-2 text-sm text-secondary">
            Opmerking: {answer.note}
          </p>
        ) : null}
        <div className="mt-6">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setChoice(answer.attending ? "yes" : null);
              setEditing(true);
            }}
          >
            Antwoord wijzigen
          </Button>
        </div>
      </Card>
    );
  }

  // ---- Ask view ----
  return (
    <Card className="mt-12">
      <p className="eyebrow">RSVP</p>
      <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
        Ben je erbij?
      </h2>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="button"
          variant={choice === "yes" ? "primary" : "secondary"}
          onClick={() => setChoice("yes")}
        >
          Ja, ik kom!
        </Button>

        {/* "No" submits immediately. */}
        <form action={formAction}>
          {hidden}
          <input type="hidden" name="attending" value="false" />
          <input type="hidden" name="guestCount" value="0" />
          <Button
            type="submit"
            variant={choice === "no" ? "primary" : "secondary"}
            disabled={pending}
            onClick={() => setChoice("no")}
          >
            Nee, helaas
          </Button>
        </form>
      </div>

      {choice === "yes" ? (
        <form action={formAction} className="mt-6 space-y-4 border-t border-border pt-6">
          {hidden}
          <input type="hidden" name="attending" value="true" />
          <div>
            <Label htmlFor="guestCount">Aantal introducés</Label>
            <Input
              id="guestCount"
              name="guestCount"
              type="number"
              min={0}
              max={5}
              defaultValue={answer?.attending ? answer.guestCount : 0}
              className="max-w-32"
            />
          </div>
          <div>
            <Label htmlFor="note">Opmerking</Label>
            <textarea
              id="note"
              name="note"
              rows={3}
              defaultValue={answer?.note ?? ""}
              placeholder="Opmerking, bijv. dieetwensen"
              className="w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Bezig…" : "Ik kom!"}
          </Button>
        </form>
      ) : null}

      {state.error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      {answer && editing ? (
        <div className="mt-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setEditing(false)}
          >
            Annuleren
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
