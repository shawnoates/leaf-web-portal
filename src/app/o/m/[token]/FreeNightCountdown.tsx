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

/** The time left as one line of text, e.g. "6d 23h 47m 41s". */
export function CountdownText({ left }: { left: number }) {
  const p = parts(left);
  return (
    <span className="font-fm-serif tabular-nums text-red-700" role="timer" aria-live="off" aria-label={`${p.d} days ${p.h} hours ${p.m} minutes left`}>
      {`${p.d}d ${String(p.h).padStart(2, "0")}h ${String(p.m).padStart(2, "0")}m ${String(p.s).padStart(2, "0")}s`}
    </span>
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
