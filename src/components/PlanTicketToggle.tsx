"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { ArrowUpRight, Check, Ticket } from "lucide-react";
import { dollarsFromCents, lockByLine, type Admission } from "@/lib/externalEvents";

type Person = {
  userId: string | null;
  firstName: string;
  hasTicket: boolean;
  coveredByName: string | null;
  covered: boolean;
  paid: boolean;
  received: boolean;
  isMe: boolean;
};

type GroupBuy = {
  buyer: { userId: string; firstName: string; isMe: boolean };
  lockBy: string | null;
  estimateEachCents: number | null;
  bought: boolean;
  seats: number | null;
  totalCents: number | null;
  shareCents: number | null;
  section: string | null;
  row: string | null;
  delivery: "send" | "door" | null;
  covered: number;
  paid: number;
  owing: number;
};

type PayOption = { method: string; label: string; handle?: string; url: string | null; appUrl?: string };

export type PlanTickets = {
  going: number;
  withTicket: number;
  mine: boolean | null;
  people: Person[];
  admission: Admission;
  seating: "together" | "own" | null;
  groupBuyAllowed: boolean;
  section: string | null;
  isHost: boolean;
  groupBuy: GroupBuy | null;
  me: { hasTicket: boolean; coveredByName: string | null; covered: boolean; paid: boolean; received: boolean; shareCents: number | null } | null;
  payOptions: PayOption[];
  myHandles: { venmo?: string; cashapp?: string; paypal?: string; zelle?: string } | null;
  canStartGroupBuy: boolean;
  clicks?: number;
};

function errText(err: unknown): string {
  return err instanceof Error ? err.message : "That didn't save. Try again.";
}

/**
 * The tickets card for someone going to a plan made from an outside event
 * (getPlanTickets). By admission:
 *   ticket        "I'm covered" (or "Someone got mine"), and on friend plans at
 *                 seated venues the group buy: one buyer, lock in, "I bought
 *                 them", each person's share with the buyer's pay links.
 *   registration  "I'm registered"
 *   open          nothing
 * Renders nothing until the viewer is signed in and going — phone
 * verification at RSVP signs them in, so it appears right after they RSVP.
 */
