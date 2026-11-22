"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Parse from "@/lib/parse-client";
import { openPayApp } from "@/lib/p2p";
import type { PayOption } from "@/lib/crew";
import { photoToBase64 } from "@/components/crew/CrewMoneyCard";
import PayHandlesForm, { handleLines, type PayHandles } from "@/components/p2p/PayHandlesForm";

type Paid = { at: string; method: string | null; confirmed: boolean };
type Via = "push" | "sms" | "quiet" | "unreachable" | "recent" | "paid" | "nothing";
type Person = { userId: string; name: string; share: number; paid: Paid | null; requested: { at: string; via: Via } | null };

/** A plan's bill for one person (server: billView in cloud/plan-bill.js). Dollars, not cents. */
type Bill = {
  planId: string;
  title: string;
  startsAt: string | null;
  me: { userId: string; name: string };
  seats: { userId: string; name: string }[];
  tipRates: number[];
  canStart?: boolean;
  receipt: null | {
    receiptId: string;
    photo: string | null;
    itemized: boolean;
    items: { index: number; name: string; quantity: number; totalPrice: number; mine: boolean; userIds: string[]; people: string[] }[];
    subtotal: number;
    tax: number;
    tip: number;
    total: number;
    unclaimed: number;
    tipIndex: number;
    customTip: boolean;
    payer: { userId: string; name: string } | null;
    isPayer: boolean;
    canEdit: boolean;
    myShare: number;
    myPaid: Paid | null;
    payOptions: PayOption[];
    payerHasHandles: boolean;
    myHandles: PayHandles | null;
    people: Person[];
  };
};

type Result = { userId: string; name: string; via: Via };

const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "")}`;
const cents = (v: string) => Math.round(parseFloat(v.replace(/[^0-9.]/g, "")) * 100) || 0;
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

async function copy(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Apple Cash is sent in Messages: only offer it where Messages exists. */
function useAppleDevice() {
  return useSyncExternalStore(
    () => () => {},
    () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent),
    () => true,
  );
}

/** What sending did, in a sentence the payer can act on. */
function sentSummary(results: Result[]): string {
  const n = (v: Via) => results.filter((r) => r.via === v).length;
  const sent = n("push") + n("sms");
  const parts: string[] = [];
  if (sent) parts.push(`Asked ${sent} ${sent === 1 ? "person" : "people"}.`);
  if (n("quiet")) parts.push(`${n("quiet")} get a text, and it's too late to text now. Send again after 8 AM ET.`);
  if (n("unreachable")) parts.push(`Couldn't reach ${results.filter((r) => r.via === "unreachable").map((r) => first(r.name)).join(", ")}: no app and no number for texts.`);
  if (n("recent")) parts.push(`${n("recent")} were asked in the last hour.`);
  if (n("nothing")) parts.push(`${n("nothing")} owe nothing yet.`);
  return parts.join(" ") || "Nobody left to ask.";
}

