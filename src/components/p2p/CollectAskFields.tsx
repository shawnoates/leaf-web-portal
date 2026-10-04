"use client";

import type { ReactNode } from "react";

/**
 * "Collect money" for a plan that isn't created yet: a follower's request to
 * host on a calendar (/org), and the calendar reviewing that request
 * (CreatePlanModal in approval mode). The ask is approved with the plan
 * (server: requestCustomPlanViaWeb → approveHostRequest), so these are plain
 * fields with no saving of their own. Where guests pay goes in `children`.
 */

export type CollectAsk = {
  on: boolean;
  mode: "fixed" | "split";
  price: string;
  spots: string;
  total: string;
  min: string;
  max: string;
  mine: boolean;
};

export const EMPTY_COLLECT_ASK: CollectAsk = {
  on: false, mode: "fixed", price: "", spots: "", total: "", min: "", max: "", mine: true,
};

/** What a request asked for (server `requestedP2p`), as fields. */
export type RequestedP2p = {
  mode: "fixed" | "split";
  amountCents?: number;
  ticketCount?: number;
  hostHasTicket?: boolean;
  totalCents?: number;
  minHeadcount?: number;
  maxHeadcount?: number;
  hostInSplit?: boolean;
};

const dollarsField = (cents?: number) => (cents ? String(cents / 100) : "");
const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export function collectAskFrom(p2p: RequestedP2p | null | undefined): CollectAsk {
  if (!p2p) return EMPTY_COLLECT_ASK;
  return p2p.mode === "split"
    ? { ...EMPTY_COLLECT_ASK, on: true, mode: "split", total: dollarsField(p2p.totalCents),
      min: String(p2p.minHeadcount ?? ""), max: String(p2p.maxHeadcount ?? ""), mine: p2p.hostInSplit !== false }
    : { ...EMPTY_COLLECT_ASK, on: true, mode: "fixed", price: dollarsField(p2p.amountCents),
      spots: String(p2p.ticketCount ?? ""), mine: p2p.hostHasTicket !== false };
}

/** The server payload, or the first thing to fix. `p2p` is null when not collecting. */
export function collectAskPayload(a: CollectAsk): { p2p: RequestedP2p | null; error: string | null } {
  if (!a.on) return { p2p: null, error: null };
  if (a.mode === "split") {
    const totalCents = Math.round(parseFloat(a.total || "0") * 100);
    const min = parseInt(a.min || "0", 10);
    const max = parseInt(a.max || "0", 10);
    if (!(totalCents >= 100)) return { p2p: null, error: "Enter the total you paid." };
    if (!(min >= 2) || !(max >= min)) return { p2p: null, error: "Enter the fewest and most people (most at least the fewest)." };
    return { p2p: { mode: "split", totalCents, minHeadcount: min, maxHeadcount: max, hostInSplit: a.mine }, error: null };
  }
  const amountCents = Math.round(parseFloat(a.price || "0") * 100);
  const ticketCount = parseInt(a.spots || "0", 10);
  if (!(amountCents >= 100)) return { p2p: null, error: "Price per spot must be at least $1." };
  if (!(ticketCount >= 1)) return { p2p: null, error: "How many tickets or spots are there?" };
  if (ticketCount - (a.mine ? 1 : 0) < 1) return { p2p: null, error: "With one spot for you, there are none left for guests." };
  return { p2p: { mode: "fixed", amountCents, ticketCount, hostHasTicket: a.mine }, error: null };
}

/** "Guests pay $25 a spot" / "Guests split $180 ($30–$45 each)". */
export function collectAskLine(p2p: RequestedP2p | null | undefined): string | null {
  if (!p2p) return null;
  if (p2p.mode === "split" && p2p.totalCents && p2p.minHeadcount && p2p.maxHeadcount) {
    const low = Math.ceil(p2p.totalCents / p2p.maxHeadcount);
    const high = Math.ceil(p2p.totalCents / p2p.minHeadcount);
    return `Guests split ${money(p2p.totalCents)} (${money(low)}–${money(high)} each)`;
  }
  return p2p.amountCents ? `Guests pay ${money(p2p.amountCents)} a spot` : null;
}

