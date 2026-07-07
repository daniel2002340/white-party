"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";
import { EditionStatus, editionStatusLabel } from "@/lib/enums";
import { saveEdition, type EditionFormState } from "./actions";

const initialState: EditionFormState = { error: null };

const selectClass =
  "h-11 w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 text-sm text-foreground transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25";

const textareaClass =
  "w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25";

export type EditionFormDefaults = {
  id?: string;
  title: string;
  slug: string;
  eventDate: string; // datetime-local value
  location: string;
  status: string;
  inviteMarkdown: string;
};

export function EditionForm({ defaults }: { defaults: EditionFormDefaults }) {
  const [state, formAction, pending] = useActionState(saveEdition, initialState);

  const [title, setTitle] = useState(defaults.title);
  const [slug, setSlug] = useState(defaults.slug);
  // Once a slug exists (editing) or the admin edits it, stop auto-generating.
  const [slugEdited, setSlugEdited] = useState(Boolean(defaults.slug));

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  const isEdit = Boolean(defaults.id);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}

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
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          type="text"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
          onBlur={(e) => setSlug(slugify(e.target.value))}
          required
        />
        <p className="mt-1.5 text-xs text-muted">
          De URL wordt /edities/{slug || "…"}
        </p>
      </div>

      <div>
        <Label htmlFor="eventDate">Datum en tijd</Label>
        <Input
          id="eventDate"
          name="eventDate"
          type="datetime-local"
          defaultValue={defaults.eventDate}
          required
        />
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
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={defaults.status}
          className={selectClass}
        >
          <option value={EditionStatus.DRAFT}>
            {editionStatusLabel[EditionStatus.DRAFT]}
          </option>
          <option value={EditionStatus.PUBLISHED}>
            {editionStatusLabel[EditionStatus.PUBLISHED]}
          </option>
          <option value={EditionStatus.ARCHIVED}>
            {editionStatusLabel[EditionStatus.ARCHIVED]}
          </option>
        </select>
      </div>

      <div>
        <Label htmlFor="inviteMarkdown">Uitnodiging</Label>
        <textarea
          id="inviteMarkdown"
          name="inviteMarkdown"
          rows={10}
          defaultValue={defaults.inviteMarkdown}
          placeholder={"## Welkom\n\nDetails over de avond…"}
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
