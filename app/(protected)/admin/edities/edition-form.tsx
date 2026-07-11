"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";
import { saveEdition, type EditionFormState } from "./actions";

const initialState: EditionFormState = { error: null };

const textareaClass =
  "w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25";

export type EditionFormDefaults = {
  id?: string;
  title: string;
  slug: string;
  eventDate: string; // datetime-local value; "" when the date is not yet known
  dateUnknown: boolean;
  location: string;
  inviteMarkdown: string;
};

export function EditionForm({ defaults }: { defaults: EditionFormDefaults }) {
  const [state, formAction, pending] = useActionState(saveEdition, initialState);

  const [title, setTitle] = useState(defaults.title);
  const [slug, setSlug] = useState(defaults.slug);
  const [dateUnknown, setDateUnknown] = useState(defaults.dateUnknown);

  // New editions auto-generate the slug from the title. When editing, an
  // existing slug is kept fixed so the edition's URL never changes.
  const slugLocked = Boolean(defaults.slug);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugLocked) setSlug(slugify(value));
  }

  const isEdit = Boolean(defaults.id);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {/* Slug is derived from the title automatically and never shown/edited. */}
      <input type="hidden" name="slug" value={slug} />

      <div>
        <Label htmlFor="title">Titel</Label>
        <Input
          id="title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="eventDate">Datum en tijd</Label>
        <Input
          id="eventDate"
          name="eventDate"
          type="datetime-local"
          defaultValue={defaults.eventDate}
          required={!dateUnknown}
          disabled={dateUnknown}
          className={dateUnknown ? "opacity-50" : undefined}
        />
        <label className="mt-2 flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            name="dateUnknown"
            checked={dateUnknown}
            onChange={(e) => setDateUnknown(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Datum en tijd nog niet bekend
        </label>
      </div>

      <div>
        <Label htmlFor="location">Locatie</Label>
        <Input
          id="location"
          name="location"
          type="text"
          defaultValue={defaults.location}
          placeholder="bijv. Loods 6, Amsterdam"
        />
      </div>

      <div>
        <Label htmlFor="inviteMarkdown">Uitnodiging</Label>
        <textarea
          id="inviteMarkdown"
          name="inviteMarkdown"
          rows={10}
          defaultValue={defaults.inviteMarkdown}
          placeholder="Details over de avond…"
          className={textareaClass}
        />
        <p className="mt-1.5 text-xs text-muted">
          Ondersteunt markdown: koppen (#), <strong>**vet**</strong>,{" "}
          <em>*cursief*</em>, [links](https://…) en lijsten.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Bezig…" : isEdit ? "Wijzigingen opslaan" : "Editie aanmaken"}
      </Button>
    </form>
  );
}