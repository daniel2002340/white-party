"use client";

import { useActionState, useState } from "react";
import {
  addComment,
  editComment,
  deleteComment,
  type CommentActionState,
} from "@/app/(protected)/edities/[slug]/comment-actions";

export type CommentView = {
  id: string;
  body: string;
  authorName: string;
  createdAtLabel: string;
  isOwn: boolean;
};

type Tone = "light" | "dark";

// Tone-scoped class maps: "light" on the warm-white page, "dark" inside the
// pure-black lightbox. Only colors differ — never layout or behavior.
const styles: Record<
  Tone,
  {
    author: string;
    meta: string;
    body: string;
    divider: string;
    empty: string;
    action: string;
    textarea: string;
    submit: string;
  }
> = {
  light: {
    author: "font-medium text-foreground",
    meta: "text-xs text-muted",
    body: "text-sm text-secondary whitespace-pre-wrap",
    divider: "border-t border-border",
    empty: "text-sm text-muted",
    action: "text-xs text-muted hover:text-foreground transition-colors",
    textarea:
      "w-full rounded-[var(--radius)] border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted transition-colors focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
    submit:
      "inline-flex h-9 items-center justify-center rounded-[var(--radius)] bg-ink px-3 text-sm font-medium text-white transition-colors hover:bg-ink-hover disabled:pointer-events-none disabled:opacity-50",
  },
  dark: {
    author: "font-medium text-white",
    meta: "text-xs text-white/50",
    body: "text-sm text-white/80 whitespace-pre-wrap",
    divider: "border-t border-white/15",
    empty: "text-sm text-white/50",
    action: "text-xs text-white/60 hover:text-white transition-colors",
    textarea:
      "w-full rounded-[var(--radius)] border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 transition-colors focus-visible:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25",
    submit:
      "inline-flex h-9 items-center justify-center rounded-[var(--radius)] bg-white px-3 text-sm font-medium text-black transition-colors hover:bg-white/85 disabled:pointer-events-none disabled:opacity-50",
  },
};

export function CommentSection({
  editionId,
  slug,
  photoId,
  comments,
  canModerate,
  tone = "light",
}: {
  editionId: string;
  slug: string;
  photoId?: string;
  comments: CommentView[];
  canModerate: boolean;
  tone?: Tone;
}) {
  const s = styles[tone];

  return (
    <div>
      {comments.length > 0 ? (
        <ul className="space-y-4">
          {comments.map((comment, i) => (
            <li key={comment.id} className={i > 0 ? `${s.divider} pt-4` : undefined}>
              <CommentItem
                comment={comment}
                slug={slug}
                canModerate={canModerate}
                s={s}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.empty}>Nog geen reacties.</p>
      )}

      <Composer editionId={editionId} slug={slug} photoId={photoId} s={s} />
    </div>
  );
}

function Composer({
  editionId,
  slug,
  photoId,
  s,
}: {
  editionId: string;
  slug: string;
  photoId?: string;
  s: (typeof styles)[Tone];
}) {
  const [state, formAction, pending] = useActionState<CommentActionState, FormData>(
    addComment,
    { ok: false, error: null }
  );
  const [value, setValue] = useState("");

  // Clear the field once a submit succeeds (render-phase adjustment on a
  // changed value — no effect needed), matching the RsvpCard pattern.
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) setValue("");
  }

  return (
    <form action={formAction} className="mt-6 space-y-3">
      <input type="hidden" name="editionId" value={editionId} />
      <input type="hidden" name="slug" value={slug} />
      {photoId ? <input type="hidden" name="photoId" value={photoId} /> : null}
      <textarea
        name="body"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Schrijf een reactie…"
        className={s.textarea}
      />
      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className={s.submit} disabled={pending}>
        {pending ? "Bezig…" : "Plaatsen"}
      </button>
    </form>
  );
}

function CommentItem({
  comment,
  slug,
  canModerate,
  s,
}: {
  comment: CommentView;
  slug: string;
  canModerate: boolean;
  s: (typeof styles)[Tone];
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<CommentActionState, FormData>(
    editComment,
    { ok: false, error: null }
  );
  const [value, setValue] = useState(comment.body);

  // Leave edit mode once the update succeeds.
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.ok) setEditing(false);
  }

  const canEdit = comment.isOwn;
  const canDelete = comment.isOwn || canModerate;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={s.author}>{comment.authorName}</span>
        <span className={s.meta}>{comment.createdAtLabel}</span>
      </div>

      {editing ? (
        <form action={formAction} className="mt-2 space-y-3">
          <input type="hidden" name="commentId" value={comment.id} />
          <input type="hidden" name="slug" value={slug} />
          <textarea
            name="body"
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={s.textarea}
          />
          {state.error ? (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <button type="submit" className={s.submit} disabled={pending}>
              {pending ? "Bezig…" : "Opslaan"}
            </button>
            <button
              type="button"
              className={s.action}
              onClick={() => {
                setValue(comment.body);
                setEditing(false);
              }}
            >
              Annuleren
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className={`mt-1.5 ${s.body}`}>{comment.body}</p>
          {canEdit || canDelete ? (
            <div className="mt-2 flex items-center gap-3">
              {canEdit ? (
                <button
                  type="button"
                  className={s.action}
                  onClick={() => {
                    setValue(comment.body);
                    setEditing(true);
                  }}
                >
                  Bewerken
                </button>
              ) : null}
              {canDelete ? (
                <form action={deleteComment} className="inline">
                  <input type="hidden" name="commentId" value={comment.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button type="submit" className={s.action}>
                    Verwijderen
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
