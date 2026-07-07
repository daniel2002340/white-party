// Skeleton for the (photo-heavy, presign-on-render) edition detail page.
// Static blocks under reduced-motion; pulse otherwise.
export default function Loading() {
  return (
    <div className="py-20 sm:py-24" role="status" aria-live="polite">
      <div className="mx-auto max-w-3xl px-6">
        <div className="h-3 w-24 rounded bg-border motion-safe:animate-pulse" />
        <div className="mt-5 h-12 w-3/4 rounded bg-border motion-safe:animate-pulse" />
        <div className="mt-5 h-4 w-1/2 rounded bg-border motion-safe:animate-pulse" />
        <div className="mt-12 space-y-3">
          <div className="h-3 w-full rounded bg-border motion-safe:animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-border motion-safe:animate-pulse" />
          <div className="h-3 w-4/6 rounded bg-border motion-safe:animate-pulse" />
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-6xl px-6">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-border motion-safe:animate-pulse"
            />
          ))}
        </div>
      </div>

      <span className="sr-only">Laden…</span>
    </div>
  );
}
