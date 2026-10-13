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
export type Day = { weekday: number; partOfDay: "morning" | "afternoon" | "evening" | "any" };
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
    spendPerGuest: (Range & { mean?: number; label?: string | null; scope: "category" | "everywhere" | "splits_category" | "splits_everywhere"; nights: number }) | null;
  } | null;
  calendarName: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PARTS: Day["partOfDay"][] = ["morning", "afternoon", "evening", "any"];
const PART_LABEL: Record<Day["partOfDay"], string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening", any: "Any time" };

/** "Wednesday evenings and Thursdays (all day)"; no days means every day. */
export const windowLabel = (days: Day[]) =>
  days.length
    ? days.map((d) => (d.partOfDay === "any" ? `${WEEKDAY_NAMES[d.weekday]}s (all day)` : `${WEEKDAY_NAMES[d.weekday]} ${d.partOfDay}s`)).join(" and ")
    : "any day, any time";
const STEP_CENTS = 600; // one RSVP per notch

const PART_SHORT: Record<Day["partOfDay"], string> = { morning: "mornings", afternoon: "afternoons", evening: "evenings", any: "all day" };
/** "Wed evenings, Thu afternoons": the summary's short form of their days. */
const shortDays = (days: Day[]) => days.map((d) => `${WEEKDAYS[d.weekday]} ${PART_SHORT[d.partOfDay]}`).join(", ");

const span = (r: Range, f: (n: number) => string = String) => (r.low === r.high ? f(r.low) : `${f(r.low)}–${f(r.high)}`);

/**
 * The week the limit buys: RSVPs is what it pays for (one number); guests
 * range from half of those RSVPs showing up to all of them; spend is those
 * guests at the median spend per person for places like theirs.
 */
const SHOW_LOW = 0.5;
function outlook(s: CampaignState, budgetCents: number) {
  const paid = Math.floor(budgetCents / Math.max(1, s.feeCents));
  const guests: Range = { low: Math.ceil(paid * SHOW_LOW), high: paid };
  const spend = s.estimate?.spendPerGuest ?? null;
  // The median spend per person: a few big bills pull the mean well above what most guests spend.
  const each = spend ? spend.mid ?? Math.round((spend.low + spend.high) / 2) : null;
  const sales: Range | null = each ? { low: guests.low * each, high: guests.high * each } : null;
  return { paid, guests, sales, each };
}

