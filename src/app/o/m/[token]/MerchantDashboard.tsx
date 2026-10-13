"use client";

/**
 * The merchant's home after they say yes: their nights coming up, how past
 * nights went (and what they cost), and their account. Counts only, never
 * guest names. Reached from the same offer link as the sign-up form.
 */

import { type ReactNode, useEffect, useState } from "react";
import { Brand, CREAM, Shell, dollars, formatPhone, linkedHere } from "./ui";
import MerchantHello from "./MerchantHello";
import MerchantReport from "./MerchantReport";
import MerchantDeals from "./MerchantDeals";
import MerchantCampaign, { type CampaignSummary, windowLabel } from "./MerchantCampaign";
import { merchantAuth, merchantRun } from "@/lib/merchant-session";
import Parse from "@/lib/parse-client";
import ResultsClient from "@/app/o/r/[token]/ResultsClient";
import PlacardClient from "@/app/o/p/[token]/PlacardClient";

type Phase = "pending" | "confirmed" | "now" | "past" | "cancelled";
type Step = { key: string; label: string; status: "done" | "current" | "todo"; you?: boolean; detail: string | null };
type Night = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  phase: Phase;
  title: string;
  rsvps: number | null;
  capacity: number | null;
  // What's left before it's live (upcoming nights; older servers don't send it).
  steps?: Step[] | null;
  guests: number | null;
  host: { kind: "leaf" | "you"; name: string | null } | null;
  /** "Add a Leaf host" on a night they run (older servers don't send it). */
  hostAddOn?: { state: "available" | "too_close" | "offering" | "hosted" | "none_found" | null; feeCents: number } | null;
  contact?: { name: string; phone: string; isDefault: boolean };
  planUrl: string | null;
  charge: {
    status: "paid" | "free" | "make_good" | "failed" | "pending";
    amountCents: number;
    billed: number | null;
    label: string;
  } | null;
  payout: { status: string | null; payoutCents: number | null } | null;
  resultsUrl: string | null;
  // Results, rebook and the make-good choice, shown here (under the sign-in).
  resultsToken?: string | null;
  makeGood?: { rsvps: number | null; choice: "run" | "move" | null } | null;
  report: {
    spend: {
      subtotalCents: number;
      receipts: number;
      checks: number;
      perGuestCents: number | null;
    } | null;
    photos: string[];
    regulars: { followsFromNight: number | null; returning: number | null };
  } | null;
};
export type Dashboard = {
  state: string;
  merchantName: string;
  /** Their own Google photo, saved by Leaf. */
  photoUrl?: string | null;
  photoCredit?: { name: string; uri: string } | null;
  calendarName: string;
  calendarUrl: string | null;
  neighborhood: string;
  weekdayLabel: string;
  startTimeLabel: string;
  model: "per_rsvp" | "ticket";
  rsvpFeeCents: number;
  freeNight: { state: "open" | "granted" | "lapsed" | "used"; free: boolean };
  cardFailed: boolean;
  /** Leaf balance (bars and restaurants): prepaid, reloads when low. */
  credit?: Credit | null;
  placardUrl: string | null;
  placardToken?: string | null;
  upcoming: Night[];
  past: Night[];
  cancelled: Night[];
  totals: {
    upcoming: number;
    nightsRun: number;
    guests: number;
    chargedCents: number;
  };
  /** Open weeks on their night they can book now. */
  bookable?: { dateKey: string; label: string }[];
  /** Setting up their free first night (five stages, moved on by Leaf); null once it's billed. */
  setup?: Setup | null;
  /** Nights they asked for that Leaf hasn't booked yet. */
  requests?: { id: string; kind: "first" | "rebook"; label: string; source?: "campaign" | null }[];
};

type Setup = { stage: string; step: number; stages: { key: string; label: string }[]; detail: string; date: string | null };

/** A green per step, light to dark (leaf-300 to leaf-800); the setup emails use the same. */
const STEP_GREENS = ["#9dbeb3", "#74a494", "#5a8c7b", "#426c5e", "#253a33"];

