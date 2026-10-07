"use client";

/**
 * Split something for the night (server: crew-addons.js). One card through
 * the whole thing:
 *   suggested  Leaf's idea for a set night: Add it / Not this time
 *   on         who's picking it up ("I'll grab it"); the picker enters what it cost
 *   bought     everyone's share and how to pay the picker back; the picker sees who's paid
 * The picker buys it with their own money and gets paid back person to
 * person, like Split the bill. Leaf never holds the money.
 */

import { useState } from "react";
import { Check } from "lucide-react";
import { run, type CrewAddOn, type CrewAuth } from "@/lib/crew";
import { Button, Eyebrow, Mono } from "@/components/crew/CrewShell";
import { HandlesForm } from "@/components/crew/CrewMoneyCard";
import { track } from "@/lib/track";

const money = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
const first = (name?: string | null) => (name || "").split(/\s+/)[0] || "them";
const field = "h-11 w-full rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";

export default function CrewAddOnCard({
  addOn: a,
  auth,
  onChange,
}: {
  addOn: CrewAddOn;
  auth: CrewAuth;
  onChange: (next: CrewAddOn | null) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [needsHandles, setNeedsHandles] = useState(false);

  const call = async (key: string, name: string, params: Record<string, unknown> = {}) => {
    setBusy(key); setError("");
    try {
      const res = await run<{ addOn: CrewAddOn | null }>(name, auth, { cycleId: a.cycleId, ...params });
      onChange(res.addOn);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      if (/how you get paid/i.test(msg)) setNeedsHandles(true);
      setError(msg);
      return false;
    } finally { setBusy(null); }
  };
  const cents = Math.round(parseFloat(amount.replace(/[^0-9.]/g, "")) * 100) || 0;
  const errorLine = error && !needsHandles ? <p role="alert" className="m-0 text-sm text-fm-danger">{error}</p> : null;
  const shell = (children: React.ReactNode) => (
    <section className="flex flex-col gap-3 rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">{children}</section>
  );
  const heading = (
    <div className="flex items-start gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fm-card text-[22px]" aria-hidden>{a.emoji}</span>
      <div className="min-w-0">
        <Eyebrow>{a.upcoming ? "Before you go" : `From ${a.venue}`}</Eyebrow>
        <p className="m-0 mt-1 font-fm-serif text-[24px] leading-tight">{a.label}</p>
      </div>
    </div>
  );

  // ── Leaf's idea ──
  if (a.state === "suggested") {
    return shell(
      <>
        {heading}
        <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">
          {a.why}{a.estimate ? ` About ${money(a.estimate.totalCents)}, so ${money(a.estimate.eachCents)} each${a.going > 1 ? ` for ${a.going}` : ""}.` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button small disabled={busy !== null} onClick={() => { track("crew_addon_add", { key: a.key }); void call("add", "addCrewAddOn", { key: a.key }); }}>
            {busy === "add" ? "Adding…" : "Add it"}
          </Button>
          <Button small kind="ghost" disabled={busy !== null} onClick={() => { track("crew_addon_dismiss", { key: a.key }); void call("no", "dismissCrewAddOn"); }}>
            Not this time
          </Button>
        </div>
        {errorLine}
      </>,
    );
  }

  // ── Added: who's picking it up, and (for them) what it cost ──
  if (a.state === "on") {
    const picker = a.isPicker ? "You're" : `${first(a.picker?.name)}'s`;
    return shell(
      <>
        {heading}
        <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">
          {picker} picking it up{a.estimate ? `. About ${money(a.estimate.eachCents)} each` : ""}. Everyone going pays {a.isPicker ? "you" : first(a.picker?.name)} back after.
        </p>
        {a.isPicker ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-fm-canvas p-4">
            <label htmlFor={`addon-${a.cycleId}`} className="text-sm font-semibold">Bought it? What did it cost?</label>
            <div className="flex gap-2">
              <input id={`addon-${a.cycleId}`} className={`${field} max-w-[160px]`} placeholder="$0" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button small disabled={busy !== null || cents < 100} onClick={() => { track("crew_addon_bought", { key: a.key, cents }); void call("bought", "markCrewAddOnBought", { totalCents: cents }); }}>
                {busy === "bought" ? "Splitting…" : "Split it"}
              </Button>
            </div>
            {needsHandles && <HandlesForm auth={auth} onSaved={() => { setNeedsHandles(false); setError(""); void call("bought", "markCrewAddOnBought", { totalCents: cents }); }} />}
          </div>
        ) : (
          <button type="button" className="self-start text-sm font-semibold text-fm-ink-2 underline" disabled={busy !== null} onClick={() => call("grab", "setCrewAddOnPicker")}>
            {busy === "grab" ? "Saving…" : "I'll grab it instead"}
          </button>
        )}
        <button type="button" className="self-start text-xs text-fm-muted underline" disabled={busy !== null} onClick={() => call("no", "dismissCrewAddOn")}>Take it off</button>
        {errorLine}
      </>,
    );
  }

  // ── Bought: shares and paying back ──
  const picker = first(a.picker?.name);
  const people = a.people || [];
  const paidCount = people.filter((p) => p.paid).length;
  return shell(
    <>
      {heading}
      <p className="m-0 font-fm-serif text-[26px] leading-tight">
        {money(a.totalCents || 0)}
        <span className="ml-2 font-fm-sans text-sm text-fm-muted">{a.isPicker ? "you got it" : `${picker} got it`} · {money(a.eachCents || 0)} each</span>
      </p>

      {!a.isPicker && (a.myShareCents || 0) > 0 && (
        <div className="rounded-2xl bg-fm-canvas p-4">
          <p className="m-0 text-sm text-fm-ink-2">Your share</p>
          <p className="m-0 font-fm-serif text-[34px] leading-none">{money(a.myShareCents || 0)}</p>
          {a.myPaid ? (
            <p className="m-0 mt-2 flex items-center gap-1.5 text-sm text-fm-ink"><Check size={16} className="text-fm-accent" aria-hidden /> {a.myPaid.confirmed ? `${picker} got it` : `Marked paid · ${picker} will confirm`}</p>
          ) : (
            <>
              {(a.payOptions || []).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {a.payOptions!.map((o) => o.url ? (
                    <a key={o.method} href={o.url} target="_blank" rel="noreferrer" className="flex h-10 items-center rounded-full border border-fm-line px-4 text-sm font-semibold text-fm-ink hover:bg-fm-card">{o.label}</a>
                  ) : (
                    <span key={o.method} className="flex h-10 items-center rounded-full border border-fm-line px-4 text-sm text-fm-ink-2">{o.label}: {o.handle}</span>
                  ))}
                </div>
              ) : (
                <p className="m-0 mt-2 text-xs text-fm-muted">{picker} hasn&rsquo;t added how they get paid yet. Pay them however you usually do.</p>
              )}
              <div className="mt-3"><Button small disabled={busy !== null} onClick={() => call("paid", "markCrewAddOnPaid", { method: a.payOptions?.[0]?.method || null })}>{busy === "paid" ? "Saving…" : "I paid"}</Button></div>
            </>
          )}
        </div>
      )}

      {a.isPicker && (
        <div className="flex flex-col gap-2">
          {!a.pickerHasHandles && <HandlesForm auth={auth} onSaved={() => void call("refresh", "getCrewAddOn")} />}
          <Mono className="text-fm-muted">{paidCount} of {people.length} paid you back</Mono>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {people.map((p) => (
              <li key={p.userId} className="flex items-center gap-3 rounded-xl border border-fm-line-dim px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-fm-ink-2">{money(p.shareCents)}</span>
                {p.paid?.confirmed ? (
                  <span className="flex items-center gap-1 text-xs text-fm-accent"><Check size={14} aria-hidden /> Got it</span>
                ) : p.paid ? (
                  <button type="button" className="rounded-full bg-fm-ink px-3 py-1.5 text-xs font-semibold text-fm-canvas" disabled={busy !== null} onClick={() => call(`c${p.userId}`, "confirmCrewAddOnPaid", { userId: p.userId })}>Confirm</button>
                ) : (
                  <span className="text-xs text-fm-muted">Not yet</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {errorLine}
    </>,
  );
}
