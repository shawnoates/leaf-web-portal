"use client";

/**
 * Host email opt-out — /unsubscribe?h=<rosterHostId>&k=host-emails&t=<hmac>
 *
 * The footer link on admin-sent host emails (updates, announcements). Only
 * stops those; offers for nights are a separate opt-out, linked from the
 * confirmation for anyone who wants both.
 *
 * Fires on a button, not on load: mail scanners open every link in a message,
 * and unsubscribing on load would opt hosts out before they read the email.
 */

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function HostEmailOptOutClient({
  hostId,
  token,
}: {
  hostId: string;
  token: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [offersOptOutUrl, setOffersOptOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await Parse.Cloud.run("unsubscribeHostFromEmails", { hostId, token });
      setOffersOptOutUrl(r.offersOptOutUrl ?? null);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!hostId || !token) {
    return (
      <Frame>
        <AlertCircle className="h-6 w-6 text-red-600" />
        <h1 className="mt-3 text-xl font-semibold text-zinc-900">
          That link is incomplete
        </h1>
        <p className="mt-2 text-[15px] text-zinc-600">
          Try tapping it again from the original email.
        </p>
      </Frame>
    );
  }

  if (done) {
    return (
      <Frame>
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        <h1 className="mt-3 text-xl font-semibold text-zinc-900">
          You&rsquo;re unsubscribed.
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
          We won&rsquo;t send you any more updates like that one. If you change your
          mind, just reply to any of our emails.
        </p>
        {offersOptOutUrl && (
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-600">
            You&rsquo;ll still hear from us when there&rsquo;s a night for you to host.{" "}
            <a href={offersOptOutUrl} className="font-medium text-zinc-900 underline">
              Stop those too
            </a>
          </p>
        )}
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="text-xl font-semibold text-zinc-900">
        Unsubscribe from Leaf host updates?
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
        You&rsquo;ll stay on the host list and still hear about nights you could
        host. This only stops general updates.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={run}
        disabled={busy}
        className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-[15px] font-medium text-white disabled:opacity-50"
      >
        {busy ? "One moment…" : "Unsubscribe"}
      </button>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">{children}</div>
    </main>
  );
}
