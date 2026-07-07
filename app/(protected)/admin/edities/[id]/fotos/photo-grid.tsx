"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { movePhoto, setCoverPhoto, deletePhoto } from "./actions";

export type GridPhoto = {
  id: string;
  status: string;
  thumbUrl: string | null;
  isCover: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  UPLOADING: "Uploaden…",
  PROCESSING: "Verwerken…",
  FAILED: "Mislukt",
};

export function PhotoGrid({ photos }: { photos: GridPhoto[] }) {
  if (photos.length === 0) {
    return (
      <p className="mt-8 text-secondary">
        Nog geen foto&apos;s. Upload de eerste hierboven.
      </p>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo, index) => (
        <div key={photo.id}>
          <div className="relative aspect-square overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
            {photo.status === "READY" && photo.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.thumbUrl}
                alt={`Foto ${index + 1}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                {STATUS_LABEL[photo.status] ?? photo.status}
              </div>
            )}
            {photo.isCover ? (
              <span className="absolute left-2 top-2">
                <Badge variant="accent">Omslag</Badge>
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <form action={movePhoto}>
              <input type="hidden" name="photoId" value={photo.id} />
              <input type="hidden" name="direction" value="up" />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={index === 0}
                aria-label="Naar voren"
              >
                ↑
              </Button>
            </form>
            <form action={movePhoto}>
              <input type="hidden" name="photoId" value={photo.id} />
              <input type="hidden" name="direction" value="down" />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={index === photos.length - 1}
                aria-label="Naar achteren"
              >
                ↓
              </Button>
            </form>

            {!photo.isCover && photo.status === "READY" ? (
              <form action={setCoverPhoto}>
                <input type="hidden" name="photoId" value={photo.id} />
                <Button type="submit" variant="secondary" size="sm">
                  Omslag
                </Button>
              </form>
            ) : null}

            <form
              action={deletePhoto}
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    "Weet je zeker dat je deze foto wilt verwijderen? De bestanden worden ook uit de opslag verwijderd."
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="photoId" value={photo.id} />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                className="text-danger hover:text-danger"
                aria-label="Verwijderen"
              >
                ✕
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
