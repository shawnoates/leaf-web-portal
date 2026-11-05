"use client";

/**
 * The plan modal's payments summary, once the plan collects money: how much
 * has come in, as a bar, linking to the full roster on /pay/[planId].
 * Data: getP2pRoster (server: cloud/p2p-payment.js), as the signed-in host.
 */

import Link from "next/link";
import { ChevronRight, DollarSign } from "lucide-react";
import { p2pMoney } from "@/lib/p2p";

type Status = "pending_lock" | "unpaid" | "claimed" | "confirmed" | "expired";

export type P2pRosterSummary = {
  p2pPayment: { amountCents?: number | null } | null;
  split?: {
    totalCents: number;
    minHeadcount: number;
    headcount: number;
    locked: boolean;
    belowMin: boolean;
    shareCents: number;
  } | null;
  toCollectCents?: number;
  confirmedCents?: number;
  claimedCents?: number;
  guests: { status: Status }[];
};

export default function PlanPaymentsProgress({
  planId,
  roster,
  focusRing,
}: {
  planId: string;
  roster: P2pRosterSummary;
  focusRing: string;
}) {
  const guests = roster.guests.filter((g) => g.status !== "expired");
  const paid = guests.filter((g) => g.status === "confirmed").length;
  const claimed = guests.filter((g) => g.status === "claimed").length;
  const openSplit = roster.split && !roster.split.locked ? roster.split : null;
  const collected = roster.confirmedCents || 0;
  const target = roster.toCollectCents || 0;
  // No capacity means no dollar target: fall back to seats paid.
  const pct = target
    ? Math.min(100, Math.round((collected / target) * 100))
    : guests.length ? Math.round((paid / guests.length) * 100) : 0;

  return (
    <Link
      href={`/pay/${planId}`}
      className={`block rounded-xl border border-zinc-200 bg-white px-4 py-3 no-underline hover:border-zinc-300 transition-colors ${focusRing}`}
    >
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-zinc-500 shrink-0" aria-hidden />
        <p className="flex-1 min-w-0 text-sm text-zinc-900">
          {openSplit ? (
            <>
              <span className="font-semibold">{p2pMoney(openSplit.totalCents)}</span>
              <span className="text-zinc-500"> to split</span>
            </>
          ) : (
            <>
              <span className="font-semibold">{p2pMoney(collected)}</span>
              {target > 0 && <span className="text-zinc-500"> of {p2pMoney(target)} collected</span>}
              {!target && <span className="text-zinc-500"> collected</span>}
            </>
          )}
        </p>
        <span className="shrink-0 inline-flex items-center text-xs font-medium text-zinc-600">
          Payments
          <ChevronRight className="w-3.5 h-3.5" aria-hidden />
        </span>
      </div>
      {!openSplit && (
        <div
          className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Collected so far"
        >
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className="mt-1.5 text-xs text-zinc-500">
        {openSplit
          ? openSplit.belowMin
            ? `${openSplit.headcount} in · needs ${openSplit.minHeadcount} to lock`
            : `${p2pMoney(openSplit.shareCents)} each with ${openSplit.headcount} right now`
          : guests.length
            ? `${paid} of ${guests.length} paid${claimed ? ` · ${claimed} to confirm` : ""}`
            : "No one has a seat yet"}
      </p>
    </Link>
  );
}
