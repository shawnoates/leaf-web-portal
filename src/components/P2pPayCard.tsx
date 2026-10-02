"use client";

/**
 * Paying the host back, peer to peer (server: cloud/p2p-payment.js).
 *
 * The host fronted the money for the plan (tickets, a court) and collects a
 * fixed amount from everyone who takes a seat, straight to their own Venmo /
 * Cash App / PayPal / Zelle. Leaf can't see a payment land, so the guest taps
 * "I paid" and the host confirms; the server auto-confirms if they never do.
 *
 * Shown to a guest who holds a seat. Venmo links carry the amount and note;
 * Cash App and PayPal carry the amount only, so tapping them copies the note
 * first; Zelle has no link, so its details are laid out to copy, with the
 * name the guest's bank should show — a Zelle send can't be undone.
 *
 * Auth: the signed-in session (both /me and /org mint one from texted links),
 * or right after a web RSVP, the RSVP id + phone pair.
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";

type Method = "venmo" | "cashapp" | "paypal" | "zelle";

type PayOption = {
  method: Method;
  label: string;
  handle: string;
  url: string | null;
  notePrefilled: boolean;
  hint?: string;
  recipientName?: string | null;
};

type Seat = {
  eventNotificationId: string;
  status: "pending_lock" | "unpaid" | "claimed" | "confirmed" | "expired" | null;
  amountCents: number | null;
  ref: string | null;
  method: Method | null;
  holdUntil: string | null;
  claimedAt: string | null;
  autoConfirmAt: string | null;
  confirmedBy: "host" | "auto" | null;
  notReceived: boolean;
  canRemindHost: boolean;
};

/** "Split a total": the share comes from the headcount, fixed when it locks. */
type Split = {
  totalCents: number;
  minHeadcount: number;
  maxHeadcount: number;
  lowCents: number;
  highCents: number;
  locked: boolean;
  shareCents: number;
  headcount: number;
  autoLockAt: string | null;
};

type Payment = {
  p2pPayment: { amountCents: number | null; ticketCount: number | null; payByAt: string | null } | null;
  split?: Split | null;
  hostFirstName?: string;
  seat?: Seat | null;
  note?: string;
  options?: PayOption[];
};

