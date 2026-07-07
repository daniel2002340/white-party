"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { sendInviteToRecipient, finalizeInviteSend } from "./invite-actions";

type Recipient = { id: string; email: string; name: string | null };

type Preview = {
  subject: string;
  title: string;
  dateText: string;
  location: string | null;
  paragraphs: string[];
  url: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function InviteSender({
  editionId,
  isPublished,
  allRecipients,
  pendingRecipients,
  preview,
  lastInviteSentAt,
}: {
  editionId: string;
  isPublished: boolean;
  allRecipients: Recipient[];
  pendingRecipients: Recipient[];
  preview: Preview;
  lastInviteSentAt: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "confirm" | "sending" | "done">(
    "idle"
  );
  const [choice, setChoice] = useState<"all" | "pending">("all");
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);

  const recipients = choice === "all" ? allRecipients : pendingRecipients;

  async function run() {
    const list = choice === "all" ? allRecipients : pendingRecipients;
    setStep("sending");
    setTotal(list.length);
    setDone(0);
    setFailures([]);

    const fails: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const result = await sendInviteToRecipient(editionId, list[i].id);
      if (!result.ok) fails.push(result.email || list[i].email);
      setDone(i + 1);
      // Be polite to the SMTP server.
      if (i < list.length - 1) await sleep(200);
    }

    setFailures(fails);
    await finalizeInviteSend(editionId);
    setStep("done");
    router.refresh();
  }

  return (
    <section className="mt-16 border-t border-border pt-10">
      <p className="eyebrow">Uitnodiging</p>
      <h2 className="mt-3 font-display text-2xl font-semibold text-foreground">
        Uitnodiging versturen
      </h2>

      {!isPublished ? (
        <p className="mt-3 text-sm text-secondary">
          Publiceer de editie eerst; de uitnodiging linkt naar de openbare
          pagina.
        </p>
      ) : null}

      {lastInviteSentAt ? (
        <p className="mt-3 text-sm text-muted">
          Laatst verstuurd: {lastInviteSentAt}
        </p>
      ) : null}

      {/* ---- Idle ---- */}
      {step === "idle" ? (
        <div className="mt-6">
          <Button
            type="button"
            disabled={!isPublished || allRecipients.length === 0}
            onClick={() => setStep("confirm")}
          >
            Uitnodiging versturen
          </Button>
        </div>
      ) : null}

      {/* ---- Confirm ---- */}
      {step === "confirm" ? (
        <div className="mt-6 space-y-6">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-foreground">
              Aan wie versturen?
            </legend>
            <label className="flex items-center gap-3 text-sm text-foreground">
              <input
                type="radio"
                name="choice"
                checked={choice === "all"}
                onChange={() => setChoice("all")}
                className="accent-[var(--color-accent)]"
              />
              Alle gasten en beheerders ({allRecipients.length})
            </label>
            <label className="flex items-center gap-3 text-sm text-foreground">
              <input
                type="radio"
                name="choice"
                checked={choice === "pending"}
                onChange={() => setChoice("pending")}
                className="accent-[var(--color-accent)]"
              />
              Alleen wie nog niet heeft gereageerd ({pendingRecipients.length})
            </label>
          </fieldset>

          {/* Email preview */}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Voorbeeld</p>
            <div className="rounded-[var(--radius)] border border-border bg-surface p-5 shadow-card">
              <p className="text-sm text-secondary">
                <span className="text-muted">Onderwerp:</span> {preview.subject}
              </p>
              <div className="mt-4 border-t border-border pt-4">
                <p className="font-display text-xl font-semibold text-foreground">
                  {preview.title}
                </p>
                <p className="mt-1 text-sm text-secondary">
                  {preview.dateText}
                  {preview.location ? ` · ${preview.location}` : ""}
                </p>
                {preview.paragraphs.map((p, i) => (
                  <p key={i} className="mt-3 text-sm text-secondary">
                    {p}
                  </p>
                ))}
                <span className="mt-4 inline-block rounded-[var(--radius)] bg-ink px-4 py-2 text-sm font-medium text-white">
                  Bekijk uitnodiging &amp; meld je aan
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={run}
              disabled={recipients.length === 0}
            >
              Versturen naar {recipients.length}{" "}
              {recipients.length === 1 ? "persoon" : "personen"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep("idle")}
            >
              Annuleren
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---- Sending ---- */}
      {step === "sending" ? (
        <div className="mt-6">
          <p className="text-sm text-secondary">
            Bezig met versturen… {done} / {total}
          </p>
          <div className="mt-2 h-1 w-full max-w-md overflow-hidden rounded bg-border">
            <div
              className="h-full bg-ink transition-all"
              style={{ width: total ? `${(done / total) * 100}%` : "0%" }}
            />
          </div>
        </div>
      ) : null}

      {/* ---- Done ---- */}
      {step === "done" ? (
        <div className="mt-6">
          <p className="text-sm text-foreground" role="status">
            Klaar: {total - failures.length} verstuurd
            {failures.length > 0 ? `, ${failures.length} mislukt` : ""}.
          </p>
          {failures.length > 0 ? (
            <div className="mt-2 text-sm text-danger">
              <p>Mislukt voor:</p>
              <ul className="mt-1 list-inside list-disc">
                {failures.map((email) => (
                  <li key={email}>{email}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep("idle")}
            >
              Sluiten
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
