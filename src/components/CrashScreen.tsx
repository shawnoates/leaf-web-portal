"use client";

import { useEffect } from "react";

// What the app shows when a page throws while rendering, in place of Next's
// built-in "This page couldn't load". Same look, two additions:
//   1. the error is sent to /api/client-error, which writes it to the server
//      log, so a crash on someone's phone can be found and read later;
//   2. the message itself is printed small under the buttons, so a screenshot
//      of the screen says what broke.
// Client errors keep their real message in production (only server-component
// errors are reduced to a digest), so the message is worth showing.

type Props = {
  error: Error & { digest?: string };
  retry: () => void;
  where: "page" | "root";
};

const reported = new WeakSet<Error>();

function report(error: Error & { digest?: string }, where: string) {
  if (reported.has(error)) return;
  reported.add(error);
  try {
    const body = JSON.stringify({
      where,
      message: String(error?.message || error).slice(0, 1000),
      name: error?.name,
      digest: error?.digest,
      stack: String(error?.stack || "").slice(0, 4000),
      // Path only: query strings can carry tokens (host links, claim links).
      path: window.location.pathname,
      userAgent: navigator.userAgent,
      at: new Date().toISOString(),
    });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/client-error", blob)) {
      void fetch("/api/client-error", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
    }
  } catch {
    // Reporting must never throw from the error screen.
  }
}

export default function CrashScreen({ error, retry, where }: Props) {
  useEffect(() => {
    console.error(error);
    report(error, where);
  }, [error, where]);

  const detail = [error?.name && error.name !== "Error" ? error.name : null, error?.message, error?.digest ? `(${error.digest})` : null]
    .filter(Boolean)
    .join(": ");

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#fff", color: "#18181b", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 360, width: "100%" }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "16px 0 8px", letterSpacing: "-0.01em" }}>This page couldn&rsquo;t load</h1>
        <p style={{ fontSize: 15, color: "#3f3f46", margin: "0 0 20px" }}>Reload to try again, or go back.</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => { try { retry(); } catch { window.location.reload(); } }}
            style={{ background: "#18181b", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px", fontSize: 15, fontWeight: 500, cursor: "pointer" }}
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            style={{ background: "#fff", color: "#18181b", border: "1px solid #e4e4e7", borderRadius: 8, padding: "10px 16px", fontSize: 15, fontWeight: 500, cursor: "pointer" }}
          >
            Back
          </button>
        </div>
        {detail && (
          <p style={{ marginTop: 28, fontSize: 11, lineHeight: 1.5, color: "#a1a1aa", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-word" }}>
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
