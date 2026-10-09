"use client";

/**
 * "Your Neighbor Hours, on autopilot": the merchant runs their Neighbor Hours like an ad
 * campaign. They pick their days, set a weekly limit on a slider that shows
 * what it buys (RSVPs, guests and what those guests spend, from past nights),
 * and switch it on or off. Server: offer-merchant-campaign-functions.js.
 */

import { useEffect, useMemo, useState } from "react";
import { Toggle, dollars } from "./ui";
import { merchantRun } from "@/lib/merchant-session";

/** The middle half of past nights, and the median ("usually") when the server sends it. */
type Range = { low: number; high: number; mid?: number };
type Day = { weekday: number; partOfDay: "morning" | "afternoon" | "evening" | "any" };
type CampaignState = {
  campaign: { on: boolean; days: Day[]; weeklyBudgetCents: number; autoStarted?: boolean };
  feeCents: number;
  minBudgetCents: number;
  maxBudgetCents: number;
  setupFeeCents: number;
  setupFeeOwed: boolean;
  hasCard: boolean;
  thisWeek: { spentCents: number };
  estimate: {
    // Neighbor Hours here or everywhere; before any have run, Leaf's public plans.
    scope: "neighborhood" | "everywhere" | "plans_neighborhood" | "plans_everywhere" | null;
    nights: number;
    rsvpsPerNight: Range | null;
    attendedPerNight: Range | null;
    showRate: number | null;
    // Hosts' receipts, or (before any) the app's split-the-bill receipts.
    spendPerGuest: (Range & { scope: "category" | "everywhere" | "splits_category" | "splits_everywhere"; nights: number }) | null;
  } | null;
  calendarName: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PARTS: Day["partOfDay"][] = ["morning", "afternoon", "evening", "any"];
const PART_LABEL: Record<Day["partOfDay"], string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", any: "Any time" };

/** "Wednesday evenings and Thursdays (all day)"; no days means every day. */
const windowLabel = (days: Day[]) =>
  days.length
    ? days.map((d) => (d.partOfDay === "any" ? `${WEEKDAY_NAMES[d.weekday]}s (all day)` : `${WEEKDAY_NAMES[d.weekday]} ${d.partOfDay}s`)).join(" and ")
    : "any day, any time";
const STEP_CENTS = 600; // one RSVP per notch

const span = (r: Range, f: (n: number) => string = String) => (r.low === r.high ? f(r.low) : `${f(r.low)}–${f(r.high)}`);

/**
 * The week the limit buys: RSVPs is what it pays for (one number); guests
 * range from half of those RSVPs showing up to all of them; spend is those
 * guests at the average spend per person for places like theirs.
 */
const SHOW_LOW = 0.5;
function outlook(s: CampaignState, budgetCents: number) {
  const paid = Math.floor(budgetCents / Math.max(1, s.feeCents));
  const guests: Range = { low: Math.ceil(paid * SHOW_LOW), high: paid };
  const spend = s.estimate?.spendPerGuest ?? null;
  const each = spend ? spend.mid ?? Math.round((spend.low + spend.high) / 2) : null;
  const sales: Range | null = each ? { low: guests.low * each, high: guests.high * each } : null;
  return { paid, guests, sales, each };
}

/** Guest spend for a week, to the nearest $10. */
const roundDollars = (c: number) => dollars(Math.round(c / 1000) * 1000);

/** Where a spend figure comes from, for the line under the tiles. */
const SPEND_FROM: Record<"category" | "everywhere" | "splits_category" | "splits_everywhere", string> = {
  category: "from hosts' receipts at places like yours",
  everywhere: "from hosts' receipts at Neighbor Hours",
  splits_category: "from bills Leaf neighbors split at places like yours",
  splits_everywhere: "from bills Leaf neighbors split on nights out",
};


export default function MerchantCampaign({ token, preview, firstNightFree }: { token: string; preview?: boolean; firstNightFree?: boolean }) {
  const [s, setS] = useState<CampaignState | null>(null);
  const [on, setOn] = useState(false);
  const [days, setDays] = useState<Day[]>([]);
  const [budget, setBudget] = useState(9000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);

  useEffect(() => {
    merchantRun("merchantGetCampaign", { token })
      .then((r: unknown) => {
        const c = r as CampaignState;
        setS(c);
        setOn(c.campaign.on);
        setDays(c.campaign.days);
        setBudget(c.campaign.weeklyBudgetCents);
        setAutoStarted(Boolean(c.campaign.autoStarted));
      })
      .catch(() => setS(null));
  }, [token]);

  const o = useMemo(() => (s ? outlook(s, budget) : null), [s, budget]);
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
      await merchantRun("merchantSaveCampaign", { token, on: nextOn, days, weeklyBudgetCents: budget });
      setOn(nextOn);
      setDirty(false);
      setAutoStarted(false);
      setNote(nextOn ? "Saved. Plans at your place on your days count toward your weekly limit." : "Off. Plans already on the calendar still happen.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  };

  const est = s.estimate;
  const spentPct = Math.min(100, Math.round((s.thisWeek.spentCents / Math.max(1, budget)) * 100));

  return (
    <section id="campaign" className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-fm-serif text-[28px] leading-tight text-stone-900">Your Neighbor Hours</h2>
          <p className="mt-1 text-[15px] leading-relaxed text-stone-600">Pick your slow days and times and a weekly limit. Neighbors&rsquo; plans at your place in those times count, and we charge your card once a week.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          <span className={`text-[14px] font-semibold ${on ? "text-leaf-700" : "text-stone-500"}`}>{on ? "On" : "Off"}</span>
          <Toggle
            label="Run my Neighbor Hours"
            on={on}
            disabled={saving || preview || (!on && !s.hasCard)}
            onChange={(v) => save(v)}
          />
        </div>
      </div>

      {/* Plain about what's running and what it charges, and how to stop it. */}
      {on ? (
        <div className="mt-5 rounded-2xl bg-leaf-50 p-4 ring-1 ring-leaf-200 sm:p-5">
          <p className="text-[16px] font-semibold text-leaf-900">
            {autoStarted ? "Your Neighbor Hours are switched on." : "Your Neighbor Hours are on."}
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-leaf-900">
            {`Neighbors' plans at your place on ${windowLabel(days)} count toward it: ${dollars(s.feeCents)} per RSVP, charged once a week, up to ${dollars(budget)} a week. RSVPs outside these times are free.`}
            {autoStarted ? " We turned this on when you held your free Neighbor Hour." : ""}
          </p>
          <p className="mt-2 text-[13px] text-leaf-800">Switch it off anytime with the toggle. Plans already on the calendar still happen.</p>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200 sm:p-5">
          <p className="text-[16px] font-semibold text-stone-900">Your Neighbor Hours are off.</p>
          <p className="mt-1 text-[15px] leading-relaxed text-stone-600">Pick your days below, then flip the toggle to switch them on. Plans already on the calendar still happen.</p>
        </div>
      )}

      {!s.hasCard && (
        <a href="#card" className="mt-4 block rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900 ring-1 ring-amber-200">
          Add a card to switch it on. <span className="font-semibold underline">Add your card</span>
        </a>
      )}

      <div className="mt-6 border-t border-stone-100 pt-6">
      <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-stone-500">Your days</p>
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
      {days.length === 0 && <p className="mt-2 text-[13px] text-stone-500">No days picked: plans at your place on any day count.</p>}
      {days.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {days.map((d) => (
            <div key={d.weekday} className="flex items-center justify-between gap-2 text-[14px]">
              <span className="w-12 font-semibold text-stone-800">{WEEKDAYS[d.weekday]}</span>
              <div className="grid flex-1 grid-cols-4 gap-1.5">
                {PARTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={d.partOfDay === p}
                    onClick={() => setPart(d.weekday, p)}
                    className={`h-9 rounded-lg border text-[12px] font-semibold sm:text-[13px] ${d.partOfDay === p ? "border-leaf-700 bg-leaf-50 text-leaf-800" : "border-stone-200 text-stone-600"}`}
                  >
                    {PART_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      </div>

      <div className="mt-6 border-t border-stone-100 pt-6">
      <div className="flex items-baseline justify-between">
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

      <div className="mt-5 grid grid-cols-3 gap-2 text-center sm:gap-3">
        <div className="rounded-2xl bg-stone-50 px-2 py-4">
          <p className="font-fm-serif text-[24px] leading-none text-stone-900">{o.paid}</p>
          <p className="mt-1 text-[12px] text-stone-500">RSVPs a week</p>
        </div>
        <div className="rounded-2xl bg-stone-50 px-2 py-4">
          <p className="font-fm-serif text-[24px] leading-none text-stone-900">{span(o.guests)}</p>
          <p className="mt-1 text-[12px] text-stone-500">guests a week</p>
        </div>
        <div className="rounded-2xl bg-leaf-50 px-2 py-4">
          <p className="font-fm-serif text-[24px] leading-none text-leaf-800">{o.sales ? span(o.sales, roundDollars) : "\u2014"}</p>
          <p className="mt-1 text-[12px] text-leaf-700">guest spend</p>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-stone-500">
        {[
          `Your limit pays for ${o.paid} RSVPs a week at ${dollars(s.feeCents)} each. Guests: half to all of them show up.`,
          o.each && est?.spendPerGuest ? ` Guest spend: that many guests at ${dollars(o.each)} a person, the average ${SPEND_FROM[est.spendPerGuest.scope]}.` : "",
          " Estimates, not promises.",
        ].join("")}
      </p>

      </div>

      {on && (
        <div className="mt-6 border-t border-stone-100 pt-6">
          <div className="flex justify-between text-[13px] text-stone-600">
            <span>This week</span>
            <span>{`${dollars(s.thisWeek.spentCents)} of ${dollars(budget)}`}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-leaf-600" style={{ width: `${spentPct}%` }} />
          </div>
        </div>
      )}

      <p className="mt-6 border-t border-stone-100 pt-6 text-[13px] leading-relaxed text-stone-500">
        {`${dollars(s.feeCents)} per RSVP, counted 2 hours before each plan and charged once a week for the week before, never more than your weekly limit. RSVPs outside your days and times are free.`}
        {firstNightFree ? " Your first Neighbor Hour is free." : ""}
        {s.setupFeeOwed ? ` A one-time ${dollars(s.setupFeeCents)} setup is added to your first paid one.` : ""}
      </p>

      {note && <p className="mt-3 rounded-xl bg-leaf-50 p-3 text-[14px] font-semibold text-leaf-800">{note}</p>}
      {error && <p className="mt-2 text-[14px] text-red-600">{error}</p>}

      {/* Off: the toggle switches it on with these days. On: changes need saving. */}
      {on && dirty && (
        <button
          type="button"
          disabled={saving || preview}
          onClick={() => save(true)}
          className="mt-4 h-12 w-full rounded-xl bg-leaf-800 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      )}
    </section>
  );
}