const LABELS: Record<Method, string> = { venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", zelle: "Zelle" };

function money(cents: number): string {
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

function when(iso: string): string {
  const d = new Date(iso);
  const soon = d.getTime() - Date.now() < 6 * 86400_000;
  return d.toLocaleString(undefined, soon
    ? { weekday: "short", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function P2pPayCard({
  planId,
  eventNotificationId,
  phoneNumber,
  accent,
  onStatus,
}: {
  planId: string;
  /** Fallback auth right after a web RSVP, before a session exists. */
  eventNotificationId?: string | null;
  phoneNumber?: string | null;
  /** Primary button color — the calendar's brand on /org. */
  accent?: string;
  onStatus?: (status: Seat["status"]) => void;
}) {
  const [data, setData] = useState<Payment | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastMethod, setLastMethod] = useState<Method | null>(null);
  const [picking, setPicking] = useState(false);
  const [zelleOpen, setZelleOpen] = useState(false);

  const auth = useCallback(() => {
    const p: Record<string, string> = { eventGroupId: planId };
    if (!Parse.User.current() && eventNotificationId && phoneNumber) {
      p.eventNotificationId = eventNotificationId;
      p.phoneNumber = phoneNumber.replace(/\D/g, "");
    }
    return p;
  }, [planId, eventNotificationId, phoneNumber]);

  const load = useCallback(async () => {
    try {
      const r = (await Parse.Cloud.run("getP2pPayment", auth())) as Payment;
      setData(r);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = data?.seat?.status ?? null;
  useEffect(() => {
    if (status) onStatus?.(status);
  }, [status, onStatus]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const call = async (fn: string, extra: Record<string, string> = {}) => {
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run(fn, { ...auth(), ...extra })) as { seat?: Seat };
      if (r?.seat) setData((d) => (d ? { ...d, seat: r.seat } : d));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
      return false;
    } finally {
      setBusy(false);
      setPicking(false);
    }
  };

  if (failed) return null;
  if (!data) return <div className="p2p p2p-loading" aria-busy="true"><style>{CSS}</style></div>;
  if (!data.p2pPayment) return null;

  const seat = data.seat;
  // Names arrive as typed ("jess"); "the host" stays lower-case mid-sentence.
  const named = data.hostFirstName ? `${data.hostFirstName[0].toUpperCase()}${data.hostFirstName.slice(1)}` : null;
  const host = named || "the host";
  const Host = named || "The host";
  const options = data.options || [];
  const split = data.split || null;
  const amountCents = seat?.amountCents ?? data.p2pPayment.amountCents ?? split?.shareCents ?? 0;
  const amount = money(amountCents);
  const brand = accent ? { background: accent, borderColor: accent } : undefined;

  // A seat we can't see: no session on this browser. The texted link signs
  // them in, so point there rather than asking for a phone again.
  if (!seat) {
    return (
      <div className="p2p">
        <style>{CSS}</style>
        <p className="p2p-h">
          {split && !split.locked ? `${money(split.lowCents)}–${money(split.highCents)} each` : `${amount} per spot`}, paid to {host}
        </p>
        <p className="p2p-sub">Open the link Leaf texted you to see how to pay.</p>
      </div>
    );
  }

  // A split that hasn't locked: the seat is held and nothing is owed yet.
  if (seat.status === "pending_lock" && split) {
    return (
      <div className="p2p">
        <style>{CSS}</style>
        {split.headcount < split.minHeadcount ? (
          // Below the minimum the running share is above the range guests were
          // shown; they only pay that if the host locks anyway and tells them.
          <>
            <p className="p2p-h">Your share: {money(split.lowCents)}–{money(split.highCents)}</p>
            <p className="p2p-sub">
              {Host} is splitting {money(split.totalCents)} between {split.minHeadcount}–{split.maxHeadcount} people.
              {" "}{split.headcount} in so far — {split.minHeadcount - split.headcount} more to make it happen.
            </p>
          </>
        ) : (
          <>
            <p className="p2p-h">Your share so far: {money(split.shareCents)}</p>
            <p className="p2p-sub">
              {Host} is splitting {money(split.totalCents)} between everyone who comes — {split.headcount} so far, so it&apos;s{" "}
              {money(split.shareCents)} each. The more people join, the less each pays (as low as {money(split.lowCents)}).
            </p>
          </>
        )}
        <p className="p2p-sub">
          You&apos;ll pay once {host} sets the headcount
          {split.autoLockAt ? <> — by <b>{when(split.autoLockAt)}</b> at the latest</> : null}. Your spot is held until then.
        </p>
      </div>
    );
  }

  if (seat.status === "confirmed") {
    return (
      <div className="p2p p2p-done">
        <style>{CSS}</style>
        <p className="p2p-h">Paid ✓</p>
        <p className="p2p-sub">
          {seat.confirmedBy === "auto" ? `Your ${amount} is confirmed.` : `${Host} confirmed your ${amount}.`}
        </p>
      </div>
    );
  }

  if (seat.status === "claimed") {
    return (
      <div className="p2p">
        <style>{CSS}</style>
        <p className="p2p-h">Paid · waiting on {host} to confirm</p>
        <p className="p2p-sub">
          You sent {amount}{seat.method ? ` on ${LABELS[seat.method]}` : ""}. Your spot is safe while you wait
          {seat.autoConfirmAt ? ` — if ${host} doesn't answer, it confirms itself ${when(seat.autoConfirmAt)}.` : "."}
        </p>
        {seat.canRemindHost && (
          <button type="button" className="p2p-btn ghost" disabled={busy} onClick={async () => {
            if (await call("remindHostP2p")) setToast(`We reminded ${host}.`);
          }}>
            Remind {host}
          </button>
        )}
        {error && <p className="p2p-err">{error}</p>}
        {toast && <p className="p2p-toast" role="status">{toast}</p>}
      </div>
    );
  }

  // Unpaid: the pay buttons.
  const note = data.note || seat.ref || "";
  const zelle = options.find((o) => o.method === "zelle");
  const confirmLabel = lastMethod ? `I paid on ${LABELS[lastMethod]}` : "I've paid";
  const paypalHint = lastMethod === "paypal" ? options.find((o) => o.method === "paypal")?.hint : null;

  return (
    <div className="p2p">
      <style>{CSS}</style>
      <p className="p2p-h">Pay {host} {amount}</p>
      {split?.locked && (
        <p className="p2p-sub">Your share of {money(split.totalCents)}, split {split.headcount} ways.</p>
      )}
      {seat.notReceived ? (
        <p className="p2p-warn">
          {`${Host} couldn\u2019t find your payment. Check you sent it to the account below.`}
          {seat.holdUntil ? ` Your spot is held until ${when(seat.holdUntil)}.` : ""}
        </p>
      ) : (
        <p className="p2p-sub">
          {seat.holdUntil ? <>Your spot is held until <b>{when(seat.holdUntil)}</b>. </> : null}
          Pay {host} directly — Leaf never touches the money.
        </p>
      )}

      <div className="p2p-ref">
        <span>Put this in the note</span>
        <button type="button" onClick={async () => { if (await copy(note)) setToast("Note copied"); }}>
          <code>{seat.ref}</code> <span className="p2p-copy">Copy</span>
        </button>
      </div>

      <div className="p2p-opts">
        {options.filter((o) => o.url).map((o) => (
          <a
            key={o.method}
            className="p2p-opt"
            href={o.url!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setLastMethod(o.method);
              // No note field in the link: put it on the clipboard on the way out.
              if (!o.notePrefilled) {
                void copy(note).then((ok) => ok && setToast("Note copied — paste it in “For”"));
              }
            }}
          >
            <span className="p2p-opt-l">{o.label}</span>
            <span className="p2p-opt-h">{o.handle}</span>
          </a>
        ))}
        {zelle && (
          <button
            type="button"
            className={`p2p-opt${zelleOpen ? " on" : ""}`}
            aria-expanded={zelleOpen}
            onClick={() => { setZelleOpen((v) => !v); setLastMethod("zelle"); }}
          >
            <span className="p2p-opt-l">Zelle</span>
            <span className="p2p-opt-h">{zelle.handle}</span>
          </button>
        )}
      </div>

      {zelle && zelleOpen && (
        <div className="p2p-zelle">
          <p>Zelle has no link — send it from your bank&apos;s app:</p>
          {[["To", zelle.handle], ["Amount", amount], ["Memo", note]].map(([k, v]) => (
            <div key={k} className="p2p-zrow">
              <span>{k}</span>
              <button type="button" onClick={async () => { if (await copy(v)) setToast(`${k} copied`); }}>
                {v} <span className="p2p-copy">Copy</span>
              </button>
            </div>
          ))}
          {zelle.recipientName && (
            <p className="p2p-check">Before you send, your bank should show <b>{zelle.recipientName}</b>. If it shows anyone else, stop.</p>
          )}
        </div>
      )}

      {paypalHint && <p className="p2p-hint">{paypalHint}</p>}

      {picking ? (
        <div className="p2p-pick">
          <span>Which app did you use?</span>
          <div>
            {options.map((o) => (
              <button key={o.method} type="button" className="p2p-btn ghost sm" disabled={busy}
                onClick={() => void call("markIPaid", { method: o.method })}>
                {o.label}
              </button>
            ))}
            <button type="button" className="p2p-link" onClick={() => setPicking(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="p2p-actions">
          <button
            type="button"
            className="p2p-btn primary"
            style={brand}
            disabled={busy}
            onClick={() => (lastMethod ? void call("markIPaid", { method: lastMethod }) : setPicking(true))}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
          {lastMethod && options.length > 1 && (
            <button type="button" className="p2p-link" onClick={() => setPicking(true)}>Used another app?</button>
          )}
        </div>
      )}
      {error && <p className="p2p-err">{error}</p>}
      {toast && <p className="p2p-toast" role="status">{toast}</p>}
    </div>
  );
}

// Scoped by class, plain CSS: the card sits on /me (its own stylesheet) and
// /org (Tailwind), and has to look the same on both.
const CSS = `
.p2p{border:1px solid rgba(0,0,0,.12);border-radius:12px;padding:16px;background:#fff;color:#17150f;text-align:left;font-size:13px;line-height:1.45}
.p2p-loading{min-height:120px;background:#faf9f7}
.p2p-done{background:#f3f7f5;border-color:rgba(37,58,51,.3)}
.p2p-h{font-size:16px;font-weight:600;margin:0}
.p2p-sub{color:#6f6a5f;margin:4px 0 0}
.p2p-warn{color:#9a3412;background:#fff7ed;border-radius:8px;padding:8px 10px;margin:8px 0 0}
.p2p-ref{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:8px 10px;background:#faf9f7;border-radius:8px;color:#6f6a5f;font-size:12px}
.p2p-ref button,.p2p-zrow button{border:0;background:none;cursor:pointer;color:#17150f;font:inherit;display:inline-flex;align-items:center;gap:6px;text-align:right;overflow-wrap:anywhere}
.p2p-ref code{font-family:ui-monospace,SFMono-Regular,monospace;font-size:13px;font-weight:600;letter-spacing:.04em}
.p2p-copy{font-size:11px;color:#8b8578;text-decoration:underline}
.p2p-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:12px}
.p2p-opt{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:10px 12px;border:1px solid rgba(0,0,0,.15);border-radius:10px;background:#fff;cursor:pointer;color:#17150f;text-decoration:none;font:inherit;text-align:left;min-width:0}
.p2p-opt:hover,.p2p-opt.on{border-color:#17150f;background:#faf9f7}
.p2p-opt-l{font-weight:600;font-size:13px}
.p2p-opt-h{font-size:11.5px;color:#8b8578;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.p2p-zelle{margin-top:10px;padding:10px 12px;border-radius:10px;background:#faf9f7;font-size:12.5px}
.p2p-zelle>p{margin:0 0 6px;color:#6f6a5f}
.p2p-zrow{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid rgba(0,0,0,.06)}
.p2p-zrow>span{color:#8b8578}
.p2p-check{margin:8px 0 0 !important;color:#17150f !important}
.p2p-hint{margin:8px 0 0;font-size:12px;color:#6f6a5f}
.p2p-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px}
.p2p-btn{border:1px solid #17150f;border-radius:8px;padding:10px 16px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.p2p-btn.primary{background:#17150f;color:#fff;flex:1 1 auto}
.p2p-btn.ghost{background:#fff;color:#17150f;border-color:rgba(0,0,0,.18);margin-top:12px}
.p2p-btn.sm{padding:7px 12px;font-size:12px;margin:0}
.p2p-btn:disabled{opacity:.55;cursor:default}
.p2p-link{border:0;background:none;color:#8b8578;font:inherit;font-size:12px;text-decoration:underline;cursor:pointer}
.p2p-pick{margin-top:14px;font-size:12.5px;color:#6f6a5f}
.p2p-pick>div{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.p2p-err{color:#b91c1c;font-size:12px;margin:8px 0 0}
.p2p-toast{font-size:12px;color:#253a33;margin:8px 0 0}
`;
