"use client";

/**
 * "Get paid": the merchant's payout setup, on their acceptance form.
 *
 * Ticket money for their night is held by Leaf and sent to them after the
 * night runs, less Leaf's 10%, through Stripe. This connects their bank
 * account (Stripe Express onboarding, hosted by Stripe). Coming back from
 * Stripe lands on ?payouts=done, and the status is re-read.
 */

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";

export default function PayoutSetup({ token }: { token: string }) {
  const [status, setStatus] = useState<{ connected: boolean; payoutsEnabled: boolean; detailsSubmitted?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Parse.Cloud.run("getMerchantPayoutStatus", { token })
      .then((st: { connected: boolean; payoutsEnabled: boolean; detailsSubmitted?: boolean }) => alive && setStatus(st))
      .catch(() => alive && setStatus({ connected: false, payoutsEnabled: false }));
    return () => {
      alive = false;
    };
  }, [token]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("createMerchantPayoutLink", { token })) as { url: string };
      window.location.href = r.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open payout setup.");
      setBusy(false);
    }
  };

  if (!status) return null;
  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-[15px] font-semibold text-leaf-900">Get paid for your night</p>
      {status.payoutsEnabled ? (
        <p className="mt-2 text-[15px] text-zinc-700">Payouts are set up. Ticket sales, less our 10%, go to your bank after the night.</p>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">
            Neighbors pay for tickets through Leaf. After the night we send you the ticket sales, less our 10%. Connect your bank
            account with Stripe so it can land. It takes a few minutes.
            {status.detailsSubmitted ? " Stripe is still checking your details." : ""}
          </p>
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-leaf-800 px-4 py-3 text-[15px] font-semibold text-white hover:bg-leaf-900 disabled:opacity-40"
          >
            {busy ? "Opening Stripe…" : status.connected ? "Finish payout setup" : "Set up payouts"}
          </button>
        </>
      )}
      {error && <p className="mt-2 text-[14px] text-red-700">{error}</p>}
    </div>
  );
}