const input = "w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900";
const label = "text-[11px] font-bold uppercase tracking-widest text-zinc-400 block mb-1";

export default function CollectAskFields({
  value,
  onChange,
  title = "Collect money",
  subtitle = "Guests pay you back directly on Venmo, Cash App, PayPal or Zelle. No fees.",
  self = true,
  children,
}: {
  value: CollectAsk;
  onChange: (next: CollectAsk) => void;
  title?: string;
  subtitle?: string;
  /** Filled in by the host themselves (vs. a calendar reviewing their request). */
  self?: boolean;
  children?: ReactNode;
}) {
  const set = (patch: Partial<CollectAsk>) => onChange({ ...value, ...patch });
  const { p2p } = collectAskPayload(value);
  const preview = (() => {
    if (!p2p) return null;
    if (p2p.mode === "split") {
      return `${collectAskLine(p2p)?.replace(/^Guests split [^(]+\(/, "").replace(/\)$/, "")}, depending on how many come. Locks a day before.`;
    }
    const guests = (p2p.ticketCount ?? 0) - (p2p.hostHasTicket ? 1 : 0);
    return `${guests} ${guests === 1 ? "spot" : "spots"} for guests · a full plan pays ${self ? "you" : "the host"} back ${money((p2p.amountCents ?? 0) * guests)}`;
  })();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-xs tracking-wider uppercase font-bold">{title}</p>
          <p className="text-xs text-zinc-400 font-light">{subtitle}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value.on}
          aria-label={title}
          onClick={() => set({ on: !value.on })}
          className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ml-3 ${value.on ? "bg-zinc-900" : "bg-zinc-200"}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value.on ? "left-5" : "left-0.5"}`} />
        </button>
      </div>
      {value.on && (
        <>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How guests pay">
            {(["fixed", "split"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={value.mode === m}
                onClick={() => set({ mode: m })}
                className={`text-left rounded-lg border px-3 py-2 text-xs font-medium ${value.mode === m ? "border-zinc-900 bg-zinc-50 text-zinc-900" : "border-zinc-200 text-zinc-500"}`}
              >
                {m === "fixed" ? "Price per spot" : "Split a total"}
                <span className="block font-normal text-[11px] text-zinc-400">{m === "fixed" ? "Tickets, a set price" : "A shared cost — divided by who comes"}</span>
              </button>
            ))}
          </div>
          {value.mode === "split" ? (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className={label}>Total paid</label>
                <input inputMode="decimal" value={value.total} placeholder="$120" className={input}
                  onChange={(e) => set({ total: e.target.value.replace(/[^\d.]/g, "").slice(0, 8) })} />
              </div>
              <div className="flex-1">
                <label className={label}>Fewest</label>
                <input inputMode="numeric" value={value.min} placeholder="4" className={input}
                  onChange={(e) => set({ min: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
              </div>
              <div className="flex-1">
                <label className={label}>Most</label>
                <input inputMode="numeric" value={value.max} placeholder="8" className={input}
                  onChange={(e) => set({ max: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
              </div>
            </div>
          ) : (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className={label}>Price per spot</label>
                <input inputMode="decimal" value={value.price} placeholder="$25" className={input}
                  onChange={(e) => set({ price: e.target.value.replace(/[^\d.]/g, "").slice(0, 7) })} />
              </div>
              <div className="flex-1">
                <label className={label}>Tickets / spots</label>
                <input inputMode="numeric" value={value.spots} placeholder="8" className={input}
                  onChange={(e) => set({ spots: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-zinc-600 cursor-pointer select-none">
            <input type="checkbox" checked={value.mine} onChange={(e) => set({ mine: e.target.checked })} className="w-4 h-4 accent-zinc-900" />
            {value.mode === "split"
              ? (self ? "Count me in the split" : "The host is in the split")
              : (self ? "One of these is mine" : "One of these is the host's")}
          </label>
          {preview && <p className="text-xs text-emerald-900 bg-emerald-50 rounded-lg px-3 py-2">{preview}</p>}
          {children}
        </>
      )}
    </div>
  );
}
