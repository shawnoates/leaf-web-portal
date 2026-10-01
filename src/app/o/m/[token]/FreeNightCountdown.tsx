"use client";

/**
 * The free first night, made obvious: a live countdown to the real deadline
 * (a week from when they first opened the link, enforced on the server).
 * After it passes, a plain note that they can still join at the RSVP price.
 */

import { useEffect, useState } from "react";

/** A typical night's RSVPs, for showing what the free night is worth. */
export const TYPICAL_RSVPS = 12;

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Milliseconds left until the deadline, ticking each second; null when not counting. */
export function useCountdown(deadline: string | null | undefined, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active, deadline]);
  if (!active || !deadline) return null;
  const left = new Date(deadline).getTime() - now;
  return left > 0 ? left : null;
}

/** The four-cell timer. `compact` is the size for the sticky button bar. */
export function CountdownCells({ left, compact = false }: { left: number; compact?: boolean }) {
  const p = parts(left);
  const cells: [number, string][] = [
    [p.d, compact ? "d" : "days"],
    [p.h, compact ? "h" : "hrs"],
    [p.m, compact ? "m" : "min"],
    [p.s, compact ? "s" : "sec"],
  ];
  return (
    <div className={`grid grid-cols-4 ${compact ? "gap-1.5" : "gap-2"}`} role="timer" aria-live="off" aria-label={`${p.d} days ${p.h} hours ${p.m} minutes left`}>
      {cells.map(([v, label]) =>
        compact ? (
          <div key={label} className="flex items-baseline justify-center gap-0.5 rounded-xl bg-[#f3d9a4] py-1.5">
            <span className="font-fm-serif text-[20px] leading-none tabular-nums">{String(v).padStart(2, "0")}</span>
            <span className="text-[11px] font-semibold text-stone-600">{label}</span>
          </div>
        ) : (
          <div key={label} className="rounded-2xl bg-white/70 py-2 text-center">
            <p className="font-fm-serif text-[30px] leading-none tabular-nums">{String(v).padStart(2, "0")}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-600">{label}</p>
          </div>
        ),
      )}
    </div>
  );
}

export default function FreeNightCountdown({
  deadline,
  state,
  feeLabel,
  worthLabel,
}: {
  deadline: string | null;
  state: "open" | "lapsed" | "granted" | "used";
  feeLabel: string;
  /** What a typical first night would cost, shown struck through. */
  worthLabel: string;
}) {
  const left = useCountdown(deadline, state === "open");

  if (state === "lapsed") {
    const when = deadline ? new Date(deadline).toLocaleDateString("en-US", { month: "long", day: "numeric" }) : null;
    return (
      <div className="rounded-3xl border border-stone-200 bg-white p-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-500">Free first night</p>
        <p className="mt-1 text-[15px] leading-snug text-stone-700">
          The free first night offer ended{when ? ` on ${when}` : ""}. You can still join: {feeLabel} per RSVP from your first night, and nothing
          under 5 RSVPs.
        </p>
      </div>
    );
  }
  if (left == null) return null;

  return (
    <div className="rounded-3xl bg-[#f3d9a4] p-5 text-stone-900">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-700">Your first night is free</p>
      <p className="mt-1 font-fm-serif text-[24px] leading-tight">
        <s className="text-stone-500 decoration-stone-500/70">{worthLabel}</s> $0 for your first night
      </p>
      <p className="mt-2 text-[13px] leading-snug text-stone-700">
        {`A typical night is ${TYPICAL_RSVPS} RSVPs, so ${worthLabel} at ${feeLabel} each. Your first one is on us if you hold it within a week of first opening this page. After that it’s ${feeLabel} per RSVP from your first night.`}
      </p>
    </div>
  );
}