export default function PlanTicketToggle({
  eventGroupId,
  refreshKey,
  sourceLabel = "the ticket site",
  ticketHref,
}: {
  eventGroupId: string;
  refreshKey?: string | number | boolean;
  sourceLabel?: string;
  ticketHref?: string | null;
}) {
  const [t, setT] = useState<PlanTickets | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askingName, setAskingName] = useState(false);
  const [byName, setByName] = useState("");
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      if (!Parse.User.current()) return;
    } catch { return; }
    Parse.Cloud.run("getPlanTickets", { eventGroupId })
      .then((r: PlanTickets) => { if (!cancelled) setT(r); })
      .catch(() => { if (!cancelled) setT(null); });
    return () => { cancelled = true; };
  }, [eventGroupId, refreshKey]);

  if (!t || (t.mine === null && !t.isHost)) return null;
  if (t.admission === "open") return null;

  async function run(fn: string, params: Record<string, unknown> = {}) {
    setSaving(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run(fn, { eventGroupId, ...params })) as PlanTickets;
      setT(r);
      return true;
    } catch (err) {
      setError(errText(err));
      return false;
    } finally {
      setSaving(false);
    }
  }

  const gb = t.groupBuy;
  const together = t.admission === "ticket" && t.seating === "together" && t.groupBuyAllowed;
  const errorLine = error ? <p className="text-xs text-red-600">{error}</p> : null;
  const submitBought = async (params: Record<string, unknown>) => {
    if (await run("markTicketGroupBought", params)) setBuying(false);
  };

  // ── The group buy ───────────────────────────────────────────────────────
  if (together && gb) {
    const lock = lockByLine(gb.lockBy);
    if (!gb.bought) {
      if (gb.buyer.isMe) {
        if (buying) {
          return <BoughtForm t={t} saving={saving} error={error} onCancel={() => setBuying(false)} onSubmit={submitBought} />;
        }
        const names = t.people.map((p) => (p.isMe ? `${p.firstName} (you)` : p.firstName));
        return (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">You&rsquo;re buying</p>
              <p className="text-base font-semibold text-zinc-900">Buy {t.going} seat{t.going === 1 ? "" : "s"} together</p>
              <p className="text-sm text-zinc-600">{names.join(" · ")}</p>
              <p className="text-xs text-zinc-500 mt-1">Pick every seat in one order so they&rsquo;re next to each other.</p>
            </div>
            {ticketHref && (
              <a href={ticketHref} target="_blank" rel="noopener noreferrer"
                className="w-full bg-zinc-900 text-white rounded-full py-2.5 flex items-center justify-center gap-2 text-sm font-medium hover:bg-zinc-800">
                Get {t.going} tickets on {sourceLabel} <ArrowUpRight className="w-4 h-4" aria-hidden />
              </a>
            )}
            <button type="button" onClick={() => setBuying(true)}
              className="w-full rounded-full py-2.5 border border-zinc-900 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">
              I bought them
            </button>
            <button type="button" onClick={() => run("stopTicketGroupBuy")} disabled={saving}
              className="block mx-auto text-xs text-zinc-500 underline">
              Step back: everyone buys their own
            </button>
            {errorLine}
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-zinc-900">{gb.buyer.firstName} is buying seats together</p>
          <p className="text-sm text-zinc-600">
            {[gb.estimateEachCents ? `About ${dollarsFromCents(gb.estimateEachCents)} each` : null, `Pay ${gb.buyer.firstName} back after`].filter(Boolean).join(" · ")}
          </p>
          {lock && <p className="text-xs font-medium text-orange-800 bg-orange-50 rounded-md px-2.5 py-1.5">Lock in by {lock}. Going means you&rsquo;re in.</p>}
          <PeopleChips people={t.people} />
          {t.isHost && (
            <button type="button" onClick={() => run("startTicketGroupBuy")} disabled={saving}
              className="text-xs text-zinc-500 underline">I&rsquo;ll buy instead</button>
          )}
          {errorLine}
        </div>
      );
    }

    // Bought.
    const where = gb.section ? `Section ${gb.section}${gb.row ? `, Row ${gb.row}` : ""}` : null;
    if (gb.buyer.isMe) {
      const owing = t.people.filter((p) => p.covered && !p.isMe);
      return (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-emerald-800">✓ You bought {gb.seats} seats together{where ? ` · ${where}` : ""}</p>
          {gb.shareCents ? <p className="text-sm text-zinc-600">{dollarsFromCents(gb.totalCents)} in all · {dollarsFromCents(gb.shareCents)} each</p> : null}
          {owing.length > 0 && (
            <p className="text-sm text-zinc-700">
              Paid: {owing.filter((p) => p.paid).map((p) => p.firstName).join(", ") || "nobody yet"}
              {owing.some((p) => !p.paid) ? ` · Waiting: ${owing.filter((p) => !p.paid).map((p) => p.firstName).join(", ")}` : ""}
            </p>
          )}
          {gb.delivery === "send" && owing.length > 0 && (
            <p className="text-xs text-zinc-500">Send each ticket from your {sourceLabel} app. Got it: {owing.filter((p) => p.received).map((p) => p.firstName).join(", ") || "nobody yet"}.</p>
          )}
          {buying ? (
            <BoughtForm t={t} saving={saving} error={error} onCancel={() => setBuying(false)} onSubmit={submitBought} />
          ) : (
            <button type="button" onClick={() => setBuying(true)} className="text-xs text-zinc-500 underline">Fix seats or price</button>
          )}
          {errorLine}
        </div>
      );
    }
    if (t.me?.covered) {
      const me = t.me;
      return (
        <div className="space-y-3">
          <div className="rounded-md bg-emerald-50 px-3 py-2">
            <p className="text-sm font-semibold text-emerald-800">✓ You&rsquo;re covered</p>
            <p className="text-xs text-emerald-700">{gb.buyer.firstName} bought {gb.seats} together{where ? ` · ${where}` : ""}</p>
          </div>
          {me.shareCents ? (
            me.paid ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-700">You paid {gb.buyer.firstName} {dollarsFromCents(me.shareCents)}</span>
                <button type="button" onClick={() => run("setGroupBuyPaid", { paid: false })} disabled={saving} className="text-xs text-zinc-500 underline">Undo</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-zinc-900">You owe {gb.buyer.firstName}</span>
                  <span className="text-lg font-semibold text-zinc-900">{dollarsFromCents(me.shareCents)}</span>
                </div>
                {t.payOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {t.payOptions.filter((o) => o.url).map((o) => (
                      <a key={o.method} href={o.url!} target="_blank" rel="noopener noreferrer"
                        className="flex-1 min-w-[6rem] text-center rounded-full py-2 text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800">
                        {o.label} ↗
                      </a>
                    ))}
                    {t.payOptions.filter((o) => !o.url).map((o) => (
                      <span key={o.method} className="w-full text-xs text-zinc-600">{o.label}: {o.handle}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">Ask {gb.buyer.firstName} how they&rsquo;d like to be paid.</p>
                )}
                <button type="button" onClick={() => run("setGroupBuyPaid", { paid: true })} disabled={saving}
                  className="block mx-auto text-sm font-medium text-zinc-900 underline">I paid {gb.buyer.firstName}</button>
              </div>
            )
          ) : null}
          {gb.delivery === "door" ? (
            <p className="text-xs text-zinc-600">{gb.buyer.firstName} has the tickets. Meet at the door.</p>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 px-3 py-2">
              <span className="text-xs text-zinc-600">{gb.buyer.firstName} sends your ticket to your {sourceLabel} app</span>
              <button type="button" onClick={() => run("setTicketReceived", { received: !me.received })} disabled={saving}
                className={`text-xs font-semibold whitespace-nowrap ${me.received ? "text-emerald-700" : "text-zinc-900 underline"}`}>
                {me.received ? "✓ It's in my app" : "It's in my app"}
              </button>
            </div>
          )}
          {errorLine}
        </div>
      );
    }
    // Going, but not in the order (joined late or left out).
    return (
      <div className="space-y-2">
        <p className="text-sm text-zinc-700">{gb.buyer.firstName} bought {gb.seats} seats together{where ? ` (${where})` : ""}, but not one for you. Get your own, near them if you can.</p>
        <CoveredToggle t={t} saving={saving} label="I'm covered" onToggle={(on, name) => run("setHasTicket", { hasTicket: on, coveredByName: name })}
          askingName={askingName} setAskingName={setAskingName} byName={byName} setByName={setByName} />
        {errorLine}
      </div>
    );
  }

  // ── Everyone buys (or registers) their own ──────────────────────────────
  const label = t.admission === "registration" ? "I'm registered" : "I'm covered";
  const doneWord = t.admission === "registration" ? "registered" : "covered";
  const summary = t.withTicket === t.going ? `Everyone going is ${doneWord}` : `${t.withTicket} of ${t.going} going are ${doneWord}`;
  return (
    <div className="flex flex-col items-center gap-2">
      {t.section && t.admission === "ticket" && (
        <p className="text-sm text-zinc-800"><Ticket className="inline w-3.5 h-3.5 mr-1" aria-hidden />Buy near the group: <b className="font-semibold">Section {t.section}</b></p>
      )}
      {t.mine !== null && (
        <CoveredToggle t={t} saving={saving} label={label} onToggle={(on, name) => run("setHasTicket", { hasTicket: on, coveredByName: name })}
          askingName={askingName} setAskingName={setAskingName} byName={byName} setByName={setByName}
          allowSomeoneElse={t.admission === "ticket"} />
      )}
      <p className="text-xs text-zinc-500">{summary}</p>
      {together && t.canStartGroupBuy && (
        <div className="w-full rounded-md border border-zinc-200 px-3 py-2 text-center">
          <p className="text-xs text-zinc-600">Want to sit together? One person buys every seat in one order.</p>
          <button type="button" onClick={() => run("startTicketGroupBuy")} disabled={saving}
            className="mt-1 text-sm font-semibold text-zinc-900 underline">I&rsquo;ll buy for the group</button>
        </div>
      )}
      {errorLine}
    </div>
  );
}

function PeopleChips({ people }: { people: Person[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {people.map((p, i) => (
        <span key={p.userId ?? i} className="text-xs bg-white border border-zinc-200 rounded-full px-2.5 py-1 text-zinc-800">
          ✓ {p.isMe ? "You" : p.firstName}
        </span>
      ))}
    </div>
  );
}

function CoveredToggle({
  t, saving, label, onToggle, askingName, setAskingName, byName, setByName, allowSomeoneElse = true,
}: {
  t: PlanTickets;
  saving: boolean;
  label: string;
  onToggle: (on: boolean, name?: string) => void;
  askingName: boolean;
  setAskingName: (v: boolean) => void;
  byName: string;
  setByName: (v: string) => void;
  allowSomeoneElse?: boolean;
}) {
  const mine = t.me?.hasTicket ?? t.mine === true;
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => onToggle(!mine)}
        disabled={saving}
        aria-pressed={mine}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-colors disabled:opacity-60 ${
          mine ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-50"
        }`}
      >
        <span className={`w-4 h-4 rounded-full grid place-items-center border ${mine ? "bg-emerald-600 border-emerald-600" : "border-zinc-400"}`} aria-hidden>
          {mine && <Check className="w-3 h-3 text-white" />}
        </span>
        {mine && t.me?.coveredByName ? `${t.me.coveredByName} got mine` : label}
      </button>
      {!mine && allowSomeoneElse && (
        askingName ? (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); onToggle(true, byName.trim() || "Someone"); setAskingName(false); }}>
            <input value={byName} onChange={(e) => setByName(e.target.value)} placeholder="Who got it?" maxLength={40}
              className="w-32 rounded-md border border-zinc-300 px-2 py-1 text-xs" autoFocus />
            <button type="submit" className="text-xs font-semibold text-zinc-900 underline">Save</button>
          </form>
        ) : (
          <button type="button" onClick={() => setAskingName(true)} className="text-xs text-zinc-500 underline">Someone got mine</button>
        )
      )}
    </div>
  );
}

function BoughtForm({
  t, saving, error, onCancel, onSubmit,
}: {
  t: PlanTickets;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (params: Record<string, unknown>) => void;
}) {
  const gb = t.groupBuy;
  const [seats, setSeats] = useState(String(gb?.seats ?? t.going));
  const [total, setTotal] = useState(gb?.totalCents != null ? String(gb.totalCents / 100) : "");
  const [section, setSection] = useState(gb?.section ?? "");
  const [row, setRow] = useState(gb?.row ?? "");
  const [delivery, setDelivery] = useState<"send" | "door">(gb?.delivery ?? "send");
  const [venmo, setVenmo] = useState(t.myHandles?.venmo ?? "");
  const [cashapp, setCashapp] = useState(t.myHandles?.cashapp ?? "");
  const others = t.people.filter((p) => !p.isMe && p.userId);
  const [covered, setCovered] = useState<Set<string>>(
    () => new Set(others.filter((p) => (gb?.bought ? p.covered : true)).map((p) => p.userId!)),
  );
  const seatsN = Number(seats) || 0;
  const totalCents = Math.round((Number(total) || 0) * 100);
  const share = seatsN > 0 ? Math.round(totalCents / seatsN) : 0;
  const hasHandles = Boolean(t.myHandles && Object.values(t.myHandles).some(Boolean));

  return (
    <form
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          seats: seatsN,
          totalCents,
          section,
          row,
          delivery,
          coveredUserIds: [...covered],
          handles: venmo || cashapp ? { venmo, cashapp } : undefined,
        });
      }}
    >
      <p className="text-base font-semibold text-zinc-900">What did you get?</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-zinc-500">Seats
          <input type="number" min={1} max={20} value={seats} onChange={(e) => setSeats(e.target.value)} required
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
        </label>
        <label className="text-xs text-zinc-500">Total paid, with fees ($)
          <input type="number" min={0} step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} required
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
        </label>
        <label className="text-xs text-zinc-500">Section (optional)
          <input value={section} onChange={(e) => setSection(e.target.value)} maxLength={20}
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
        </label>
        <label className="text-xs text-zinc-500">Row (optional)
          <input value={row} onChange={(e) => setRow(e.target.value)} maxLength={20}
            className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900" />
        </label>
      </div>
      {others.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-xs text-zinc-500">Seats for</legend>
          <div className="flex flex-wrap gap-1.5">
            {others.map((p) => {
              const on = covered.has(p.userId!);
              return (
                <button key={p.userId} type="button" aria-pressed={on}
                  onClick={() => setCovered((s) => { const n = new Set(s); if (on) n.delete(p.userId!); else n.add(p.userId!); return n; })}
                  className={`text-xs rounded-full px-2.5 py-1 border ${on ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-300"}`}>
                  {on ? "✓ " : ""}{p.firstName}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      {totalCents > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-zinc-500">How people pay you back{hasHandles ? "" : " (needed)"}</p>
          <div className="grid grid-cols-2 gap-2">
            <input value={venmo} onChange={(e) => setVenmo(e.target.value)} placeholder="Venmo @username"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
            <input value={cashapp} onChange={(e) => setCashapp(e.target.value)} placeholder="Cash App $cashtag"
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        {(["send", "door"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDelivery(d)} aria-pressed={delivery === d}
            className={`flex-1 rounded-full py-1.5 text-xs font-semibold border ${delivery === d ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-700 border-zinc-300"}`}>
            {d === "send" ? "I'll send each one" : "Meet me at the door"}
          </button>
        ))}
      </div>
      {share > 0 && (
        <div className="flex items-baseline justify-between border-t border-zinc-100 pt-2">
          <span className="text-sm text-zinc-600">Each person pays you</span>
          <span className="text-lg font-semibold text-zinc-900">{dollarsFromCents(share)}</span>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-none px-4 rounded-full border border-zinc-300 text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 rounded-full bg-zinc-900 text-white py-2 text-sm font-semibold disabled:opacity-60">
          Tell the group
        </button>
      </div>
    </form>
  );
}
