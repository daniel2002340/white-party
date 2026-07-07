"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_BYTES = 30 * 1024 * 1024;
const CONCURRENCY = 2;

type UploadStatus = "queued" | "uploading" | "processing" | "done" | "error";

type UploadItem = {
  id: string;
  file: File;
  contentType: string;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  error?: string;
};

const STATUS_LABEL: Record<UploadStatus, string> = {
  queued: "In wachtrij",
  uploading: "Uploaden",
  processing: "Verwerken",
  done: "Klaar",
  error: "Mislukt",
};

// Some browsers report an empty MIME type for .heic; infer from the extension.
function resolveContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload mislukt (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload mislukt (netwerk)"));
    xhr.send(file);
  });
}

export function PhotoUploader({ editionId }: { editionId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function processItem(item: UploadItem) {
    try {
      updateItem(item.id, { status: "uploading", progress: 0 });

      const presignRes = await fetch("/api/admin/photos/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          editionId,
          filename: item.file.name,
          contentType: item.contentType,
          size: item.file.size,
        }),
      });
      if (!presignRes.ok) {
        const body = await presignRes.json().catch(() => ({}));
        throw new Error(body.error || "Aanvraag mislukt.");
      }
      const { photoId, uploadUrl } = await presignRes.json();

      await putWithProgress(uploadUrl, item.file, item.contentType, (pct) =>
        updateItem(item.id, { progress: pct })
      );

      updateItem(item.id, { status: "processing" });
      const procRes = await fetch(`/api/admin/photos/${photoId}/process`, {
        method: "POST",
      });
      if (!procRes.ok) {
        const body = await procRes.json().catch(() => ({}));
        throw new Error(body.error || "Verwerking mislukt.");
      }

      updateItem(item.id, { status: "done", progress: 100 });
    } catch (error) {
      updateItem(item.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Onbekende fout.",
      });
    }
  }

  // Run a batch of items through a fixed-size worker pool (concurrency 2), then
  // refresh so the server-rendered grid picks up the new READY photos.
  async function runBatch(batch: UploadItem[]) {
    setBusy(true);
    const queue = [...batch];
    const worker = async () => {
      while (queue.length) {
        const next = queue.shift();
        if (next) await processItem(next);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setBusy(false);
    router.refresh();
  }

  function addFiles(fileList: FileList | File[]) {
    const incoming: UploadItem[] = [];
    for (const file of Array.from(fileList)) {
      const contentType = resolveContentType(file);
      const id = `${file.name}-${file.size}-${file.lastModified}-${Math.round(
        file.size * 7
      )}-${incoming.length}`;
      const base = {
        id,
        file,
        contentType,
        previewUrl: URL.createObjectURL(file),
      };
      if (!ACCEPTED_TYPES.has(contentType)) {
        incoming.push({
          ...base,
          status: "error",
          progress: 0,
          error: "Niet-ondersteund bestandstype.",
        });
      } else if (file.size > MAX_BYTES) {
        incoming.push({
          ...base,
          status: "error",
          progress: 0,
          error: "Bestand is te groot (max 30 MB).",
        });
      } else {
        incoming.push({ ...base, status: "queued", progress: 0 });
      }
    }

    setItems((prev) => [...prev, ...incoming]);
    const uploadable = incoming.filter((it) => it.status === "queued");
    if (uploadable.length) void runBatch(uploadable);
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius)] border border-dashed px-6 py-12 text-center transition-colors ${
          dragOver
            ? "border-accent bg-background"
            : "border-border-strong bg-surface hover:bg-background"
        }`}
      >
        <p className="font-medium text-foreground">
          Sleep foto&apos;s hierheen of klik om te kiezen
        </p>
        <p className="mt-1 text-sm text-muted">
          JPEG, PNG, WebP of HEIC — max 30 MB per foto
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 border-b border-border py-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt=""
                className="h-10 w-10 flex-none rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-foreground">
                    {item.file.name}
                  </span>
                  <span
                    className={`flex-none text-xs ${
                      item.status === "error"
                        ? "text-danger"
                        : item.status === "done"
                          ? "text-success"
                          : "text-muted"
                    }`}
                  >
                    {item.status === "uploading"
                      ? `${STATUS_LABEL.uploading} ${item.progress}%`
                      : STATUS_LABEL[item.status]}
                  </span>
                </div>
                {/* progress track */}
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-border">
                  <div
                    className={`h-full transition-all ${
                      item.status === "error" ? "bg-danger" : "bg-ink"
                    }`}
                    style={{
                      width:
                        item.status === "done"
                          ? "100%"
                          : item.status === "processing"
                            ? "100%"
                            : `${item.progress}%`,
                    }}
                  />
                </div>
                {item.error ? (
                  <p className="mt-1 text-xs text-danger">{item.error}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {busy ? (
        <p className="mt-4 text-sm text-muted">Bezig met uploaden…</p>
      ) : null}
    </div>
  );
}
