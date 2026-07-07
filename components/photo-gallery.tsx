"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CommentSection, type CommentView } from "@/components/comment-section";

export type GalleryPhoto = {
  id: string;
  thumbUrl: string;
  webUrl: string;
  downloadUrl: string;
  width: number;
  height: number;
};

export type PhotoComments = {
  editionId: string;
  slug: string;
  canModerate: boolean;
  byPhotoId: Record<string, CommentView[]>;
};

export function PhotoGallery({
  photos,
  filenamePrefix,
  altPrefix,
  comments,
}: {
  photos: GalleryPhoto[];
  filenamePrefix: string;
  altPrefix: string;
  comments: PhotoComments;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;
  const count = photos.length;

  const close = useCallback(() => setOpenIndex(null), []);
  const prev = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i - 1 + count) % count)),
    [count]
  );
  const next = useCallback(
    () => setOpenIndex((i) => (i === null ? i : (i + 1) % count)),
    [count]
  );

  // Keyboard navigation + body scroll lock while the lightbox is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack keys while typing a comment: let the field handle
      // Escape/arrows (cursor movement) instead of navigating/closing.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) {
        return;
      }
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, close, prev, next]);

  // Preload the adjacent web images for snappy navigation.
  useEffect(() => {
    if (openIndex === null || count < 2) return;
    for (const i of [(openIndex + 1) % count, (openIndex - 1 + count) % count]) {
      const img = new window.Image();
      img.src = photos[i].webUrl;
    }
  }, [openIndex, photos, count]);

  return (
    <>
      {/* Masonry via CSS columns; 4px gaps, no borders/shadows on photos. */}
      <div className="columns-2 [column-gap:4px] sm:columns-3 lg:columns-4">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setOpenIndex(i)}
            className="mb-1 block w-full overflow-hidden break-inside-avoid bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumbUrl}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              alt={`${altPrefix} — foto ${i + 1}`}
              className="block h-auto w-full transition-transform duration-300 hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>

      {isOpen ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          filenamePrefix={filenamePrefix}
          altPrefix={altPrefix}
          comments={comments}
          onClose={close}
          onPrev={prev}
          onNext={next}
        />
      ) : null}
    </>
  );
}

function Lightbox({
  photos,
  index,
  filenamePrefix,
  altPrefix,
  comments,
  onClose,
  onPrev,
  onNext,
}: {
  photos: GalleryPhoto[];
  index: number;
  filenamePrefix: string;
  altPrefix: string;
  comments: PhotoComments;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const photo = photos[index];
  const [controlsVisible, setControlsVisible] = useState(true);
  const photoComments = comments.byPhotoId[photo.id] ?? [];
  // Bumped on any interaction/navigation to (re)start the fade timer.
  const [activity, setActivity] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Any interaction (mouse, touch, keyboard) reveals the controls.
  const poke = useCallback(() => {
    setControlsVisible(true);
    setActivity((a) => a + 1);
  }, []);

  // Reveal controls when the shown photo changes (navigation) — a guarded
  // render-phase adjustment rather than a setState-in-effect.
  const [shownIndex, setShownIndex] = useState(index);
  if (shownIndex !== index) {
    setShownIndex(index);
    setControlsVisible(true);
    setActivity((a) => a + 1);
  }

  // Fade the controls 1.5s after the last activity. setState runs only inside
  // the async timeout, so nothing is set synchronously in the effect body.
  useEffect(() => {
    const timer = setTimeout(() => setControlsVisible(false), 1500);
    return () => clearTimeout(timer);
  }, [activity]);

  // Focus trap: move focus into the dialog on open, keep Tab inside it, and
  // restore focus to the trigger on close. Keyboard activity also reveals the
  // (otherwise auto-fading) controls.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      poke();
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input'
      );
      if (!focusables || focusables.length === 0) {
        e.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [poke]);

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    poke();
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onNext();
      else onPrev();
    }
    touchStart.current = null;
  }

  const filename = `${filenamePrefix}-${index + 1}.jpg`;
  const controlCls = `transition-opacity duration-300 ${
    controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
  }`;
  const btnCls =
    "flex h-11 w-11 items-center justify-center rounded-full bg-black/5 text-2xl leading-none text-foreground hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-background focus:outline-none sm:flex-row"
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${index + 1} van ${photos.length}`}
    >
      {/* Image region — click the backdrop to close, swipe to navigate. */}
      <div
        className="relative min-h-0 flex-1"
        onMouseMove={poke}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={onClose}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.webUrl}
            alt={`${altPrefix} — foto ${index + 1}`}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full select-none object-contain"
          />
        </div>

        {/* Counter (top-left) */}
        <div className={`absolute left-4 top-4 text-sm text-secondary ${controlCls}`}>
          {index + 1} / {photos.length}
        </div>

        {/* Download + close (top-right) */}
        <div className={`absolute right-3 top-3 flex items-center gap-2 ${controlCls}`}>
          <a
            href={photo.downloadUrl}
            download={filename}
            onClick={(e) => e.stopPropagation()}
            className="flex h-11 items-center rounded-full bg-black/5 px-4 text-sm text-foreground hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Download
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Sluiten"
            className={btnCls}
          >
            ✕
          </button>
        </div>

        {/* Prev / next */}
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              aria-label="Vorige foto"
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${btnCls} ${controlCls}`}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              aria-label="Volgende foto"
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${btnCls} ${controlCls}`}
            >
              ›
            </button>
          </>
        ) : null}
      </div>

      {/* Comments sidebar — always visible. Right column on desktop, bottom
          panel on mobile. Its own header stays put while the list scrolls. */}
      <aside className="flex h-[40dvh] min-h-0 shrink-0 flex-col border-t border-border bg-surface sm:h-auto sm:w-[24rem] sm:border-l sm:border-t-0">
        <div className="border-b border-border px-6 py-4">
          <p className="eyebrow">
            Reacties{photoComments.length > 0 ? ` (${photoComments.length})` : ""}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <CommentSection
            editionId={comments.editionId}
            slug={comments.slug}
            photoId={photo.id}
            comments={photoComments}
            canModerate={comments.canModerate}
            tone="light"
          />
        </div>
      </aside>
    </div>
  );
}
