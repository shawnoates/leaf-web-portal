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
import { eveningAt, run, type CrewAddOn, type CrewAuth } from "@/lib/crew";
import { Button, Eyebrow, Mono } from "@/components/crew/CrewShell";
import { HandlesForm } from "@/components/crew/CrewMoneyCard";
import { track } from "@/lib/track";

const money = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
const first = (name?: string | null) => (name || "").split(/\s+/)[0] || "them";
const field = "h-11 w-full rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";

/**
 * The item's claymation picture (public/friend-mode/addons/<key>.jpg), or its
 * emoji until that picture exists.
 */
function AddOnArt({ keyName, emoji, small = false }: { keyName: string; emoji: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const box = small ? "h-11 w-11 rounded-2xl text-[22px]" : "aspect-[4/3] w-full text-[56px]";
  return (
    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-fm-canvas ${box}`} aria-hidden>
      {failed ? emoji : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/friend-mode/addons/${keyName}.jpg`} alt="" className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          // It can fail before the page is interactive, when onError isn't listening yet.
          ref={(el) => { if (el?.complete && el.naturalWidth === 0) setFailed(true); }}
        />
      )}
    </span>
  );
}

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
  // Something else: the crew's own thing to split.
  const [custom, setCustom] = useState({ name: "", total: "" });

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
      <AddOnArt keyName={a.key} emoji={a.emoji} small />
      <div className="min-w-0">
        <Eyebrow>{a.upcoming ? "Before you go" : `From ${a.venue}`}</Eyebrow>
        <p className="m-0 mt-1 font-fm-serif text-[24px] leading-tight">{a.label}</p>
      </div>
    </div>
  );

  // ── Leaf's ideas: a carousel, best fit first ──
  if (a.state === "suggested") {
    const options = a.options?.length ? a.options : [{ key: a.key, label: a.label, emoji: a.emoji, why: a.why || "", estimate: a.estimate }];
    return (
      <section className="flex min-w-0 max-w-full flex-col gap-3 rounded-[28px] border border-fm-line-dim bg-fm-surface py-5 lg:py-7">
        <div className="flex items-baseline justify-between gap-3 px-5 lg:px-7">
          <div>
            <Eyebrow>Before you go</Eyebrow>
            <p className="m-0 mt-1 font-fm-serif text-[24px] leading-tight">Split something for the {eveningAt(a.startsAt) ? "night" : "day"}?</p>
          </div>
          <button type="button" className="shrink-0 text-xs text-fm-muted underline" disabled={busy !== null} onClick={() => { track("crew_addon_dismiss", { key: options[0].key }); void call("no", "dismissCrewAddOn"); }}>
            Not this time
          </button>
        </div>
        <ul className="m-0 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] lg:scroll-px-7 lg:px-7" aria-label="Things to split">
          {options.map((o) => (
            <li key={o.key} className="flex w-[78%] max-w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl bg-fm-card">
              <AddOnArt keyName={o.key} emoji={o.emoji} />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="m-0 text-[15px] font-semibold leading-snug text-fm-ink">{o.label}</p>
                {o.estimate && (
                  <p className="m-0 text-sm text-fm-ink-2">
                    About <b className="font-semibold text-fm-ink">{money(o.estimate.eachCents)} each</b>
                    <span className="text-fm-muted"> · {money(o.estimate.totalCents)} total</span>
                  </p>
                )}
                <p className="m-0 flex-1 text-xs leading-relaxed text-fm-muted">{o.why}</p>
                <Button small disabled={busy !== null} onClick={() => { track("crew_addon_add", { key: o.key }); void call(`add-${o.key}`, "addCrewAddOn", { key: o.key }); }}>
                  {busy === `add-${o.key}` ? "Adding…" : "Add it"}
                </Button>
              </div>
            </li>
          ))}
          <li className="flex w-[78%] max-w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl bg-fm-card">
            <AddOnArt keyName="custom" emoji="✨" />
            <form
              className="flex flex-1 flex-col gap-2 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const cents = Math.round(parseFloat(custom.total.replace(/[^0-9.]/g, "")) * 100) || null;
                track("crew_addon_add", { key: "custom" });
                void call("add-custom", "addCrewAddOn", { custom: { name: custom.name, cents } });
              }}
            >
              <p className="m-0 text-[15px] font-semibold leading-snug text-fm-ink">Something else</p>
              <p className="m-0 text-xs leading-relaxed text-fm-muted">Name it, and one person picks it up. Everyone chips in.</p>
              <input
                className="h-10 w-full rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none"
                placeholder="Flowers for Maya" maxLength={60} value={custom.name}
                onChange={(e) => setCustom({ ...custom, name: e.target.value })} aria-label="What you're splitting"
              />
              <input
                className="h-10 w-full rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none"
                placeholder="Rough total ($)" inputMode="decimal" value={custom.total}
                onChange={(e) => setCustom({ ...custom, total: e.target.value })} aria-label="Rough total, optional"
              />
              <div className="mt-auto">
                <Button small type="submit" disabled={busy !== null || custom.name.trim().length < 2}>
                  {busy === "add-custom" ? "Adding…" : "Add it"}
                </Button>
              </div>
            </form>
          </li>
        </ul>
        {error && <p role="alert" className="m-0 px-5 text-sm text-fm-danger lg:px-7">{error}</p>}
      </section>
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
