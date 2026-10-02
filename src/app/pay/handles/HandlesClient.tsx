"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import PayHandlesForm, { describeHandles, type PayHandles } from "@/components/p2p/PayHandlesForm";

export default function HandlesClient({ viewer }: { viewer: { userId: string; token: string } | null }) {
  // undefined = loading; null = signed out or none saved (see `signedIn`).
  const [handles, setHandles] = useState<PayHandles | null | undefined>(undefined);
  const [signedIn, setSignedIn] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      // Same trade /me makes for its digest links.
      if (viewer && Parse.User.current()?.id !== viewer.userId) {
        try {
          const r = (await Parse.Cloud.run("getDashboardSession", viewer)) as { sessionToken?: string } | null;
          if (r?.sessionToken?.startsWith("r:")) await Parse.User.become(r.sessionToken);
        } catch { /* falls to the signed-out message */ }
      }
      if (viewer) {
        const url = new URL(window.location.href);
        url.searchParams.delete("u");
        url.searchParams.delete("vt");
        window.history.replaceState(null, "", url.toString());
      }
      if (!Parse.User.current()) {
        setSignedIn(false);
        setHandles(null);
        return;
      }
      try {
        const r = (await Parse.Cloud.run("getMyPayHandles", {})) as { handles: PayHandles | null };
        setHandles(r.handles);
      } catch {
        setHandles(null);
      }
    })();
  }, [viewer]);

  return (
    <main className="ph2">
      <style>{CSS}</style>
      <div className="ph2-in">
        <p className="ph2-eyebrow">Getting paid back</p>
        <h1 className="ph2-title">Where you get paid</h1>
        <div className="ph2-card">
          {handles === undefined ? (
            <p className="ph2-muted">Loading…</p>
          ) : !signedIn ? (
            <p className="ph2-muted">Open the link from your text again, or <Link href="/me">sign in to Leaf</Link>.</p>
          ) : saved ? (
            <>
              <p className="ph2-h">Saved ✓</p>
              <p className="ph2-muted">Paid to {describeHandles(handles)}. Whoever takes your seat can pay you back now.</p>
            </>
          ) : (
            <PayHandlesForm initial={handles} onSaved={(h) => { setHandles(h); setSaved(true); }} />
          )}
        </div>
      </div>
    </main>
  );
}

const CSS = `
.ph2{min-height:100vh;background:#faf9f7;color:#17150f;font-family:var(--font-geist-sans,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif)}
.ph2-in{max-width:480px;margin:0 auto;padding:32px 16px 48px}
.ph2 p{margin:0}
.ph2-eyebrow{font-family:var(--font-geist-mono,ui-monospace,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8b8578}
.ph2-title{font-size:26px;font-weight:500;margin:6px 0 18px}
.ph2-card{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:14px;padding:18px;display:grid;gap:8px}
.ph2-h{font-size:17px;font-weight:600}
.ph2-muted{color:#6f6a5f;font-size:13px}
.ph2-muted a{text-decoration:underline}
`;
