"use client";

import { useEffect } from "react";

// Catches errors thrown in the root layout itself. It replaces the whole
// document, so it renders its own <html>/<body> with inline styles (the design
// tokens may not be available here). Kept minimal and Dutch.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="nl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FAFAF7",
          color: "#1B1B1B",
          fontFamily: "Inter, system-ui, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: "0 0 12px" }}>
            Sorry, er is een fout opgetreden
          </h1>
          <p style={{ color: "#5A5A5F", margin: "0 0 24px" }}>
            Probeer het opnieuw. Blijft het misgaan? Laat het ons weten.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              backgroundColor: "#1B1B1B",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 6,
              padding: "11px 20px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Probeer opnieuw
          </button>
        </div>
      </body>
    </html>
  );
}
