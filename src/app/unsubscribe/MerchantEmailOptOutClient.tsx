"use client";

/**
 * Merchant email opt-out — /unsubscribe?m=<offerMerchantId>&k=merchant-emails&t=<hmac>
 *
 * The footer link on admin-sent merchant emails (updates, announcements).
 * Only stops those; notices about their own nights are set on their
 * dashboard and keep coming.
 *
 * Fires on a button, not on load: mail scanners open every link in a message,
 * and unsubscribing on load would opt merchants out before they read the email.
 */

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default function MerchantEmailOptOutClient({
  merchantId,
  token,
}: {
  merchantId: string;
  token: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run("unsubscribeMerchantFromEmails", { merchantId, token });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!merchantId || !token) {
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
        <p className="mt-4 text-[15px] leading-relaxed text-zinc-600">
          You&rsquo;ll still get notices about your own nights. Change those from your
          dashboard.
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="text-xl font-semibold text-zinc-900">
        Unsubscribe from Leaf partner updates?
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
        Your nights stay booked and you&rsquo;ll still get notices about them. This
        only stops general updates.
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