/** The setup bar, in the header: where their free first Neighbor Hour is, step by step. */
function SetupProgress({ setup }: { setup: Setup }) {
  const total = setup.stages.length;
  return (
    <section aria-label="Setting up your first Neighbor Hour" className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-300">Setting up your first Neighbor Hour</p>
        <p className="shrink-0 whitespace-nowrap rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-semibold text-white">{`Step ${setup.step} of ${total}`}</p>
      </div>
      <ol className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {setup.stages.map((st, i) => {
          const done = i + 1 < setup.step;
          const current = i + 1 === setup.step;
          return (
            <li key={st.key} aria-current={current ? "step" : undefined}>
              <div className="h-2 rounded-full bg-white/15" style={done || current ? { backgroundColor: STEP_GREENS[Math.min(i, STEP_GREENS.length - 1)] } : undefined} />
              <p className={`mt-2 hidden text-[11px] leading-tight sm:block ${current ? "font-semibold text-white" : "text-leaf-300"}`}>{st.label}</p>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[17px] font-semibold sm:hidden">{setup.stages[setup.step - 1]?.label}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-leaf-100 sm:mt-3">{setup.detail}</p>
    </section>
  );
}

type Credit = {
  balanceCents: number;
  autoReload: boolean;
  reloadCents: number;
  reloadBelowCents: number;
  reloadFailed: boolean;
  recent: { kind: "reload" | "night" | "deal"; amountCents: number; balanceAfterCents: number; dateKey: string | null; at: string | null }[];
};

/** "Oct 12" from an ISO date or a YYYY-MM-DD key. */
function shortDate(v: string | null) {
  if (!v) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function LeafBalance({ credit }: { credit: Credit }) {
  return (
    <Card id="balance">
      <H2>Leaf balance</H2>
      <p className="mt-1 font-fm-serif text-[40px] leading-none text-stone-900">{dollars(credit.balanceCents)}</p>
      <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
        Left over from prepaying. Your next nights use it up first, then they&rsquo;re charged to your card after each night.
      </p>
      {credit.recent.length > 0 && (
        <ul className="mt-4 divide-y divide-stone-100 text-[14px]">
          {credit.recent.map((r, i) => (
            <li key={i} className="flex items-baseline justify-between py-2">
              <span className="text-stone-700">{r.kind === "reload" ? `Added ${shortDate(r.at)}` : r.kind === "deal" ? `Deal, ${shortDate(r.at)}` : `Night of ${shortDate(r.dateKey)}`}</span>
              <span className={r.amountCents > 0 ? "font-semibold text-leaf-700" : "text-stone-700"}>
                {r.amountCents > 0 ? "+" : "\u2212"}
                {dollars(Math.abs(r.amountCents))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const PHASE: Record<Exclude<Phase, "past" | "cancelled">, { label: string; tone: string }> = {
  now: { label: "Happening now", tone: "bg-emerald-600 text-white" },
  confirmed: { label: "On the calendar", tone: "bg-leaf-100 text-leaf-800" },
  pending: { label: "Being set up", tone: "bg-stone-100 text-stone-600" },
};

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="min-w-0 px-4 first:pl-0">
      <p className="font-fm-serif text-[30px] leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-leaf-100">{label}</p>
    </div>
  );
}

/**
 * The top of the summary: what's next. Their next night with its status and
 * RSVPs filling toward capacity, or, with nothing booked, how to get one:
 * bars and restaurants get theirs from their Neighbor Hours days, ticketed
 * places request a night.
 */
function NextUp({ n, perRsvp, campaign, settingUp }: { n: Night | null; perRsvp: boolean; campaign: CampaignSummary | null; settingUp: boolean }) {
  if (!n && settingUp) {
    return (
      <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-300">Next up</p>
        <p className="mt-1.5 text-[17px] font-semibold">Your free first Neighbor Hour</p>
        <p className="mt-1 text-[14px] leading-relaxed text-leaf-100">We&rsquo;re setting it up. Its date shows here once it&rsquo;s set.</p>
      </div>
    );
  }
  if (!n) {
    const empty = !perRsvp
      ? { title: "Nothing booked yet", body: "Request a night and we\u2019ll put it in front of the neighborhood.", cta: "Request a night", href: "#book" }
      : campaign?.on
        ? {
            title: "Your Neighbor Hours are on",
            body: `Neighbors\u2019 plans at your place on ${windowLabel(campaign.days)} count, up to ${dollars(campaign.weeklyBudgetCents)} a week. They show up here as they\u2019re made.`,
            cta: "Change your Neighbor Hours",
            href: "#campaign",
          }
        : campaign
          ? {
              title: "Your Neighbor Hours are off",
              body: "Switch them on and neighbors\u2019 plans at your place on your slow days count, up to a weekly limit you set.",
              cta: "Switch them on",
              href: "#campaign",
            }
          : { title: "Nothing booked yet", body: "Neighbors\u2019 plans at your place show up here as they\u2019re made.", cta: "See your Neighbor Hours", href: "#campaign" };
    return (
      <div className="rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-300">Next up</p>
        <p className="mt-1.5 text-[17px] font-semibold">{empty.title}</p>
        <p className="mt-1 text-[14px] leading-relaxed text-leaf-100">{empty.body}</p>
        <a href={empty.href} className="mt-3 inline-flex h-10 items-center rounded-xl bg-white px-4 text-[14px] font-semibold text-leaf-900">
          {empty.cta}
        </a>
      </div>
    );
  }
  const p = PHASE[n.phase as keyof typeof PHASE];
  const pct = n.rsvps != null && n.capacity ? Math.min(100, Math.round((n.rsvps / n.capacity) * 100)) : null;
  return (
    <a href={`#night-${n.id}`} className="block rounded-2xl bg-white/[0.07] p-4 ring-1 ring-white/10 transition hover:bg-white/[0.1]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-300">Next up</p>
        {p && <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-[12px] font-semibold text-white">{p.label}</span>}
      </div>
      <p className="mt-1.5 font-fm-serif text-[24px] leading-tight">{n.dateLabel}</p>
      <p className="text-[14px] text-leaf-100">
        {n.timeLabel}
        {n.title ? ` \u00b7 ${n.title}` : ""}
      </p>
      {n.rsvps != null && (
        <div className="mt-3">
          <p className="text-[14px] text-leaf-100">
            <span className="font-semibold text-white">{n.rsvps}</span>
            {`${n.capacity ? ` of ${n.capacity}` : ""} RSVP\u2019d`}
          </p>
          {pct != null && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-leaf-300" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}
      {n.steps?.find((st) => st.you && st.status === "current") && (
        <p className="mt-3 text-[14px] font-semibold text-amber-200">Your turn: {n.steps.find((st) => st.you && st.status === "current")?.label}</p>
      )}
    </a>
  );
}

function Card({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-7">
      {children}
    </section>
  );
}

/** A card, or (bare) a plain section of another card. */
function CardOrPlain({ bare, id, children }: { bare: boolean; id?: string; children: ReactNode }) {
  return bare ? <div id={id} className="scroll-mt-6">{children}</div> : <Card id={id}>{children}</Card>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="font-fm-serif text-[26px] leading-tight text-stone-900">{children}</h2>;
}

/** Who the group asks for on this night; changeable when it's someone else on shift. */
function NightContact({ token, n }: { token: string; n: Night }) {
  const [c, setC] = useState(n.contact);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(n.contact?.isDefault ? "" : n.contact?.name || "");
  const [phone, setPhone] = useState(n.contact?.isDefault ? "" : n.contact?.phone || "");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (reset = false) => {
    setBusy(true);
    setError(null);
    try {
      const r = (await merchantRun("updateMerchantNightContact", { token, slotId: n.id, name, phone, reset })) as {
        contact: NonNullable<Night["contact"]>;
        introSent: boolean;
      };
      setC(r.contact);
      setEditing(false);
      if (reset) {
        setName("");
        setPhone("");
      }
      setNote(r.introSent ? "Saved. Your host already has the earlier contact, so reply to Shawn and we'll let them know." : "Saved. We'll pass it to your host.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setBusy(false);
    }
  };

  if (!c) return null;
  const input = "h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-[15px] focus:border-leaf-600 focus:outline-none";
  return (
    <div className="mt-2 text-[14px]">
      {!editing ? (
        <p className="text-stone-600">
          {`Ask for ${c.name || "your team"}${c.phone ? ` · ${c.phone}` : ""}`}
          {!c.isDefault && <span className="ml-1.5 rounded-full bg-leaf-100 px-2 py-0.5 text-[11px] font-semibold text-leaf-800">this night</span>}
          <button type="button" onClick={() => setEditing(true)} className="ml-2 font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
            Change
          </button>
        </p>
      ) : (
        <div className="rounded-2xl bg-stone-50 p-3">
          <p className="mb-2 text-[13px] text-stone-600">Someone else on that night? Just for this date.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name" autoComplete="name" className={input} />
            <input
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="Phone (optional)"
              type="tel"
              inputMode="tel"
              className={input}
            />
          </div>
          {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy} onClick={() => save(false)} className="h-10 rounded-xl bg-leaf-800 px-4 text-[14px] font-semibold text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save for this night"}
            </button>
            {!c.isDefault && (
              <button type="button" disabled={busy} onClick={() => save(true)} className="text-[13px] font-semibold text-stone-600 underline">
                Use the usual contact
              </button>
            )}
            <button type="button" onClick={() => setEditing(false)} className="text-[13px] text-stone-500">
              Cancel
            </button>
          </div>
        </div>
      )}
      {note && !editing && <p className="mt-1 text-[13px] text-leaf-700">{note}</p>}
    </div>
  );
}

/** Booked → (payouts) → on the calendar → RSVPs → the night, with their turn called out. */
/** Step names as merchants see them ("Booked" reads as "Date set", as in setup). */
const STEP_LABEL: Record<string, string> = { booked: "Date set" };

/** A step's green: spread light to dark across however many steps the night has. */
const greenFor = (i: number, n: number) => STEP_GREENS[n > 1 ? Math.round((i * (STEP_GREENS.length - 1)) / (n - 1)) : STEP_GREENS.length - 1];

/**
 * One night's progress as a bar, in the setup bar's greens: a segment per
 * step, filled through the current one, with what's happening now under it.
 */
function NightSteps({ steps }: { steps: Step[] }) {
  const current = steps.find((st) => st.status === "current") || null;
  return (
    <div className="mt-3">
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((st, i) => {
          const on = st.status !== "todo";
          return (
            <li key={st.key} aria-current={st.status === "current" ? "step" : undefined}>
              <div
                className={`h-2 rounded-full ${on ? "" : "bg-stone-200"} ${st.status === "current" && st.you ? "ring-2 ring-amber-300" : ""}`}
                style={on ? { backgroundColor: greenFor(i, steps.length) } : undefined}
              />
              <p className={`mt-1.5 text-[12px] leading-tight ${st.status === "current" ? "font-semibold text-stone-900" : on ? "text-stone-600" : "text-stone-400"}`}>
                {STEP_LABEL[st.key] || st.label}
                <span className="sr-only">{st.status === "done" ? " (done)" : st.status === "current" ? " (now)" : " (next)"}</span>
              </p>
            </li>
          );
        })}
      </ol>
      {current?.detail && <p className="mt-2 text-[14px] text-stone-600">{current.detail}</p>}
      {current?.you && current.key === "payouts" && (
        <a href="#payouts" className="mt-1 inline-block text-[14px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
          Set up payouts
        </a>
      )}
    </div>
  );
}

/** The counter card: print it or have some mailed, right here (it used to be its own page). */
function CounterCard({ d, token, bare = false }: { d: Dashboard; token: string; bare?: boolean }) {
  const [open, setOpen] = useState(() => linkedHere("counter-card"));
  return (
    <CardOrPlain bare={bare} id="counter-card">
      {bare ? <h3 className="text-[17px] font-semibold text-stone-900">Your counter card</h3> : <H2>Your counter card</H2>}
      <p className={bare ? "mt-0.5 text-[14px] leading-snug text-stone-600" : "mt-2 text-[15px] leading-relaxed text-stone-600"}>A card with a QR code for your counter, so regulars can join the community meetups at your spot.</p>
      {d.placardToken ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-3 inline-block text-[15px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4"
          >
            {open ? "Hide" : "Print or order cards"}
          </button>
          {open && <PlacardClient token={d.placardToken} embed={{ offerToken: token }} />}
        </>
      ) : (
        <a href={d.placardUrl || "#"} className="mt-3 inline-block text-[15px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
          Print or order cards
        </a>
      )}
    </CardOrPlain>
  );
}

/** Emails link to one night (#night-<id>) or the counter card; open it when they land. */

/** Two days out with light RSVPs: run it anyway, or move it to a later week at no cost. */
function MakeGoodChoice({ n, token }: { n: Night; token: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = async (choice: "run" | "move") => {
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run("chooseMakeGood", { token: n.resultsToken, choice, embed: true, ...merchantAuth(token) });
      setDone(choice === "run" ? "Great, it's on. We'll keep pushing it this week." : "Got it. We'll move it and confirm the new week with you. No extra cost.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save. Try again?");
    } finally {
      setBusy(false);
    }
  };
  if (done) return <p className="mt-3 rounded-xl bg-stone-50 p-3 text-[14px] text-stone-700">{done}</p>;
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
      <p className="text-[14px] font-semibold text-amber-900">
        RSVPs are light so far{n.makeGood?.rsvps != null ? ` (${n.makeGood.rsvps})` : ""}. Run it anyway, or move it to a later week at no cost?
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={() => choose("run")} className="h-10 flex-1 rounded-lg bg-leaf-800 text-[14px] font-semibold text-white disabled:opacity-50">
          Run it
        </button>
        <button type="button" disabled={busy} onClick={() => choose("move")} className="h-10 flex-1 rounded-lg border border-stone-300 bg-white text-[14px] font-semibold text-stone-800 disabled:opacity-50">
          Move it free
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}

/**
 * The "Add a Leaf host" option on a night they run. Asking sends offers to the
 * best-matched Leaf hosts; until one says yes they're still hosting, and the
 * fee applies only if a host runs it (and 5+ neighbors RSVP).
 */
function HostAddOn({ n, token }: { n: Night; token: string }) {
  const [state, setState] = useState(n.hostAddOn?.state ?? null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fee = dollars(n.hostAddOn?.feeCents ?? 9900);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await merchantRun("merchantAddLeafHost", { token, slotId: n.id })) as { state: typeof state };
      setState(r.state);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn\u2019t ask for a host");
    } finally {
      setBusy(false);
    }
  };

  if (state === "available") {
    return (
      <div className="mt-4 rounded-2xl bg-leaf-50 p-4 ring-1 ring-leaf-200">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-fm-serif text-[20px] leading-tight text-stone-900">Add a Leaf host</p>
          <p className="shrink-0 text-[14px] font-semibold text-leaf-800">{fee}</p>
        </div>
        <p className="mt-1 text-[14px] leading-snug text-stone-600">
          A Leaf host welcomes the group and runs the night. You get what guests spent, photos for your socials, and how many became regulars.
        </p>
        {confirming ? (
          <>
            <p className="mt-3 text-[13px] leading-snug text-stone-600">
              {`We'll offer it to the best-matched Leaf hosts now. You're hosting until one says yes, and it's ${fee} only if a host runs it and at least one neighbor RSVPs.`}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={ask} className="h-11 flex-1 rounded-xl bg-leaf-800 text-[14px] font-semibold text-white disabled:opacity-50">
                {busy ? "Asking\u2026" : "Yes, find me a host"}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="h-11 rounded-xl border border-stone-300 px-4 text-[14px] font-semibold text-stone-700">
                Not now
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="mt-3 h-11 w-full rounded-xl bg-leaf-800 text-[14px] font-semibold text-white">
            Add a Leaf host
          </button>
        )}
        {error && <p className="mt-2 text-[14px] text-red-600">{error}</p>}
      </div>
    );
  }
  if (state === "offering") {
    return (
      <p className="mt-3 rounded-xl bg-leaf-50 p-3 text-[14px] leading-snug text-leaf-900 ring-1 ring-leaf-200">
        <span className="font-semibold">Finding your Leaf host.</span> We&rsquo;ll email you when one says yes. Until then, you&rsquo;re hosting as planned.
      </p>
    );
  }
  if (state === "none_found") {
    return <p className="mt-3 text-[14px] text-stone-600">No Leaf host was free for this one, so you&rsquo;re hosting as planned. No host fee.</p>;
  }
  if (state === "too_close") {
    return <p className="mt-3 text-[13px] text-stone-500">Want a Leaf host? Add one at least 10 days ahead.</p>;
  }
  return null;
}

function UpcomingNight({ n, token }: { n: Night; token: string }) {
  const p = PHASE[n.phase as keyof typeof PHASE];
  const pct = n.rsvps != null && n.capacity ? Math.min(100, Math.round((n.rsvps / n.capacity) * 100)) : null;
  return (
    <div id={`night-${n.id}`} className="scroll-mt-6 border-t border-stone-100 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-fm-serif text-[22px] leading-tight text-stone-900">{n.dateLabel}</p>
          <p className="text-[14px] text-stone-500">
            {n.timeLabel}
            {n.title ? ` · ${n.title}` : ""}
          </p>
        </div>
        {p && <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${p.tone}`}>{p.label}</span>}
      </div>
      {n.rsvps != null && (
        <div className="mt-3">
          <p className="text-[14px] text-stone-700">
            <span className="font-semibold text-stone-900">{n.rsvps}</span>
            {` ${n.rsvps === 1 ? "neighbor has" : "neighbors have"} RSVP’d${n.capacity ? ` of ${n.capacity}` : ""}`}
          </p>
          {pct != null && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-leaf-600" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}
      {n.makeGood && !n.makeGood.choice && n.resultsToken && <MakeGoodChoice n={n} token={token} />}
      {n.steps?.length ? (
        <NightSteps steps={n.steps} />
      ) : (
        n.phase === "pending" && (
          <p className="mt-2 text-[14px] text-stone-600">We&rsquo;re lining up the night. You&rsquo;ll get a note when it&rsquo;s on the calendar.</p>
        )
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px]">
        {n.host && (
          <span className="text-stone-600">{n.host.kind === "leaf" ? `Leaf host${n.host.name ? `: ${n.host.name}` : ""}` : "You're hosting"}</span>
        )}
        {n.planUrl && (
          <a
            href={n.planUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4"
          >
            See the event page
          </a>
        )}
      </div>
      <HostAddOn n={n} token={token} />
      <NightContact token={token} n={n} />
    </div>
  );
}

function PastNight({ n, token }: { n: Night; token: string }) {
  const [open, setOpen] = useState(() => linkedHere(`night-${n.id}`));
  const r = n.report;
  return (
    <div id={`night-${n.id}`} className="scroll-mt-6 border-t border-stone-100 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-fm-serif text-[20px] leading-tight text-stone-900">{n.dateLabel}</p>
        {n.guests != null && <p className="shrink-0 text-[14px] text-stone-600">{n.guests} guests</p>}
      </div>
      {n.charge && (
        <p className={`mt-1 text-[14px] ${n.charge.status === "failed" ? "font-semibold text-amber-700" : "text-stone-600"}`}>
          {n.charge.label}
          {n.charge.status === "paid" || n.charge.status === "failed" ? ` · ${dollars(n.charge.amountCents)}` : ""}
          {n.charge.status === "paid" && n.charge.billed != null ? ` for ${n.charge.billed} RSVPs` : ""}
        </p>
      )}
      {n.payout?.payoutCents != null && n.payout.payoutCents > 0 && (
        <p className="mt-1 text-[14px] text-stone-600">
          Your payout: {dollars(n.payout.payoutCents)}
          {n.payout.status === "paid" ? " · sent" : ""}
        </p>
      )}
      {r?.spend && (
        <div className="mt-3 rounded-2xl bg-leaf-50 p-3">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-700">What guests spent</p>
          <p className="mt-1 font-fm-serif text-[24px] leading-tight text-stone-900">{dollars(r.spend.subtotalCents)}</p>
          <p className="text-[13px] text-stone-600">
            across {r.spend.checks} {r.spend.checks === 1 ? "check" : "checks"}
            {r.spend.perGuestCents ? ` · about ${dollars(Math.round(r.spend.perGuestCents / 100) * 100)} a guest` : ""}
          </p>
          {(r.regulars.followsFromNight != null || r.regulars.returning != null) && (
            <p className="mt-1 text-[13px] text-stone-600">
              {[
                r.regulars.followsFromNight != null ? `${r.regulars.followsFromNight} followed the calendar from your counter card` : null,
                r.regulars.returning != null ? `${r.regulars.returning} came back for another` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {r.photos.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {r.photos.slice(0, 6).map((src, i) => (
                <a key={`${i}-${src}`} href={src} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="From the night" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
      {n.resultsToken ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-2 inline-block text-[14px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4"
          >
            {open ? "Hide how it went" : "How it went, and book another"}
          </button>
          {open && (
            <div className="mt-2 rounded-2xl border border-stone-200 bg-stone-50/60 px-4 pb-4">
              <ResultsClient token={n.resultsToken} embed={{ offerToken: token }} />
            </div>
          )}
        </>
      ) : (
        n.resultsUrl && (
          <a href={n.resultsUrl} className="mt-2 inline-block text-[14px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
            How it went
          </a>
        )
      )}
    </div>
  );
}

/**
 * Loads the dashboard; calls onUnavailable when the server can't serve one
 * (not accepted yet, or an older server), so the page falls back to the form.
 */
export default function MerchantDashboard({
  token,
  onEdit,
  onUnavailable,
  account,
  welcome = null,
  preview = false,
}: {
  token: string;
  onEdit: () => void;
  onUnavailable: () => void;
  /** Card and notification settings, rendered by the page that owns their state. */
  account: ReactNode;
  /** What just happened (after Hold), shown at the top. */
  welcome?: string | null;
  /** ?preview=1: Shawn seeing what they see. Shown as is, nothing clickable. */
  preview?: boolean;
}) {
  const [d, setD] = useState<Dashboard | null>(null);
  const [reload, setReload] = useState(0);
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  // Your nights: coming up, or past (an email\u2019s #report link opens past).
  const [tab, setTab] = useState<"upcoming" | "past">(() => (linkedHere("report") ? "past" : "upcoming"));
  const [reqDate, setReqDate] = useState("");
  const [reqPart, setReqPart] = useState<"morning" | "afternoon" | "evening" | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookNote, setBookNote] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  // Nights inside 8 days can't be set up in time, so requests start after that.
  const earliest = (() => {
    const d = new Date(Date.now() + 8 * 864e5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const skipRequest = async (requestId: string) => {
    try {
      await merchantRun("merchantSkipRequest", { token, requestId });
      setReload((n) => n + 1);
    } catch (e) {
      setBookError(e instanceof Error ? e.message : "Couldn't skip that one");
    }
  };

  const requestNight = async () => {
    setBooking(true);
    setBookError(null);
    try {
      const r = (await merchantRun("merchantRequestNight", { token, dateKey: reqDate, partOfDay: reqPart })) as { request: { label: string } };
      setBookNote(`Requested: ${r.request.label}. We'll confirm the time within a day.`);
      setReqDate("");
      setReqPart(null);
      setReload((n) => n + 1);
    } catch (e) {
      setBookError(e instanceof Error ? e.message : "Couldn't send that request");
    } finally {
      setBooking(false);
    }
  };

  useEffect(() => {
    let live = true;
    merchantRun("getOfferMerchantDashboard", { token })
      .then((r: unknown) => {
        if (!live) return;
        const dash = r as Dashboard;
        if (dash.state !== "accepted") onUnavailable();
        else setD(dash);
      })
      .catch(() => live && onUnavailable());
    return () => {
      live = false;
    };
  }, [token, onUnavailable, reload]);

  // An email's #night-<id> or #counter-card: once the nights are on the page, scroll to it.
  useEffect(() => {
    const id = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (!d || !(id.startsWith("night-") || id === "counter-card")) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    return () => clearTimeout(t);
  }, [d]);

  if (!d) {
    return (
      <Shell>
        <Brand />
        <p className="mt-10 text-center text-[15px] text-stone-500">Loading your Neighbor Hours…</p>
      </Shell>
    );
  }

  const perRsvp = d.model === "per_rsvp";
  const credit = perRsvp ? d.credit ?? null : null;

  return (
    <div className={`min-h-dvh ${CREAM} font-fm-sans text-stone-900`}>
      <main className="mx-auto max-w-xl px-4 pb-24 pt-5 sm:px-6 lg:max-w-6xl lg:px-10 lg:pt-8">
        {preview && (
          <p className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-[13px] font-medium text-amber-900">
            {`Preview of ${d.merchantName}\u2019s dashboard, what they see when they open their link. Nothing here can be changed. `}
            <button type="button" onClick={onEdit} className="underline underline-offset-2">
              See their form
            </button>
          </p>
        )}
        <div inert={preview || undefined}>
          <Brand neighborhood={d.neighborhood} />

          {/* One header: who they are, and where things stand (the setup bar while their
              free first night is set up, then their next night). No calendar, by name or
              link: merchants shouldn't be pointed at a calendar of other places. */}
          <header className="mt-5 rounded-3xl bg-leaf-800 p-6 text-white sm:p-8 lg:mt-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-300">Your Neighbor Hours</p>
                <h1 className="mt-2 font-fm-serif text-[36px] leading-[1.02] lg:text-[48px]">{d.merchantName}</h1>
              </div>
              {d.setup ? <SetupProgress setup={d.setup} /> : <NextUp n={d.upcoming[0] || null} perRsvp={perRsvp} campaign={campaign} settingUp={false} />}
            </div>
            {/* The running totals, once there's something to count (a row of zeros reads as broken). */}
            {d.totals.nightsRun > 0 && (
              <div className="mt-6 flex divide-x divide-white/15">
                <Stat value={d.totals.nightsRun} label={d.totals.nightsRun === 1 ? "night hosted" : "nights hosted"} />
                <Stat value={d.totals.guests} label="neighbors through your door" />
                {perRsvp ? <Stat value={dollars(d.totals.chargedCents)} label="charged so far" /> : <Stat value={d.totals.upcoming} label="coming up" />}
              </div>
            )}
          </header>

          {(welcome || d.cardFailed) && (
            <div className="mt-5 space-y-3">
              {welcome && <div className="rounded-2xl bg-leaf-100 p-4 text-[15px] font-semibold text-leaf-900">{welcome}</div>}
              {d.cardFailed && (
                <a href="#card" className="block rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-900 ring-1 ring-amber-200">
                  Your last charge didn&rsquo;t go through. <span className="font-semibold underline">Update your card</span>
                </a>
              )}
            </div>
          )}

          <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
            {/* Main column: their Neighbor Hours, then their nights. */}
            <div className="min-w-0 space-y-6">
              {perRsvp && <MerchantCampaign token={token} preview={preview} firstNightFree={d.freeNight.state === "granted"} onSummary={setCampaign} />}

              {/* Your nights: what's coming up (with each night's bar and the host add-on), and past weeks. */}
              <Card id="nights">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <H2>Your nights</H2>
                  <div role="tablist" className="flex gap-1 rounded-full bg-stone-100 p-1">
                    {(["upcoming", "past"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="tab"
                        aria-selected={tab === t}
                        onClick={() => setTab(t)}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${tab === t ? "bg-leaf-800 text-white" : "text-stone-600"}`}
                      >
                        {t === "upcoming" ? "Coming up" : "Past"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  {tab === "upcoming" ? (
                    <>
              {/* The first night's request is the setup bar's job while it shows. */}
              {d.requests && d.requests.some((q) => !(d.setup && q.kind === "first")) && (
                <div className="mb-5 rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-stone-500">Waiting on us</p>
                  <div className="mt-3 space-y-4">
                    {d.requests.filter((q) => !(d.setup && q.kind === "first")).map((q) => (
                      <div key={q.id} className="flex items-start justify-between gap-4">
                        <p className="text-[15px] text-stone-700">
                          <span className="font-semibold text-stone-900">{q.kind === "first" ? `Your first ${q.label.replace(/s( \u00b7.*)?$/, "")}` : q.label}</span>
                          <span className="mt-0.5 block text-[13px] leading-snug text-stone-500">
                            {q.source === "campaign"
                              ? "Lined up from your days. We'll confirm the time with you. Nothing is booked until then."
                              : "We\u2019ll confirm the date and time with you within a day. Nothing is booked until then."}
                          </span>
                        </p>
                        {q.kind === "rebook" && !preview && (
                          <button type="button" onClick={() => skipRequest(q.id)} className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-[14px] font-semibold text-stone-700">
                            Skip
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

                      {d.upcoming.length ? (
                        d.upcoming.map((n) => <UpcomingNight key={n.id} n={n} token={token} />)
                      ) : (
                        <div className="rounded-2xl bg-leaf-50 p-4 ring-1 ring-leaf-100">
                          <p className="text-[15px] font-semibold text-stone-900">
                            {d.setup
                              ? "Your free first Neighbor Hour shows up here once its date is set."
                              : perRsvp && campaign?.on
                                ? "Nothing booked yet."
                                : perRsvp
                                  ? "Nothing on the books right now."
                                  : "Nothing on the books right now."}
                          </p>
                          <p className="mt-1 text-[14px] leading-snug text-stone-600">
                            {perRsvp && !campaign?.on && !d.setup
                              ? "Switch your Neighbor Hours on and neighbors\u2019 plans at your place show up here."
                              : perRsvp
                                ? "Each night gets its own progress bar, the RSVPs as they come in, and the option to add a Leaf host."
                                : "Request a Neighbor Hour below."}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-6">
                      {perRsvp && <MerchantReport token={token} bare />}
                      {d.past.length > 0 ? (
                        <div>
                          <h3 className="text-[17px] font-semibold text-stone-900">Past Neighbor Hours</h3>
                          <div className="mt-2">
                            {d.past.map((n) => (
                              <PastNight key={n.id} n={n} token={token} />
                            ))}
                          </div>
                        </div>
                      ) : (
                        !perRsvp && <p className="text-[15px] text-stone-600">Your past Neighbor Hours show up here.</p>
                      )}
                      {d.cancelled.length > 0 && <p className="text-[13px] text-stone-500">Called off: {d.cancelled.map((n) => n.dateLabel).join(", ")}</p>}
                    </div>
                  )}
                </div>
              </Card>

              {/* Ticketed places have no usual days (no campaign), so every night is a request.
                  Bars and restaurants book through their Neighbor Hours days instead. */}
              {!perRsvp && (
              <Card id="book">
                <H2>Request a Neighbor Hour</H2>
                <p className="mt-1 text-[15px] text-stone-600">
                  Pick a date and the part of the day; we&rsquo;ll set the time and confirm.
                </p>
                {bookNote && <p className="mt-3 rounded-xl bg-leaf-50 p-3 text-[14px] font-semibold text-leaf-800">{bookNote}</p>}
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                  <input
                    type="date"
                    value={reqDate}
                    min={earliest}
                    onChange={(e) => setReqDate(e.target.value)}
                    className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-[16px] focus:border-leaf-600 focus:outline-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {(["morning", "afternoon", "evening"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setReqPart(reqPart === p ? null : p)}
                        aria-pressed={reqPart === p}
                        className={`h-12 rounded-xl border text-[14px] font-semibold capitalize ${reqPart === p ? "border-leaf-800 bg-leaf-800 text-white" : "border-stone-300 bg-white text-stone-800"}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {bookError && <p className="mt-2 text-[14px] text-red-600">{bookError}</p>}
                <button
                  type="button"
                  disabled={booking || !reqDate || !reqPart}
                  onClick={requestNight}
                  className="mt-4 h-12 w-full rounded-xl bg-leaf-800 text-[15px] font-semibold text-white disabled:opacity-40"
                >
                  {booking ? "Sending\u2026" : "Request this Neighbor Hour"}
                </button>
              </Card>
              )}

            </div>

            {/* Side column on desktop, the rest of the page on a phone. */}
            <aside className="min-w-0 space-y-6">
              {/* Ways to bring in more neighbors: their hello, a deal, the counter card. */}
              <Card id="grow">
                <H2>Get more neighbors</H2>
                <div className="mt-4 divide-y divide-stone-100 [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
                  <MerchantHello token={token} compact />
                  {/* Ticketed places have no card on file, so deals (charged to a card) are per-RSVP only. */}
                  {perRsvp && <MerchantDeals token={token} preview={preview} bare />}
                  {/* Every business with a space gets one, ticketed studios included (front desk or counter). */}
                  {(d.placardToken || d.placardUrl) && <CounterCard d={d} token={token} bare />}
                </div>
              </Card>
              {/* Prepaid balances are gone (2026-10-08); show one only while some is left. */}
              {credit && credit.balanceCents > 0 && <LeafBalance credit={credit} />}
              {/* Settings, folded: card, notifications, their details. */}
              <Card id="account">
                <H2>Account</H2>
                <div className="mt-2 divide-y divide-stone-100">
                  {account}
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-stone-900">Your details</p>
                      <p className="text-[13px] text-stone-500">Your night, how many you seat, who to ask for</p>
                    </div>
                    <button type="button" onClick={onEdit} className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-[14px] font-semibold text-stone-700">
                      Change
                    </button>
                  </div>
                </div>
              </Card>
              <p className="px-1 pb-6 text-[13px] text-stone-500">
                Questions? Reply to any email from Leaf, or write{" "}
                <a href="mailto:partners@joinleaf.com" className="underline">
                  partners@joinleaf.com
                </a>
                .
              </p>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
