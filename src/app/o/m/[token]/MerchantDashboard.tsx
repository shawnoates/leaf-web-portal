"use client";

/**
 * The merchant's home after they say yes: their nights coming up, how past
 * nights went (and what they cost), and their account. Counts only, never
 * guest names. Reached from the same offer link as the sign-up form.
 */

import { type ReactNode, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Brand, Shell, dollars, formatPhone } from "./ui";

type Phase = "pending" | "confirmed" | "now" | "past" | "cancelled";
type Night = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  phase: Phase;
  title: string;
  rsvps: number | null;
  capacity: number | null;
  guests: number | null;
  host: { kind: "leaf" | "you"; name: string | null } | null;
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
  calendarName: string;
  calendarUrl: string | null;
  neighborhood: string;
  weekdayLabel: string;
  startTimeLabel: string;
  model: "per_rsvp" | "ticket";
  rsvpFeeCents: number;
  freeNight: { state: "open" | "granted" | "lapsed" | "used"; free: boolean };
  cardFailed: boolean;
  placardUrl: string | null;
  upcoming: Night[];
  past: Night[];
  cancelled: Night[];
  totals: {
    upcoming: number;
    nightsRun: number;
    guests: number;
    chargedCents: number;
  };
};

const PHASE: Record<Exclude<Phase, "past" | "cancelled">, { label: string; tone: string }> = {
  now: { label: "Happening now", tone: "bg-emerald-600 text-white" },
  confirmed: { label: "On the calendar", tone: "bg-leaf-100 text-leaf-800" },
  pending: { label: "Being set up", tone: "bg-stone-100 text-stone-600" },
};

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="font-fm-serif text-[28px] leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[12px] text-leaf-200">{label}</p>
    </div>
  );
}

function Card({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-3xl bg-white p-5 shadow-sm">
      {children}
    </section>
  );
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
      const r = (await Parse.Cloud.run("updateMerchantNightContact", { token, slotId: n.id, name, phone, reset })) as {
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
              placeholder="(555) 555-5555"
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

function UpcomingNight({ n, token }: { n: Night; token: string }) {
  const p = PHASE[n.phase as keyof typeof PHASE];
  const pct = n.rsvps != null && n.capacity ? Math.min(100, Math.round((n.rsvps / n.capacity) * 100)) : null;
  return (
    <div className="border-t border-stone-100 py-4 first:border-t-0 first:pt-0 last:pb-0">
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
      {n.phase === "pending" && (
        <p className="mt-2 text-[14px] text-stone-600">We&rsquo;re lining up the night. You&rsquo;ll get a note when it&rsquo;s on the calendar.</p>
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
      <NightContact token={token} n={n} />
    </div>
  );
}

function PastNight({ n }: { n: Night }) {
  const r = n.report;
  return (
    <div className="border-t border-stone-100 py-4 first:border-t-0 first:pt-0 last:pb-0">
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
                r.regulars.followsFromNight != null ? `${r.regulars.followsFromNight} followed the calendar from your table card` : null,
                r.regulars.returning != null ? `${r.regulars.returning} came back for another night` : null,
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
      {n.resultsUrl && (
        <a href={n.resultsUrl} className="mt-2 inline-block text-[14px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4">
          How it went
        </a>
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
}: {
  token: string;
  onEdit: () => void;
  onUnavailable: () => void;
  /** Card and notification settings, rendered by the page that owns their state. */
  account: ReactNode;
}) {
  const [d, setD] = useState<Dashboard | null>(null);

  useEffect(() => {
    let live = true;
    Parse.Cloud.run("getOfferMerchantDashboard", { token })
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
  }, [token, onUnavailable]);

  if (!d) {
    return (
      <Shell>
        <Brand />
        <p className="mt-10 text-center text-[15px] text-stone-500">Loading your nights…</p>
      </Shell>
    );
  }

  const perRsvp = d.model === "per_rsvp";
  return (
    <Shell>
      <Brand neighborhood={d.neighborhood} />

      <div className="mt-6 rounded-3xl bg-leaf-800 p-6 text-white">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-leaf-300">Your Leaf nights</p>
        <h1 className="mt-2 font-fm-serif text-[36px] leading-[1.02]">{d.merchantName}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-leaf-100">
          {d.calendarUrl ? (
            <a href={d.calendarUrl} target="_blank" rel="noreferrer" className="underline decoration-leaf-400 underline-offset-4">
              {d.calendarName}
            </a>
          ) : (
            d.calendarName
          )}
          {d.weekdayLabel ? ` · ${d.weekdayLabel} at ${d.startTimeLabel}` : ""}
        </p>
        <div className={`mt-5 grid gap-3 ${perRsvp ? "grid-cols-4" : "grid-cols-3"}`}>
          <Stat value={d.totals.upcoming} label="coming up" />
          <Stat value={d.totals.nightsRun} label="nights run" />
          <Stat value={d.totals.guests} label="guests" />
          {perRsvp && <Stat value={dollars(d.totals.chargedCents)} label="charged" />}
        </div>
      </div>

      {d.cardFailed && (
        <a href="#card" className="mt-4 block rounded-2xl bg-amber-50 p-4 text-[15px] text-amber-900 ring-1 ring-amber-200">
          Your last charge didn&rsquo;t go through. <span className="font-semibold underline">Update your card</span>
        </a>
      )}

      <div className="mt-4 space-y-4">
        <Card>
          <H2>Coming up</H2>
          <div className="mt-3">
            {d.upcoming.length ? (
              d.upcoming.map((n) => <UpcomingNight key={n.id} n={n} token={token} />)
            ) : (
              <p className="text-[15px] text-stone-600">Nothing on the books right now. Pick more nights and we&rsquo;ll fill them.</p>
            )}
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="mt-4 h-12 w-full rounded-xl border border-stone-300 text-[15px] font-semibold text-stone-800"
          >
            Change your nights or details
          </button>
        </Card>

        {d.past.length > 0 && (
          <Card>
            <H2>Past nights</H2>
            <div className="mt-3">
              {d.past.map((n) => (
                <PastNight key={n.id} n={n} />
              ))}
            </div>
          </Card>
        )}

        {perRsvp && (
          <Card>
            <H2>How billing works</H2>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">
              {dollars(d.rsvpFeeCents)} per RSVP, counted 2 hours before and charged after the night, never more than you seat. Under 5 RSVPs costs
              nothing.
              {d.freeNight.state === "granted" ? " Your first night is free." : d.freeNight.state === "used" ? " Your free first night is used." : ""}
            </p>
          </Card>
        )}

        {account}

        {d.placardUrl && (
          <Card>
            <H2>Your table card</H2>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-600">A card with a QR code for the table, so guests can follow the calendar.</p>
            <a
              href={d.placardUrl}
              className="mt-3 inline-block text-[15px] font-semibold text-leaf-700 underline decoration-leaf-300 underline-offset-4"
            >
              Print or order cards
            </a>
          </Card>
        )}

        {d.cancelled.length > 0 && <p className="px-1 text-[13px] text-stone-500">Called off: {d.cancelled.map((n) => n.dateLabel).join(", ")}</p>}
        <p className="px-1 pb-6 text-[13px] text-stone-500">
          Questions, or want to stop? Reply to any email from Leaf, or write{" "}
          <a href="mailto:shawn@getleaflets.co" className="underline">
            shawn@getleaflets.co
          </a>
          .
        </p>
      </div>
    </Shell>
  );
}
