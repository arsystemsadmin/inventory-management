"use client";

/** Last-resort error screen (replaces the root layout when it fails). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, padding: 16 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong · משהו השתבש</h1>
          <p style={{ color: "#666", fontSize: 14 }}>Your data is safe. Please try again. · הנתונים שלך בטוחים. נסו שוב.</p>
          {error.digest && <p style={{ color: "#999", fontSize: 12 }}>Error code: {error.digest}</p>}
          <button onClick={reset} style={{ marginTop: 8, padding: "10px 18px", borderRadius: 8, border: "1px solid #ccc", background: "#111", color: "#fff" }}>
            Try again · נסו שוב
          </button>
        </div>
      </body>
    </html>
  );
}
