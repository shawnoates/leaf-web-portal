"use client";

/**
 * "Your nights, on autopilot": the merchant runs their Leaf nights like an ad
 * campaign. They pick their days, set a weekly limit on a slider that shows
 * what it buys (RSVPs, guests and what those guests spend, from past nights),
 * and switch it on or off. Server: offer-merchant-campaign-functions.js.
 */

import { useEffect, useMemo, useState } from "react";
import Parse from "@/lib/parse-client";
import { dollars } from "./ui";

type Range = { low: number; high: number };
type Day = { weekday: number; partOfDay: "morning" | "afternoon" | "evening" };
type CampaignState = {
  campaign: { on: boolean; days: Day[]; weeklyBudgetCents: number };
  feeCents: number;
  minBudgetCents: number;
  maxBudgetCents: number;
  setupFeeCents: number;
  setupFeeOwed: boolean;
  hasCard: boolean;
  thisWeek: { spentCents: number };
  estimate: {
    scope: "neighborhood" | "everywhere";
    nights: number;
    rsvpsPerNight: Range;
    attendedPerNight: Range | null;
    showRate: number | null;
    spendPerGuest: (Range & { scope: "category" | "everywhere"; nights: number }) | null;
  } | null;
  calendarName: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PARTS: Day["partOfDay"][] = ["morning", "afternoon", "evening"];
const STEP_CENTS = 600; // one RSVP per notch

const span = (r: Range, f: (n: number) => string = String) => (r.low === r.high ? f(r.low) : `${f(r.low)}–${f(r.high)}`);

/** Mirrors weeklyOutlook in offer-merchant-campaign.js. */
function outlook(s: CampaignState, budgetCents: number, nightsPerWeek: number) {
  const paid = Math.floor(budgetCents / Math.max(1, s.feeCents));
  const per = s.estimate?.rsvpsPerNight ?? null;
  const draw = per && nightsPerWeek ? { low: per.low * nightsPerWeek, high: per.high * nightsPerWeek } : null;
  const rsvps = draw ? { low: Math.min(paid, draw.low), high: Math.min(paid, draw.high) } : { low: paid, high: paid };
  const rate = s.estimate?.showRate ?? null;
  const guests = rate != null ? { low: Math.round(rsvps.low * rate), high: Math.round(rsvps.high * rate) } : null;
  const spend = s.estimate?.spendPerGuest ?? null;
  const sales = guests && spend ? { low: guests.low * spend.low, high: guests.high * spend.high } : null;
  return { paid, rsvps, guests, sales, limitBinds: Boolean(draw && paid < draw.high), draw };
}

export default function MerchantCampaign({ token, preview }: { token: string; preview?: boolean }) {
  const [s, setS] = useState<CampaignState | null>(null);
  const [on, setOn] = useState(false);
  const [days, setDays] = useState<Day[]>([]);
  const [budget, setBudget] = useState(9000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    Parse.Cloud.run("merchantGetCampaign", { token })
      .then((r: unknown) => {
        const c = r as CampaignState;
        setS(c);
        setOn(c.campaign.on);
        setDays(c.campaign.days);
        setBudget(c.campaign.weeklyBudgetCents);
      })
      .catch(() => setS(null));
  }, [token]);

  const o = useMemo(() => (s ? outlook(s, budget, days.length) : null), [s, budget, days.length]);
  if (!s || !o) return null;

  const toggleDay = (w: number) => {
    setDirty(true);
    setDays((cur) => (cur.some((d) => d.weekday === w) ? cur.filter((d) => d.weekday !== w) : [...cur, { weekday: w, partOfDay: "evening" as const }].sort((a, b) => a.weekday - b.weekday)));
  };
  const setPart = (w: number, partOfDay: Day["partOfDay"]) => {
    setDirty(true);
    setDays((cur) => cur.map((d) => (d.weekday === w ? { ...d, partOfDay } : d)));
  };

  const save = async (nextOn: boolean) => {
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const r = (await Parse.Cloud.run("merchantSaveCampaign", { token, on: nextOn, days, weeklyBudgetCents: budget })) as { queued: number; withdrawn: number };
      setOn(nextOn);
      setDirty(false);
      setNote(
        nextOn
          ? r.queued
            ? `On. We've lined up ${r.queued} night${r.queued === 1 ? "" : "s"} and will confirm each one with you.`
            : "Saved. We line up your nights about a week and a half ahead."
          : `Off. ${r.withdrawn ? "Nights we hadn't booked yet are dropped; " : ""}booked nights still happen.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  };

  const est = s.estimate;
  const where = est?.scope === "neighborhood" ? (s.calendarName || "your neighborhood") : "Leaf neighborhoods";
  const spentPct = Math.min(100, Math.round((s.thisWeek.spentCents / Math.max(1, budget)) * 100));

  return (
    <section id="campaign" className="scroll-mt-6 rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-fm-serif text-[26px] leading-tight text-stone-900">Your nights</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-stone-600">Pick your slow days and a weekly limit. We fill them with neighbors and charge your card after each night.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 pt-1">
          <span className={`text-[14px] font-semibold ${on ? "text-leaf-700" : "text-stone-500"}`}>{on ? "On" : "Off"}</span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Run my nights"
            checked={on}
            disabled={saving || preview || (!on && (!days.length || !s.hasCard))}
            onChange={(e) => save(e.target.checked)}
            className="h-6 w-6 accent-leaf-800"
          />
        </label>
      </div>

      {!s.hasCard && (
        <a href="#card" className="mt-3 block rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900 ring-1 ring-amber-200">
          Add a card to switch it on. <span className="font-semibold underline">Add your card</span>
        </a>
      )}

      <p className="mt-5 text-[13px] font-semibold uppercase tracking-[0.1em] text-stone-500">Your days</p>
      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((label, w) => {
          const picked = days.some((d) => d.weekday === w);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={picked}
              onClick={() => toggleDay(w)}
              className={`h-11 rounded-xl border text-[14px] font-semibold ${picked ? "border-leaf-800 bg-leaf-800 text-white" : "border-stone-300 bg-white text-stone-700"}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {days.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {days.map((d) => (
            <div key={d.weekday} className="flex items-center justify-between gap-2 text-[14px]">
              <span className="w-12 font-semibold text-stone-800">{WEEKDAYS[d.weekday]}</span>
              <div className="grid flex-1 grid-cols-3 gap-1.5">
                {PARTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={d.partOfDay === p}
                    onClick={() => setPart(d.weekday, p)}
                    className={`h-9 rounded-lg border text-[13px] font-semibold capitalize ${d.partOfDay === p ? "border-leaf-700 bg-leaf-50 text-leaf-800" : "border-stone-200 text-stone-600"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-baseline justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-stone-500">Weekly limit</p>
        <p className="font-fm-serif text-[30px] leading-none text-stone-900">{dollars(budget)}</p>
      </div>
      <input
        type="range"
        min={s.minBudgetCents}
        max={Math.min(s.maxBudgetCents, 60000)}
        step={STEP_CENTS}
        value={budget}
        onChange={(e) => {
          setBudget(Number(e.target.value));
          setDirty(true);
        }}
        aria-label="Weekly limit"
        className="mt-3 w-full accent-leaf-800"
      />

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-stone-50 p-3">
          <p className="font-fm-serif text-[24px] leading-none text-stone-900">{span(o.rsvps)}</p>
          <p className="mt-1 text-[12px] text-stone-500">RSVPs a week</p>
        </div>
        <div className="rounded-2xl bg-stone-50 p-3">
          <p className="font-fm-serif text-[24px] leading-none text-stone-900">{o.guests ? span(o.guests) : "—"}</p>
          <p className="mt-1 text-[12px] text-stone-500">guests a week</p>
        </div>
        <div className="rounded-2xl bg-leaf-50 p-3">
          <p className="font-fm-serif text-[24px] leading-none text-leaf-800">{o.sales ? span(o.sales, (c) => dollars(Math.round(c / 1000) * 1000)) : "—"}</p>
          <p className="mt-1 text-[12px] text-leaf-700">guest spend</p>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-stone-500">
        {est
          ? [
              `Nights in ${where} draw ${span(est.rsvpsPerNight)} RSVPs`,
              est.attendedPerNight ? ` and ${span(est.attendedPerNight)} guests` : "",
              ` (last ${est.nights} nights).`,
              est.spendPerGuest
                ? ` Guests spend ${span(est.spendPerGuest, dollars)} each at ${est.spendPerGuest.scope === "category" ? "places like yours" : "Leaf nights"}, from receipts.`
                : "",
              o.limitBinds && o.draw ? ` Your limit covers ${o.paid} RSVPs; your days usually draw up to ${o.draw.high}.` : "",
              " Estimates, not promises.",
            ].join("")
          : `Your limit covers up to ${o.paid} RSVPs a week at ${dollars(s.feeCents)} each. We'll show typical turnout once there are a few nights to go on.`}
      </p>

      {on && (
        <div className="mt-4">
          <div className="flex justify-between text-[13px] text-stone-600">
            <span>This week</span>
            <span>{`${dollars(s.thisWeek.spentCents)} of ${dollars(budget)}`}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-leaf-600" style={{ width: `${spentPct}%` }} />
          </div>
        </div>
      )}

      <p className="mt-4 text-[13px] leading-relaxed text-stone-500">
        {`${dollars(s.feeCents)} per RSVP, charged after each night and never more than your weekly limit. Under 5 RSVPs costs nothing.`}
        {s.setupFeeOwed ? ` A one-time ${dollars(s.setupFeeCents)} setup is added to your first paid night.` : ""}
        {" We confirm each night with you about a week ahead, and you can skip any night before it's booked."}
      </p>

      {note && <p className="mt-3 rounded-xl bg-leaf-50 p-3 text-[14px] font-semibold text-leaf-800">{note}</p>}
      {error && <p className="mt-2 text-[14px] text-red-600">{error}</p>}

      {(dirty || !on) && (
        <button
          type="button"
          disabled={saving || preview || !days.length || (!s.hasCard && !on)}
          onClick={() => save(true)}
          className="mt-4 h-12 w-full rounded-xl bg-leaf-800 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : on ? "Save changes" : "Switch on"}
        </button>
      )}
    </section>
  );
}
