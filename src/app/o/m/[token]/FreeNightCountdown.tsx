"use client";

/**
 * The free first night, made obvious: a live countdown to the real deadline
 * (a week from when they first opened the link, enforced on the server).
 * After it passes, a plain note that they can still join at the RSVP price.
 */

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export default function FreeNightCountdown({
  deadline,
  state,
  feeLabel,
}: {
  deadline: string | null;
  state: "open" | "lapsed" | "granted" | "used";
  feeLabel: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state !== "open" || !deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state, deadline]);

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
  if (state !== "open" || !deadline) return null;

  const left = new Date(deadline).getTime() - now;
  if (left <= 0) return null;
  const p = parts(left);
  const cells: [number, string][] = [
    [p.d, "days"],
    [p.h, "hrs"],
    [p.m, "min"],
    [p.s, "sec"],
  ];
  return (
    <div className="rounded-3xl bg-[#f3d9a4] p-5 text-stone-900">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-700">Your first night is free</p>
      <p className="mt-1 font-fm-serif text-[24px] leading-tight">Hold it before the timer runs out</p>
      <div className="mt-3 grid grid-cols-4 gap-2" role="timer" aria-live="off" aria-label={`${p.d} days ${p.h} hours ${p.m} minutes left`}>
        {cells.map(([v, label]) => (
          <div key={label} className="rounded-2xl bg-white/70 py-2 text-center">
            <p className="font-fm-serif text-[30px] leading-none tabular-nums">{String(v).padStart(2, "0")}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-600">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] leading-snug text-stone-700">
        Held for a week from when you first opened this page. After that it&rsquo;s {feeLabel} per RSVP from your first night.
      </p>
    </div>
  );
}