/** Where the per-guest figure comes from, naming their kind of place when the server says. */
function spendSource(sp: { scope: keyof typeof SPEND_FROM; label?: string | null }) {
  if (sp.label) return sp.scope === "category" ? `by hosts' receipts at ${sp.label}` : `by bills Leaf neighbors split at ${sp.label}`;
  return SPEND_FROM[sp.scope].replace(/^from /, "by ");
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


/**
 * Their days: tap a weekday to add it, then pick the part of the day for
 * each. Shared by this section and the sign-up form.
 */
export function DaysPicker({ days, onChange, emptyNote = "No days picked: plans at your place on any day count." }: { days: Day[]; onChange: (d: Day[]) => void; emptyNote?: string | null }) {
  const toggleDay = (w: number) =>
    onChange(days.some((d) => d.weekday === w) ? days.filter((d) => d.weekday !== w) : [...days, { weekday: w, partOfDay: "evening" as const }].sort((a, b) => a.weekday - b.weekday));
  const setPart = (w: number, partOfDay: Day["partOfDay"]) => onChange(days.map((d) => (d.weekday === w ? { ...d, partOfDay } : d)));
  return (
    <>
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
      {days.length === 0 && emptyNote && <p className="mt-2 text-[13px] text-stone-500">{emptyNote}</p>}
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
    </>
  );
}

/** The weekly limit slider, one RSVP per notch. Shared by this section and the sign-up form. */
export function WeeklyLimit({ budget, min, max, onChange }: { budget: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <>
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-stone-500">Weekly limit</p>
        <p className="font-fm-serif text-[30px] leading-none text-stone-900">{dollars(budget)}</p>
      </div>
      <input
        type="range"
        min={min}
        max={Math.min(max, 60000)}
        step={STEP_CENTS}
        value={budget}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Weekly limit"
        className="mt-3 w-full accent-leaf-800"
      />
    </>
  );
}

/** What the dashboard's Next up card shows for a bar with nothing booked. */
export type CampaignSummary = { on: boolean; days: Day[]; weeklyBudgetCents: number };

export default function MerchantCampaign({
  token,
  preview,
  firstNightFree,
  onSummary,
}: {
  token: string;
  preview?: boolean;
  firstNightFree?: boolean;
  /** Called once loaded and after each save. */
  onSummary?: (c: CampaignSummary) => void;
}) {
  const [s, setS] = useState<CampaignState | null>(null);
  const [on, setOn] = useState(false);
  const [days, setDays] = useState<Day[]>([]);
  const [budget, setBudget] = useState(9000);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // The summary shows by default; the days, times and limit open on request
  // (or straight away from an email's #campaign link).
  const [editing, setEditing] = useState(() => typeof window !== "undefined" && window.location.hash === "#campaign");

  useEffect(() => {
    merchantRun("merchantGetCampaign", { token })
      .then((r: unknown) => {
        const c = r as CampaignState;
        setS(c);
        setOn(c.campaign.on);
        setDays(c.campaign.days);
        setBudget(c.campaign.weeklyBudgetCents);
        onSummary?.({ on: c.campaign.on, days: c.campaign.days, weeklyBudgetCents: c.campaign.weeklyBudgetCents });
      })
      .catch(() => setS(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const o = useMemo(() => (s ? outlook(s, budget) : null), [s, budget]);
  if (!s || !o) return null;

  const save = async (nextOn: boolean) => {
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      await merchantRun("merchantSaveCampaign", { token, on: nextOn, days, weeklyBudgetCents: budget });
      setOn(nextOn);
      onSummary?.({ on: nextOn, days, weeklyBudgetCents: budget });
      setDirty(false);
      setEditing(false);
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
          <p className="mt-1 text-[15px] leading-relaxed text-stone-600">
            {on
              ? `Neighbors' plans at your place in these times count: ${dollars(s.feeCents)} per RSVP, charged once a week.${firstNightFree ? " Your first Neighbor Hour is free." : ""}`
              : "Off. Pick your slow days and a weekly limit, then switch them on. Plans already on the calendar still happen."}
          </p>
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

      {!s.hasCard && (
        <a href="#card" className="mt-4 block rounded-xl bg-amber-50 p-3 text-[14px] text-amber-900 ring-1 ring-amber-200">
          Add a card to switch it on. <span className="font-semibold underline">Add your card</span>
        </a>
      )}

      {/* The summary: their days, limit and what it brings, and this week so far. */}
      {!editing && (
        <>
          <dl className="mt-5 grid overflow-hidden rounded-2xl ring-1 ring-stone-200 sm:grid-cols-3">
            {[
              { label: "Your days", value: days.length ? shortDays(days) : "Any day, any time" },
              { label: "Weekly limit", value: dollars(budget) },
              { label: "Guests a week", value: `~${span(o.guests)}` },
            ].map((f, i) => (
              <div key={f.label} className={`px-4 py-3 ${i ? "border-t border-stone-200 sm:border-l sm:border-t-0" : ""}`}>
                <dd className="font-fm-serif text-[22px] leading-tight text-stone-900">{f.value}</dd>
                <dt className="mt-0.5 text-[12px] text-stone-500">{f.label}</dt>
              </div>
            ))}
          </dl>
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
          {note && <p className="mt-3 rounded-xl bg-leaf-50 p-3 text-[14px] font-semibold text-leaf-800">{note}</p>}
          {error && <p className="mt-2 text-[14px] text-red-600">{error}</p>}
          <button
            type="button"
            disabled={preview}
            onClick={() => setEditing(true)}
            className="mt-5 h-11 rounded-xl bg-leaf-800 px-5 text-[14px] font-semibold text-white disabled:opacity-40"
          >
            {on ? "Change days or limit" : "Pick your days"}
          </button>
        </>
      )}

      {editing && (
        <>
      <div className="mt-6 border-t border-stone-100 pt-6">
        <DaysPicker
          days={days}
          onChange={(next) => {
            setDays(next);
            setDirty(true);
          }}
        />
      </div>

      <div className="mt-6 border-t border-stone-100 pt-6">
      <WeeklyLimit
        budget={budget}
        min={s.minBudgetCents}
        max={s.maxBudgetCents}
        onChange={(v) => {
          setBudget(v);
          setDirty(true);
        }}
      />

      <div className="mt-5 grid grid-cols-3 gap-2 text-center sm:gap-3">
        <div className="rounded-2xl bg-stone-50 px-2 py-4">
          <p className="font-fm-serif text-[24px] leading-none text-stone-900">{o.paid}</p>
          <p className="mt-1 text-[12px] text-stone-500">RSVPs a week</p>
        </div>
        <div className="rounded-2xl bg-stone-50 px-2 py-4">
          <p className="font-fm-serif text-[24px] leading-none text-stone-900">{`~${span(o.guests)}`}</p>
          <p className="mt-1 text-[12px] text-stone-500">guests a week</p>
        </div>
        <div className="rounded-2xl bg-leaf-50 px-2 py-4">
          <p className="font-fm-serif text-[24px] leading-none text-leaf-800">{o.sales ? span(o.sales, roundDollars) : "\u2014"}</p>
          <p className="mt-1 text-[12px] text-leaf-700">guest typical spend</p>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-stone-500">
        {[
          `Your limit pays for ${o.paid} RSVPs a week at ${dollars(s.feeCents)} each. Guests: half to all of them show up.`,
          o.each && est?.spendPerGuest ? ` Guest spend: that many guests at ${dollars(o.each)} a person, what a typical guest spends, going ${spendSource(est.spendPerGuest)}.` : "",
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

      {/* On: changes need saving. Off: switching on saves these days too. */}
      <div className="mt-4 flex gap-2">
        {on && dirty ? (
          <button
            type="button"
            disabled={saving || preview}
            onClick={() => save(true)}
            className="h-12 flex-1 rounded-xl bg-leaf-800 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Saving\u2026" : "Save changes"}
          </button>
        ) : !on ? (
          <button
            type="button"
            disabled={saving || preview || !s.hasCard || !dirty}
            onClick={() => save(true)}
            className="h-12 flex-1 rounded-xl bg-leaf-800 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Saving\u2026" : "Switch them on with these days"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            if (dirty && s) {
              setDays(s.campaign.days);
              setBudget(s.campaign.weeklyBudgetCents);
              setDirty(false);
            }
          }}
          className="h-12 rounded-xl border border-stone-300 px-5 text-[15px] font-semibold text-stone-700"
        >
          {dirty ? "Cancel" : "Done"}
        </button>
      </div>
        </>
      )}
    </section>
  );
}
