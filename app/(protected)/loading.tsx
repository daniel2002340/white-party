// Generic loading fallback for protected routes. A quiet spinner (static under
// reduced-motion) with Dutch text.
export default function Loading() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center px-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3 text-sm text-muted">
        <span
          aria-hidden="true"
          className="h-6 w-6 rounded-full border-2 border-border border-t-accent motion-safe:animate-spin"
        />
        Laden…
      </div>
    </div>
  );
}