const METHOD_LABELS: Record<string, string> = { venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", zelle: "Zelle", applecash: "Apple Cash" };

function requestedLine(p: Person): string {
  if (p.paid?.confirmed) return "Paid";
  if (p.paid) return `Says they paid${p.paid.method && METHOD_LABELS[p.paid.method] ? ` on ${METHOD_LABELS[p.paid.method]}` : ""}`;
  if (p.requested) return `Asked by ${p.requested.via === "push" ? "notification" : "text"}`;
  return p.share > 0 ? "Not asked yet" : "Nothing picked yet";
}

export default function BillClient({ notificationId, token }: { notificationId: string; token: string | null }) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const apple = useAppleDevice();

  // Setup (no bill yet)
  const [total, setTotal] = useState("");
  const [tip, setTip] = useState("");
  const [left, setLeft] = useState<string[]>([]); // people left out of an even split
  // A bill
  const [pickFor, setPickFor] = useState<string | null>(null); // payer picking for someone
  const [customTip, setCustomTip] = useState("");
  const [method, setMethod] = useState<string | null>(null);
  const [zelleOpen, setZelleOpen] = useState(false);
  const [editHandles, setEditHandles] = useState(false);
  const [skip, setSkip] = useState<string[]>([]); // people the payer isn't asking

  const run = useCallback(async <T extends { bill: Bill }>(key: string, name: string, params: Record<string, unknown> = {}): Promise<T | null> => {
    setBusy(key);
    setError(null);
    try {
      const r = (await Parse.Cloud.run(name, { notificationId, ...(token ? { token } : {}), ...params })) as T;
      setBill(r.bill);
      return r;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }, [notificationId, token]);

  useEffect(() => {
    (async () => {
      try {
        const r = (await Parse.Cloud.run("getPlanBill", { notificationId, ...(token ? { token } : {}) })) as { bill: Bill };
        setBill(r.bill);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "We couldn't load this bill.");
      }
    })();
  }, [notificationId, token]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const upload = async (file: File) => {
    setBusy("upload");
    setError(null);
    try {
      const { b64, type } = await photoToBase64(file);
      const r = (await Parse.Cloud.run("startPlanBill", { notificationId, ...(token ? { token } : {}), imageBase64: b64, mimeType: type })) as { bill: Bill };
      setBill(r.bill);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that receipt. Type the total instead.");
    } finally {
      setBusy(null);
    }
  };

  const r = bill?.receipt ?? null;
  let body: React.ReactNode;

  if (loadError) {
    body = <div className="bl-card"><p>{loadError}</p></div>;
  } else if (!bill) {
    body = <div className="bl-card"><p className="bl-muted">Loading…</p></div>;
  } else if (!r) {
    // ── No bill yet: whoever paid puts it in ──
    const inSplit = bill.seats.filter((s) => !left.includes(s.userId));
    const each = inSplit.length ? (cents(total) + cents(tip)) / 100 / inSplit.length : 0;
    body = !bill.canStart ? (
      <div className="bl-card"><p>No bill to split yet. Once the plan has started, whoever paid can add it here.</p></div>
    ) : (
      <>
        <div className="bl-card">
          <p className="bl-h">Did you pay the bill?</p>
          <p className="bl-muted">Add it and Leaf works out who owes what. Everyone pays you back directly.</p>
          <label className="bl-btn primary wide bl-file">
            {busy === "upload" ? "Reading the receipt…" : "Upload the receipt"}
            <input type="file" accept="image/*" disabled={busy !== null} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </label>
          <p className="bl-muted bl-small">With a receipt, each person picks what they had (or you pick for them).</p>
        </div>
        <div className="bl-card">
          <p className="bl-h">Or split a total evenly</p>
          <div className="bl-fields">
            <label><span>Bill total</span><input inputMode="decimal" placeholder="$0" value={total} onChange={(e) => setTotal(e.target.value)} /></label>
            <label><span>Tip on top (optional)</span><input inputMode="decimal" placeholder="$0" value={tip} onChange={(e) => setTip(e.target.value)} /></label>
          </div>
          <p className="bl-label">Between</p>
          <div className="bl-chips">
            {bill.seats.map((s) => {
              const on = !left.includes(s.userId);
              return (
                <button key={s.userId} type="button" className={`bl-chip${on ? " on" : ""}`} aria-pressed={on}
                  onClick={() => setLeft((p) => (on ? [...p, s.userId] : p.filter((id) => id !== s.userId)))}>
                  {s.userId === bill.me.userId ? "You" : first(s.name)}
                </button>
              );
            })}
          </div>
          <button type="button" className="bl-btn primary wide" disabled={busy !== null || cents(total) < 100 || inSplit.length < 1}
            onClick={() => void run("start", "startPlanBill", { totalCents: cents(total), tipCents: cents(tip), userIds: inSplit.map((s) => s.userId) })}>
            {busy === "start" ? "Splitting…" : each > 0 ? `Split it: ${money(each)} each` : "Split it evenly"}
          </button>
        </div>
      </>
    );
  } else {
    const payer = r.payer ? first(r.payer.name) : "them";
    const owing = r.people.filter((p) => p.share > 0);
    const paidCount = owing.filter((p) => p.paid).length;
    const anyPaid = r.people.some((p) => p.paid);
    const who = pickFor || bill.me.userId;
    const options = r.payOptions.filter((o) => apple || o.method !== "applecash");
    const zelle = options.find((o) => o.method === "zelle");
    const hint = options.find((o) => o.method === method)?.hint;
    const toAsk = r.people.filter((p) => !p.paid && !skip.includes(p.userId) && (p.share > 0 || r.unclaimed > 0));

    body = (
      <>
        <div className="bl-card">
          <div className="bl-top">
            <div>
              <p className="bl-big">{money(r.total)}</p>
              <p className="bl-muted">{r.isPayer ? "You paid" : `${payer} paid`} · tax {money(r.tax)} · tip {money(r.tip)}</p>
            </div>
            {r.photo && <a className="bl-link" href={r.photo} target="_blank" rel="noreferrer">Receipt</a>}
          </div>

          {r.itemized && (
            <>
              <div className="bl-row">
                <p className="bl-label">{who === bill.me.userId ? "Tap what you had" : `Tap what ${first(bill.seats.find((s) => s.userId === who)?.name || "they")} had`}</p>
                {r.canEdit && (
                  <select className="bl-select" value={who} onChange={(e) => setPickFor(e.target.value === bill.me.userId ? null : e.target.value)} aria-label="Who you're picking for">
                    {bill.seats.map((s) => <option key={s.userId} value={s.userId}>{s.userId === bill.me.userId ? "Picking for me" : `Picking for ${first(s.name)}`}</option>)}
                  </select>
                )}
              </div>
              <ul className="bl-items">
                {r.items.map((it) => {
                  const on = it.userIds.includes(who);
                  return (
                    <li key={it.index}>
                      <button type="button" disabled={busy !== null} aria-pressed={on} className={on ? "on" : ""}
                        onClick={() => void run(`i${it.index}`, "claimPlanBillItems", { index: it.index, on: !on, ...(who !== bill.me.userId ? { forUserId: who } : {}) })}>
                        <span className="bl-check" aria-hidden="true">{on ? "✓" : ""}</span>
                        <span className="bl-item">
                          <span>{it.quantity > 1 ? `${it.quantity}× ` : ""}{it.name}</span>
                          {it.people.length > 0 && <small>{it.people.map(first).join(", ")}</small>}
                        </span>
                        <span className="bl-price">{money(it.totalPrice)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {r.unclaimed > 0 && <p className="bl-muted bl-small">{money(r.unclaimed)} not picked yet.</p>}
            </>
          )}

          {r.canEdit && (
            <div className="bl-tools">
              <div className="bl-chips">
                <span className="bl-label">Tip</span>
                {bill.tipRates.map((rate, i) => (
                  <button key={rate} type="button" className={`bl-chip${!r.customTip && r.tipIndex === i ? " on" : ""}`} disabled={busy !== null}
                    aria-pressed={!r.customTip && r.tipIndex === i} onClick={() => void run("tip", "setPlanBillTip", { tipIndex: i })}>
                    {Math.round(rate * 100)}%
                  </button>
                ))}
                <span className={`bl-tipbox${r.customTip ? " on" : ""}`}>
                  <input inputMode="decimal" placeholder={r.customTip ? money(r.tip) : "$ amount"} value={customTip} onChange={(e) => setCustomTip(e.target.value)} aria-label="Tip amount in dollars" />
                  <button type="button" disabled={busy !== null || !customTip.trim()} onClick={async () => { if (await run("tip", "setPlanBillTip", { tipCents: cents(customTip) })) setCustomTip(""); }}>Set</button>
                </span>
              </div>
              {r.itemized && (
                <button type="button" className="bl-link" disabled={busy !== null} onClick={() => void run("even", "claimPlanBillItems", { evenly: true })}>
                  Split it all evenly instead
                </button>
              )}
            </div>
          )}
        </div>

        {/* What I owe, and how to pay it */}
        {!r.isPayer && (
          <div className="bl-card">
            <p className="bl-label">Your share</p>
            <p className="bl-big">{money(r.myShare)}</p>
            {r.myPaid ? (
              <>
                <p className="bl-ok">✓ {r.myPaid.confirmed ? `${payer} got it. You're settled.` : `Marked paid. ${payer} will confirm.`}</p>
                {!r.myPaid.confirmed && <button type="button" className="bl-link" disabled={busy !== null} onClick={() => void run("unpaid", "markPlanBillPaid", { paid: false })}>I haven&apos;t paid yet</button>}
              </>
            ) : r.myShare > 0 ? (
              <>
                {options.length > 0 ? (
                  <>
                    <p className="bl-muted">Pay {payer} back with:</p>
                    <div className="bl-opts">
                      {options.filter((o) => o.url).map((o) => (
                        <a key={o.method} className={`bl-opt${method === o.method ? " on" : ""}`} href={o.url!}
                          target={o.method === "applecash" ? undefined : "_blank"} rel="noopener noreferrer"
                          onClick={(e) => { setMethod(o.method); setZelleOpen(false); openPayApp(e, o); }}>
                          <b>{o.label}</b><span>{o.handle}</span>
                        </a>
                      ))}
                      {zelle && (
                        <button type="button" className={`bl-opt${zelleOpen ? " on" : ""}`} aria-expanded={zelleOpen} onClick={() => { setZelleOpen((v) => !v); setMethod("zelle"); }}>
                          <b>Zelle</b><span>{zelle.handle}</span>
                        </button>
                      )}
                    </div>
                    {zelle && zelleOpen && (
                      <div className="bl-zelle">
                        <p>Zelle has no link. Send it from your bank&apos;s app:</p>
                        {[["To", zelle.handle], ["Amount", money(r.myShare)]].map(([k, v]) => (
                          <button key={k} type="button" onClick={async () => { if (await copy(v)) setToast(`${k} copied`); }}>
                            <span>{k}</span><b>{v}</b><i>Copy</i>
                          </button>
                        ))}
                        {zelle.recipientName && <p>Your bank should show <b>{zelle.recipientName}</b> before you send. If it shows anyone else, stop.</p>}
                      </div>
                    )}
                    {hint && <p className="bl-muted bl-small">{hint}</p>}
                  </>
                ) : (
                  <p className="bl-muted">{payer} hasn&apos;t added how they get paid yet. Pay them however you usually do.</p>
                )}
                <button type="button" className="bl-btn primary wide" disabled={busy !== null} onClick={() => void run("paid", "markPlanBillPaid", { method })}>
                  {busy === "paid" ? "Saving…" : "I paid"}
                </button>
              </>
            ) : (
              <p className="bl-muted">{r.itemized ? "Tap what you had above to see your share." : `${payer} didn't put you on this bill.`}</p>
            )}
          </div>
        )}

        {/* Whoever paid: how they get paid, who owes, ask them */}
        {r.isPayer && (
          <>
            <div className="bl-card">
              <p className="bl-h">How you get paid back</p>
              {r.payerHasHandles && !editHandles ? (
                <>
                  {/* In full, so details meant for another plan are caught before anyone is asked. */}
                  <dl className="bl-handles">
                    {handleLines(r.myHandles).map((l) => (
                      <div key={l.label}><dt>{l.label}</dt><dd>{l.value}</dd></div>
                    ))}
                  </dl>
                  <div className="bl-row">
                    <p className="bl-muted bl-small">Check these are yours. They&apos;re for this bill only.</p>
                    <button type="button" className="bl-link" onClick={() => setEditHandles(true)}>Change</button>
                  </div>
                </>
              ) : (
                <PayHandlesForm
                  initial={r.myHandles}
                  onSaved={() => {}}
                  onCancel={r.payerHasHandles ? () => setEditHandles(false) : undefined}
                  onSubmit={async (handles) => { if (await run("handles", "setPlanBillHandles", { handles })) setEditHandles(false); }}
                />
              )}
            </div>
            <div className="bl-card">
              <div className="bl-row">
                <p className="bl-h">{paidCount} of {owing.length} paid</p>
                {!anyPaid && <button type="button" className="bl-link" disabled={busy !== null} onClick={() => { if (window.confirm("Remove this bill and start over?")) void run("remove", "removePlanBill"); }}>Start over</button>}
              </div>
              <ul className="bl-people">
                {r.people.map((p) => {
                  const asking = toAsk.some((x) => x.userId === p.userId);
                  return (
                    <li key={p.userId}>
                      {!p.paid && (p.share > 0 || r.unclaimed > 0) ? (
                        <input type="checkbox" checked={asking} aria-label={`Ask ${p.name}`}
                          onChange={() => setSkip((s) => (asking ? [...s, p.userId] : s.filter((id) => id !== p.userId)))} />
                      ) : <span className="bl-nobox" />}
                      <span className="bl-who"><span>{p.name}</span><small className={p.paid?.confirmed ? "ok" : p.paid ? "warn" : ""}>{requestedLine(p)}</small></span>
                      <span className="bl-price">{money(p.share)}</span>
                      {p.paid?.confirmed ? (
                        <button type="button" className="bl-link" disabled={busy !== null} onClick={() => void run(`c${p.userId}`, "confirmPlanBillPaid", { userId: p.userId, confirmed: false })}>Undo</button>
                      ) : p.share > 0 ? (
                        <button type="button" className={`bl-btn sm ${p.paid ? "primary" : "ghost"}`} disabled={busy !== null} onClick={() => void run(`c${p.userId}`, "confirmPlanBillPaid", { userId: p.userId })}>
                          {p.paid ? "Confirm" : "Mark paid"}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="bl-btn primary wide" disabled={busy !== null || toAsk.length === 0 || !r.payerHasHandles}
                onClick={async () => {
                  const res = await run<{ bill: Bill; results: Result[] }>("send", "sendPlanBillRequests", { userIds: toAsk.map((p) => p.userId) });
                  if (res) setToast(sentSummary(res.results));
                }}>
                {busy === "send" ? "Sending…" : toAsk.length ? `Send ${toAsk.length} ${toAsk.length === 1 ? "request" : "requests"}` : "Nobody left to ask"}
              </button>
              <p className="bl-muted bl-small">
                {r.payerHasHandles
                  ? "People with the app get a notification, everyone else a text. Each opens their own page with what they owe and how to pay you."
                  : "Add how you get paid back first."}
              </p>
            </div>
          </>
        )}

        {!r.isPayer && !anyPaid && (
          <button type="button" className="bl-link bl-center" disabled={busy !== null}
            onClick={() => { if (window.confirm(`Everyone will pay you back instead of ${payer}. Continue?`)) void run("payer", "setPlanBillPayer"); }}>
            I paid the bill, not {payer}
          </button>
        )}
      </>
    );
  }

  return (
    <main className="bl">
      <style>{CSS}</style>
      <div className="bl-in">
        <p className="bl-eyebrow">Split the bill</p>
        <h1 className="bl-title">{bill?.title || "Your plan"}</h1>
        {bill?.startsAt && <p className="bl-muted">{new Date(bill.startsAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>}
        {error && <p className="bl-err" role="alert">{error}</p>}
        {toast && <p className="bl-toast" role="status">{toast}</p>}
        <div className="bl-body">{body}</div>
        <p className="bl-foot">Money goes person to person. Leaf never touches it; it just keeps track.</p>
      </div>
    </main>
  );
}

const CSS = `
.bl{min-height:100vh;background:#faf9f7;color:#17150f;font-family:var(--font-geist-sans,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);-webkit-font-smoothing:antialiased}
.bl-in{max-width:560px;margin:0 auto;padding:32px 16px 48px}
.bl p{margin:0}
.bl-eyebrow,.bl-label{font-family:var(--font-geist-mono,ui-monospace,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8b8578}
.bl-title{font-size:26px;line-height:1.2;font-weight:500;margin:6px 0 2px;overflow-wrap:anywhere}
.bl-muted{color:#6f6a5f;font-size:13px;line-height:1.45}
.bl-small{font-size:12px}
.bl-body{display:grid;gap:14px;margin-top:20px}
.bl-card{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:14px;padding:16px;display:grid;gap:10px;min-width:0}
.bl-h{font-size:16px;font-weight:600}
.bl-big{font-size:32px;font-weight:600;line-height:1.1;font-variant-numeric:tabular-nums}
.bl-top,.bl-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.bl-top{align-items:flex-start}
.bl-link{border:0;background:none;color:#6f6a5f;font:inherit;font-size:12.5px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;padding:6px 0}
.bl-link:disabled{opacity:.5;cursor:default}
.bl-center{justify-self:center}
.bl-select{font:inherit;font-size:13px;border:1px solid rgba(0,0,0,.18);border-radius:8px;padding:7px 9px;background:#fff;color:#17150f;max-width:100%}
.bl-items,.bl-people{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.bl-items button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;font:inherit;font-size:14px;color:#17150f;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:10px;padding:10px 12px;cursor:pointer;min-height:44px}
.bl-items button.on{border-color:#253a33;background:#f3f7f5}
.bl-items button:disabled{cursor:default}
.bl-check{width:20px;height:20px;border-radius:999px;border:1px solid rgba(0,0,0,.25);display:grid;place-items:center;flex:none;font-size:12px}
.bl-items button.on .bl-check{background:#253a33;border-color:#253a33;color:#fff}
.bl-item,.bl-who{flex:1;min-width:0;display:grid}
.bl-item span,.bl-who span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bl-item small,.bl-who small{color:#8b8578;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bl-who small.ok{color:#253a33}
.bl-who small.warn{color:#9a3412}
.bl-price{flex:none;font-variant-numeric:tabular-nums;color:#3d3a33}
.bl-tools{display:grid;gap:4px;border-top:1px solid rgba(0,0,0,.07);padding-top:10px}
.bl-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.bl-chip{font:inherit;font-size:13px;font-weight:600;border:1px solid rgba(0,0,0,.18);border-radius:999px;padding:8px 13px;background:#fff;color:#17150f;cursor:pointer;min-height:36px}
.bl-chip.on{background:#17150f;border-color:#17150f;color:#fff}
.bl-chip:disabled{cursor:default;opacity:.6}
.bl-tipbox{display:inline-flex;border:1px solid rgba(0,0,0,.18);border-radius:999px;overflow:hidden;background:#fff}
.bl-tipbox.on{border-color:#17150f}
.bl-tipbox input{border:0;outline:none;font:inherit;font-size:13px;padding:8px 4px 8px 12px;width:96px;background:transparent;color:#17150f}
.bl-tipbox button{border:0;background:none;font:inherit;font-size:12.5px;font-weight:600;padding:0 12px 0 6px;cursor:pointer;color:#17150f}
.bl-tipbox button:disabled{opacity:.4;cursor:default}
.bl-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.bl-fields label{display:grid;gap:4px;min-width:0}
.bl-fields span{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#8b8578}
.bl-fields input{border:1px solid rgba(0,0,0,.15);border-radius:8px;padding:10px 11px;font:inherit;font-size:16px;color:#17150f;background:#fff;min-width:0;width:100%}
.bl-fields input:focus{outline:none;border-color:#17150f}
.bl-btn{border-radius:10px;padding:12px 16px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;border:1px solid #17150f;text-align:center}
.bl-btn.primary{background:#17150f;color:#fff}
.bl-btn.ghost{background:#fff;color:#17150f;border-color:rgba(0,0,0,.18)}
.bl-btn.sm{padding:7px 12px;font-size:12px;border-radius:8px;flex:none}
.bl-btn.wide{width:100%}
.bl-btn:disabled{opacity:.5;cursor:default}
.bl-file{display:block;position:relative;box-sizing:border-box}
.bl-file input{position:absolute;inset:0;opacity:0;cursor:pointer}
.bl-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.bl-opt{display:grid;gap:2px;text-align:left;text-decoration:none;font:inherit;color:#17150f;background:#fff;border:1px solid rgba(0,0,0,.18);border-radius:10px;padding:10px 12px;cursor:pointer;min-width:0}
.bl-opt.on{border-color:#17150f;box-shadow:inset 0 0 0 1px #17150f}
.bl-opt b{font-size:14px;font-weight:600}
.bl-opt span{font-size:12px;color:#6f6a5f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bl-zelle{display:grid;gap:6px;background:#f6f4ef;border-radius:10px;padding:12px;font-size:13px}
.bl-zelle button{display:flex;gap:10px;align-items:center;border:0;background:#fff;border-radius:8px;padding:9px 11px;font:inherit;font-size:14px;cursor:pointer;color:#17150f;text-align:left}
.bl-zelle button span{color:#8b8578;font-size:12px;width:56px;flex:none}
.bl-zelle button b{flex:1;font-weight:500;min-width:0;overflow-wrap:anywhere}
.bl-zelle button i{font-style:normal;font-size:12px;color:#6f6a5f;text-decoration:underline}
.bl-ok{color:#253a33;font-size:14px;font-weight:500}
.bl-handles{margin:0;display:grid;gap:4px;font-size:14px}
.bl-handles div{display:flex;gap:10px;min-width:0}
.bl-handles dt{color:#8b8578;width:84px;flex:none}
.bl-handles dd{margin:0;min-width:0;overflow-wrap:anywhere;font-weight:500}
.bl-people li{display:flex;align-items:center;gap:10px;border-top:1px solid rgba(0,0,0,.06);padding:8px 0;font-size:14px;min-height:44px}
.bl-people li:first-child{border-top:0}
.bl-people input[type=checkbox]{width:18px;height:18px;flex:none;accent-color:#17150f}
.bl-nobox{width:18px;flex:none}
.bl-err{margin-top:12px!important;color:#b91c1c;font-size:13px}
.bl-toast{margin-top:12px!important;background:#17150f;color:#fff;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.45}
.bl-foot{margin-top:22px!important;color:#8b8578;font-size:12px;text-align:center}
@media (max-width:380px){.bl-fields{grid-template-columns:1fr}}
`;
