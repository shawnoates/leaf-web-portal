"use client";

/**
 * Money on the crew page, one card for both moments:
 *   - after a night: Split the bill. Upload the receipt (read on the server)
 *     or type a total, claim what's yours or split evenly, pay whoever paid.
 *   - before a set night: the host's cost (court, tickets, the Airbnb), a
 *     total to split or an amount each, paid to the host.
 * Same rows as the app's Split the Bill (Receipt), so both stay in sync.
 * Money goes person to person; Leaf keeps the tally and the "I paid".
 */

import { useState } from "react";
import { Camera, Check, ExternalLink, Receipt as ReceiptIcon } from "lucide-react";
import { run, type CrewAuth, type CrewSplit } from "@/lib/crew";
import { Button, Eyebrow, Mono } from "@/components/crew/CrewShell";

const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "")}`;
const field = "h-11 w-full rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";
const chip = (on: boolean) =>
  `flex h-10 items-center rounded-full border px-3.5 text-[13px] font-semibold transition ${on ? "border-fm-accent bg-fm-accent text-fm-canvas" : "border-fm-line text-fm-ink hover:bg-fm-card"}`;

/** Phone photos are big: shrink to 1600px JPEG before upload. */
async function photoToBase64(file: File): Promise<{ b64: string; type: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return { b64: c.toDataURL("image/jpeg", 0.85).split(",")[1], type: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function HandlesForm({ auth, onSaved }: { auth: CrewAuth; onSaved: () => void }) {
  const [h, setH] = useState({ venmo: "", cashapp: "", paypal: "", zelle: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true); setError("");
    try {
      await run("setCrewPayHandles", auth, { handles: h });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-fm-line-dim bg-fm-canvas p-4">
      <p className="m-0 text-sm font-semibold">How do you get paid?</p>
      <p className="m-0 text-xs text-fm-muted">Fill in any you use. People pay you directly; Leaf never holds the money.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={field} placeholder="Venmo @username" value={h.venmo} onChange={(e) => setH({ ...h, venmo: e.target.value })} aria-label="Venmo username" />
        <input className={field} placeholder="Cash App $cashtag" value={h.cashapp} onChange={(e) => setH({ ...h, cashapp: e.target.value })} aria-label="Cash App cashtag" />
        <input className={field} placeholder="PayPal.me name" value={h.paypal} onChange={(e) => setH({ ...h, paypal: e.target.value })} aria-label="PayPal.me name" />
        <input className={field} placeholder="Zelle email or phone" value={h.zelle} onChange={(e) => setH({ ...h, zelle: e.target.value })} aria-label="Zelle email or phone" />
      </div>
      {error && <p role="alert" className="m-0 text-sm text-fm-danger">{error}</p>}
      <div><Button small onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></div>
    </div>
  );
}

export default function CrewMoneyCard({
  split,
  auth,
  onChange,
  kind,
}: {
  split: CrewSplit;
  auth: CrewAuth;
  onChange: (next: CrewSplit | null) => void;
  /** "after": split the bill. "cost": a set night's cost, shown on its card. */
  kind: "after" | "cost";
}) {
  const r = split.receipt;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);
  const [total, setTotal] = useState("");
  const [costOpen, setCostOpen] = useState(false);
  const [cost, setCost] = useState({ label: "", amount: "", mode: "total" as "total" | "each" });
  const [needsHandles, setNeedsHandles] = useState(false);

  const call = async (key: string, name: string, params: Record<string, unknown> = {}) => {
    setBusy(key); setError("");
    try {
      const res = await run<{ split: CrewSplit | null }>(name, auth, { cycleId: split.cycleId, ...params });
      onChange(res.split);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      if (/how you get paid/i.test(msg)) setNeedsHandles(true);
      setError(msg);
      return false;
    } finally { setBusy(null); }
  };

  const upload = async (file: File) => {
    setBusy("upload"); setError("");
    try {
      const { b64, type } = await photoToBase64(file);
      const res = await run<{ split: CrewSplit | null }>("uploadCrewReceipt", auth, { cycleId: split.cycleId, imageBase64: b64, mimeType: type });
      onChange(res.split);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that receipt.");
      setTyping(true);
    } finally { setBusy(null); }
  };

  const cents = (v: string) => Math.round(parseFloat(v.replace(/[^0-9.]/g, "")) * 100) || 0;

  // ── Before a night, nothing set: the host can add a cost ──
  if (kind === "cost" && !r) {
    if (!split.canAddCost) return null;
    if (!costOpen) {
      return (
        <button type="button" onClick={() => setCostOpen(true)} className="flex items-center gap-2 px-1 text-sm font-semibold text-fm-ink-2 hover:text-fm-ink">
          <ReceiptIcon size={16} aria-hidden /> Splitting a cost for this night? Collect it here
        </button>
      );
    }
    return (
      <section className="rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">
        {(
          <div className="flex flex-col gap-3">
            <Eyebrow>Collect a cost</Eyebrow>
            <input className={field} placeholder="What for (court, tickets…)" value={cost.label} onChange={(e) => setCost({ ...cost, label: e.target.value })} aria-label="What the cost is for" maxLength={40} />
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${field} max-w-[140px]`} placeholder="$0" inputMode="decimal" value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} aria-label="Amount" />
              <button type="button" className={chip(cost.mode === "total")} onClick={() => setCost({ ...cost, mode: "total" })} aria-pressed={cost.mode === "total"}>Total, split it</button>
              <button type="button" className={chip(cost.mode === "each")} onClick={() => setCost({ ...cost, mode: "each" })} aria-pressed={cost.mode === "each"}>Each person</button>
            </div>
            {needsHandles && <HandlesForm auth={auth} onSaved={() => { setNeedsHandles(false); setError(""); }} />}
            {error && !needsHandles && <p role="alert" className="m-0 text-sm text-fm-danger">{error}</p>}
            <div className="flex gap-2">
              <Button small disabled={busy !== null || cents(cost.amount) < 100} onClick={() => call("cost", "setCrewNightCost", { cost: { cents: cents(cost.amount), mode: cost.mode, label: cost.label } })}>
                {busy === "cost" ? "Saving…" : "Collect it"}
              </Button>
              <Button small kind="ghost" onClick={() => { setCostOpen(false); setError(""); }}>Cancel</Button>
            </div>
          </div>
        )}
      </section>
    );
  }

  // ── After a night, no receipt yet ──
  if (!r) {
    if (!split.went) return null;
    return (
      <section className="rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">
        <Eyebrow>Split the bill</Eyebrow>
        <h3 className="m-0 mt-2 font-fm-serif text-[28px] font-normal leading-tight">How was {split.venue}?</h3>
        <p className="m-0 mt-2 text-[15px] text-fm-ink-2">Snap the receipt and Leaf works out who owes what, tax and tip included.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-fm-ink px-4 py-2.5 text-sm font-semibold text-fm-canvas">
            <Camera size={16} aria-hidden /> {busy === "upload" ? "Reading it…" : "Upload the receipt"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </label>
          <Button small kind="ghost" onClick={() => setTyping(true)}>Type the total</Button>
        </div>
        {typing && (
          <div className="mt-3 flex gap-2">
            <input className={`${field} max-w-[160px]`} placeholder="$0" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} aria-label="Bill total" />
            <Button small disabled={busy !== null || cents(total) < 100} onClick={() => call("total", "uploadCrewReceipt", { totalCents: cents(total) })}>{busy === "total" ? "Splitting…" : "Split it evenly"}</Button>
          </div>
        )}
        {error && <p role="alert" className="m-0 mt-3 text-sm text-fm-danger">{error}</p>}
      </section>
    );
  }

  // ── There's a bill ──
  const isCost = Boolean(r.cost);
  const payer = r.payer?.name.split(" ")[0] || "them";
  const paidCount = r.people.filter((p) => p.paid).length;
  const owing = r.people.filter((p) => p.share > 0);
  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Eyebrow>{isCost ? (r.cost?.label || "Cost") : "Split the bill"}</Eyebrow>
          <p className="m-0 mt-1 font-fm-serif text-[26px] leading-tight">
            {isCost && r.cost?.mode === "each" ? `${money(r.cost.cents / 100)} each` : money(r.total)}
            <span className="ml-2 font-fm-sans text-sm text-fm-muted">{r.isPayer ? "you paid" : `${payer} paid`}</span>
          </p>
        </div>
        {r.photo && <a href={r.photo} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-fm-muted underline">Receipt <ExternalLink size={12} aria-hidden /></a>}
      </div>

      {!isCost && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Mono className="text-fm-muted">Tap what you had</Mono>
            <button type="button" className="text-xs font-semibold text-fm-ink-2 underline" disabled={busy !== null} onClick={() => call("even", "claimSplitItems", { evenly: true })}>Split it all evenly</button>
          </div>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {r.items.map((it) => (
              <li key={it.index}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => call(`i${it.index}`, "claimSplitItems", { index: it.index, on: !it.mine })}
                  aria-pressed={it.mine}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${it.mine ? "border-fm-accent bg-fm-card" : "border-fm-line-dim hover:bg-fm-card"}`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${it.mine ? "border-fm-accent bg-fm-accent text-fm-canvas" : "border-fm-line"}`}>{it.mine && <Check size={13} aria-hidden />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fm-ink">{it.quantity > 1 ? `${it.quantity}× ` : ""}{it.name}</span>
                    {it.people.length > 0 && <span className="block truncate text-xs text-fm-muted">{it.people.map((n) => n.split(" ")[0]).join(", ")}</span>}
                  </span>
                  <span className="shrink-0 text-fm-ink-2">{money(it.totalPrice)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="m-0 text-xs text-fm-muted">
            Tax {money(r.tax)} · Tip {money(r.tip)}{r.unclaimed > 0 ? ` · ${money(r.unclaimed)} not claimed yet` : ""}
          </p>
          {r.canEdit && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Mono className="mr-1 text-fm-muted">Tip</Mono>
              {r.tipRates.map((rate, i) => (
                <button key={rate} type="button" className={chip(r.tipIndex === i)} disabled={busy !== null} onClick={() => call("tip", "setSplitTip", { tipIndex: i })} aria-pressed={r.tipIndex === i}>
                  {Math.round(rate * 100)}%
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My part */}
      {!r.isPayer && (
        <div className="rounded-2xl bg-fm-canvas p-4">
          <p className="m-0 text-sm text-fm-ink-2">Your share</p>
          <p className="m-0 font-fm-serif text-[34px] leading-none">{money(r.myShare)}</p>
          {r.myPaid ? (
            <p className="m-0 mt-2 flex items-center gap-1.5 text-sm text-fm-ink"><Check size={16} className="text-fm-accent" aria-hidden /> {r.myPaid.confirmed ? `${payer} got it` : `Marked paid · ${payer} will confirm`}</p>
          ) : r.myShare > 0 ? (
            <>
              {r.payOptions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.payOptions.map((o) => o.url ? (
                    <a key={o.method} href={o.url} target="_blank" rel="noreferrer" className="flex h-10 items-center rounded-full border border-fm-line px-4 text-sm font-semibold text-fm-ink hover:bg-fm-card">{o.label}</a>
                  ) : (
                    <span key={o.method} className="flex h-10 items-center rounded-full border border-fm-line px-4 text-sm text-fm-ink-2">{o.label}: {o.handle}</span>
                  ))}
                </div>
              ) : (
                <p className="m-0 mt-2 text-xs text-fm-muted">{payer} hasn&rsquo;t added how they get paid yet. Pay them however you usually do.</p>
              )}
              <div className="mt-3"><Button small disabled={busy !== null} onClick={() => call("paid", "markSplitPaid", { method: r.payOptions[0]?.method || null })}>{busy === "paid" ? "Saving…" : "I paid"}</Button></div>
            </>
          ) : (
            <p className="m-0 mt-2 text-xs text-fm-muted">Tap what you had above.</p>
          )}
        </div>
      )}

      {/* Whoever paid: who owes, who's paid */}
      {r.isPayer && (
        <div className="flex flex-col gap-2">
          {!r.payerHasHandles && <HandlesForm auth={auth} onSaved={() => void call("refresh", "getCrewSplit")} />}
          <Mono className="text-fm-muted">{paidCount} of {owing.length} paid</Mono>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {owing.map((p) => (
              <li key={p.userId} className="flex items-center gap-3 rounded-xl border border-fm-line-dim px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-fm-ink-2">{money(p.share)}</span>
                {p.paid?.confirmed ? (
                  <span className="flex items-center gap-1 text-xs text-fm-accent"><Check size={14} aria-hidden /> Got it</span>
                ) : p.paid ? (
                  <button type="button" className="rounded-full bg-fm-ink px-3 py-1.5 text-xs font-semibold text-fm-canvas" disabled={busy !== null} onClick={() => call(`c${p.userId}`, "confirmSplitPaid", { userId: p.userId })}>Confirm</button>
                ) : (
                  <span className="text-xs text-fm-muted">Not yet</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!r.isPayer && !isCost && (
        <button type="button" className="self-start text-xs text-fm-muted underline" disabled={busy !== null} onClick={() => call("payer", "setSplitPayer")}>I paid the bill, not {payer}</button>
      )}
      {error && <p role="alert" className="m-0 text-sm text-fm-danger">{error}</p>}
    </div>
  );

  return <section className="rounded-[28px] border border-fm-line-dim bg-fm-surface p-5 lg:p-7">{body}</section>;
}
