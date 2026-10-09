"use client";

/**
 * "Your weekly report": every plan at their place this week and the last few,
 * which ones count (inside their days and times) and which are free, and what
 * each week was charged. The same report is emailed each Monday when any
 * RSVPs fell in their window. Server: merchantWeeklyReport in
 * offer-weekly-billing-functions.js.
 */

import { useEffect, useState } from "react";
import { dollars } from "./ui";
import { merchantRun } from "@/lib/merchant-session";

type Plan = { title: string; label: string; time: string; rsvps: number; inWindow: boolean; leafNight: boolean; final?: boolean };
type Week = { weekOf: string; plans: Plan[]; chargedRsvps: number; cappedRsvps: number; amountCents: number; status: string };
type Report = { feeCents: number; minPerPlan: number; thisWeek: { weekOf: string; plans: Plan[]; soFarCents: number }; weeks: Week[] };

const weekLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return `Week of ${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)))}`;
};

const STATUS: Record<string, string> = {
  paid: "Charged",
  due: "Charging soon",
  failed: "Card didn’t go through",
  nothing: "No charge",
  free_night_ahead: "No charge (free first Neighbor Hour first)",
};

function PlanRow({ p, min }: { p: Plan; min: number }) {
  const tag = p.leafNight
    ? { text: "Leaf night, billed on its own", cls: "text-stone-500" }
    : !p.inWindow
      ? { text: "Outside your times, free", cls: "text-stone-500" }
      : p.rsvps < min && p.final !== false
        ? { text: `Under ${min} RSVPs, free`, cls: "text-stone-500" }
        : { text: "Counts", cls: "text-leaf-700" };
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium text-stone-900">{p.title}</span>
        <span className="block text-[13px] text-stone-500">
          {p.label.replace(/,.*$/, "")}
          {p.time ? `, ${p.time}` : ""} · <span className={tag.cls}>{tag.text}</span>
        </span>
      </span>
      <span className="shrink-0 text-right text-[14px] tabular-nums text-stone-700">
        {p.rsvps} RSVP{p.rsvps === 1 ? "" : "s"}
        {p.final === false && <span className="block text-[12px] text-stone-400">so far</span>}
      </span>
    </li>
  );
}

export default function MerchantReport({ token }: { token: string }) {
  const [r, setR] = useState<Report | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    merchantRun<Report>("merchantWeeklyReport", { token })
      .then(setR)
      .catch(() => setR(null));
  }, [token]);

  if (!r) return null;
  const now = r.thisWeek;
  return (
    <section id="report" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-7">
      <h2 className="font-fm-serif text-[26px] leading-tight text-stone-900">Your weekly report</h2>
      <p className="mt-1 text-[15px] text-stone-600">Plans at your place, and what counts toward your week. We email it every Monday when anything counted.</p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-stone-500">This week</p>
          <p className="text-[14px] text-stone-600">{now.plans.length ? `${dollars(now.soFarCents)} so far` : ""}</p>
        </div>
        {now.plans.length ? (
          <ul className="mt-1 divide-y divide-stone-100">
            {now.plans.map((p, i) => (
              <PlanRow key={`${p.label}-${i}`} p={p} min={r.minPerPlan} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-stone-500">No plans at your place this week yet.</p>
        )}
      </div>

      {r.weeks.length > 0 && (
        <div className="mt-6 border-t border-stone-100 pt-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-stone-500">Past weeks</p>
          <ul className="mt-1 divide-y divide-stone-100">
            {r.weeks.map((w) => (
              <li key={w.weekOf} className="py-2.5">
                <button type="button" onClick={() => setOpen(open === w.weekOf ? null : w.weekOf)} className="flex w-full items-center justify-between gap-3 text-left">
                  <span>
                    <span className="block text-[15px] font-medium text-stone-900">{weekLabel(w.weekOf)}</span>
                    <span className="block text-[13px] text-stone-500">
                      {w.chargedRsvps} RSVP{w.chargedRsvps === 1 ? "" : "s"} counted{w.cappedRsvps ? `, ${w.cappedRsvps} over your limit (free)` : ""} · {STATUS[w.status] || w.status}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-stone-900">{dollars(w.amountCents)}</span>
                </button>
                {open === w.weekOf && (
                  <ul className="mt-1 divide-y divide-stone-100 rounded-xl bg-stone-50 px-3">
                    {w.plans.map((p, i) => (
                      <PlanRow key={`${p.label}-${i}`} p={p} min={r.minPerPlan} />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
