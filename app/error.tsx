"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Route-level error boundary. Shows a friendly Dutch message — never a raw
// error string or stack trace — and offers a retry.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the real error server-side/console for debugging; keep it off-screen.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6 py-20 text-center">
      <p className="eyebrow">Er ging iets mis</p>
      <h1 className="mt-4 font-display text-4xl font-semibold text-foreground">
        Sorry, er is een fout opgetreden
      </h1>
      <p className="mt-4 text-secondary">
        Probeer het opnieuw. Blijft het misgaan? Laat het ons weten.
      </p>
      <div className="mt-8 flex justify-center">
        <Button onClick={() => reset()}>Probeer opnieuw</Button>
      </div>
    </div>
  );
}
