"use client";

/**
 * "Get paid": the merchant's payout setup, on their acceptance form.
 *
 * Ticket money for their night is held by Leaf and sent to them after the
 * night runs, less Leaf's per-ticket fee (theirs, from the server: $6 unless
 * agreed otherwise; nothing on their free first night), through Stripe. This connects their bank
 * account (Stripe Express onboarding, hosted by Stripe). Coming back from
 * Stripe lands on ?payouts=done, and the status is re-read.
 */

import { useEffect, useState } from "react";
import { merchantRun } from "@/lib/merchant-session";

type PayoutStatus = { connected: boolean; payoutsEnabled: boolean; detailsSubmitted?: boolean; feeCents?: number; feePct?: number | null; firstNightFree?: boolean };

/** "less our $6 a ticket", or "nothing on your first night, then $2 a ticket". */
function feeLine(st: PayoutStatus) {
  const c = st.feeCents ?? 600;
  const fee = st.feePct ? `${st.feePct}%` : `$${c % 100 ? (c / 100).toFixed(2) : c / 100} a ticket`;
  return st.firstNightFree ? `all of it on your first night, then less our ${fee}` : `less our ${fee}`;
}

export default function PayoutSetup({ token }: { token: string }) {
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    merchantRun<PayoutStatus>("getMerchantPayoutStatus", { token })
      .then((st) => alive && setStatus(st))
      .catch(() => alive && setStatus({ connected: false, payoutsEnabled: false }));
    return () => {
      alive = false;
    };
  }, [token]);

  // Stripe login links work once and expire fast, so one is made per tap.
  const openStripe = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await merchantRun("createMerchantStripeLoginLink", { token })) as { url: string };
      window.location.href = r.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open Stripe.");
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await merchantRun("createMerchantPayoutLink", { token })) as { url: string };
      window.location.href = r.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open payout setup.");
      setBusy(false);
    }
  };

  if (!status) return null;
  return (
    <div id="payouts" className="mt-6 scroll-mt-6 rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-[15px] font-semibold text-leaf-900">Get paid for your night</p>
      {status.payoutsEnabled ? (
        <>
          <p className="mt-2 text-[15px] text-zinc-700">Payouts are set up. We send ticket sales, {feeLine(status)}, the morning after each night. Your bank usually has it within a few business days.</p>
          <button
            type="button"
            onClick={openStripe}
            disabled={busy}
            className="mt-4 w-full rounded-xl border border-zinc-300 px-4 py-3 text-[15px] font-semibold text-leaf-900 hover:bg-zinc-50 disabled:opacity-40"
          >
            {busy ? "Opening Stripe…" : "View your payouts in Stripe"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">
            Neighbors pay for tickets through Leaf. The morning after the night we send you the ticket sales, {feeLine(status)}; your bank usually has it within a few business days. Connect your bank
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
