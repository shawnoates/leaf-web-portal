"use client";

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { p2pMoney } from "@/lib/p2p";

type Method = "venmo" | "cashapp" | "paypal" | "zelle";
const LABELS: Record<Method, string> = { venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", zelle: "Zelle" };

type Buyer = {
  name: string;
  eventNotificationId: string;
  status: "unpaid" | "claimed" | "confirmed";
  ref: string | null;
  method: Method | null;
  autoConfirmAt: string | null;
  confirmedBy: "host" | "auto" | null;
};

type Resale = {
  status: "listed" | "taken" | "paid" | "host_refund" | "cancelled";
  amountCents: number;
  title: string;
  startsAt: string | null;
  hasHandles: boolean;
  handlesUrl: string | null;
  buyer: Buyer | null;
};

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PayResaleClient({ resaleId, token }: { resaleId: string; token: string | null }) {
  const [data, setData] = useState<Resale | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const params = useCallback((extra: Record<string, unknown> = {}) => ({
    ...(token ? { resaleToken: token } : {}),
    ...extra,
  }), [token]);

  const load = useCallback(async () => {
    try {
      setData((await Parse.Cloud.run("getP2pResale", params({ resaleId }))) as Resale);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "We couldn't load this page.");
    }
  }, [params, resaleId]);

  useEffect(() => { void load(); }, [load]);

  const act = async (fn: "confirmP2pPayment" | "markP2pNotReceived") => {
    if (!data?.buyer) return;
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run(fn, params({ notificationId: data.buyer.eventNotificationId }));
      setToast(fn === "confirmP2pPayment" ? "Confirmed. Thanks!" : `We told ${data.buyer.name} to check their payment.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  let body: React.ReactNode;
  if (loadError) {
    body = <div className="pr-card"><p>{loadError}</p></div>;
  } else if (!data) {
    body = <div className="pr-card"><p className="pr-muted">Loading…</p></div>;
  } else {
    const amt = p2pMoney(data.amountCents);
    const b = data.buyer;
    body = (
      <div className="pr-card">
        {data.status === "listed" && (
          <>
            <p className="pr-h">Your seat is back up</p>
            <p className="pr-muted">
              {data.hasHandles
                ? <>If someone takes it, they&apos;ll pay you back {amt} directly. We&apos;ll text you when they do.</>
                : <>If someone takes it, they can pay you back {amt} directly — once you add where you get paid.</>}
            </p>
          </>
        )}
        {data.status === "taken" && b && b.status === "unpaid" && (
          <>
            <p className="pr-h">{b.name} took your seat</p>
            <p className="pr-muted">They&apos;re paying you back {amt}. We&apos;ll text you when they say they&apos;ve sent it.</p>
          </>
        )}
        {data.status === "taken" && b && b.status === "claimed" && (
          <>
            <p className="pr-h">{b.name} says they paid you {amt}{b.method ? ` on ${LABELS[b.method]}` : ""}</p>
            <p className="pr-muted">Look for <b className="pr-code">{b.ref}</b> in the note.</p>
            <div className="pr-actions">
              <button className="pr-btn primary" disabled={busy} onClick={() => act("confirmP2pPayment")}>Confirm</button>
              <button className="pr-btn ghost" disabled={busy} onClick={() => act("markP2pNotReceived")}>Not received</button>
            </div>
            {b.autoConfirmAt && (
              <p className="pr-muted pr-small">If you don&apos;t answer, it confirms itself {when(b.autoConfirmAt)}.</p>
            )}
          </>
        )}
        {data.status === "paid" && b && (
          <>
            <p className="pr-h">{b.name} paid you back {amt} ✓</p>
            <p className="pr-muted">
              {b.confirmedBy === "auto" ? "It confirmed on its own. " : ""}Didn&apos;t actually get it?{" "}
              <button className="pr-link" disabled={busy} onClick={() => act("markP2pNotReceived")}>Mark not received</button>
            </p>
          </>
        )}
        {data.status === "host_refund" && (
          <>
            <p className="pr-h">Someone took your seat</p>
            <p className="pr-muted">The host is refunding your {amt} directly.</p>
          </>
        )}
        {data.status === "cancelled" && (
          <>
            <p className="pr-h">You&apos;re back in</p>
            <p className="pr-muted">You rejoined before anyone took your seat, so your {amt} still counts.</p>
          </>
        )}
        {!data.hasHandles && ["listed", "taken"].includes(data.status) && data.handlesUrl && (
          <div className="pr-warn">
            <p>Add where you get paid, or whoever takes your seat pays the host instead and you&apos;ll wait on a refund.</p>
            <a className="pr-btn primary" href={data.handlesUrl}>Add Venmo, Cash App, PayPal or Zelle</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="pr">
      <style>{CSS}</style>
      <div className="pr-in">
        <p className="pr-eyebrow">Your seat</p>
        <h1 className="pr-title">{data?.title || "Your plan"}</h1>
        {data?.startsAt && <p className="pr-muted">{when(data.startsAt)}</p>}
        {error && <p className="pr-err">{error}</p>}
        {toast && <p className="pr-toast" role="status">{toast}</p>}
        <div className="pr-body">{body}</div>
        <p className="pr-foot">Payments go straight between you. Leaf never touches the money.</p>
      </div>
    </main>
  );
}

const CSS = `
.pr{min-height:100vh;background:#faf9f7;color:#17150f;font-family:var(--font-geist-sans,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);-webkit-font-smoothing:antialiased}
.pr-in{max-width:520px;margin:0 auto;padding:32px 16px 48px}
.pr p{margin:0}
.pr-eyebrow{font-family:var(--font-geist-mono,ui-monospace,monospace);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#8b8578}
.pr-title{font-size:26px;line-height:1.2;font-weight:500;margin:6px 0 2px;overflow-wrap:anywhere}
.pr-muted{color:#6f6a5f;font-size:13px}
.pr-small{font-size:12px}
.pr-body{margin-top:20px}
.pr-card{background:#fff;border:1px solid rgba(0,0,0,.09);border-radius:14px;padding:18px;display:grid;gap:8px}
.pr-h{font-size:17px;font-weight:600}
.pr-code{font-family:var(--font-geist-mono,ui-monospace,monospace);letter-spacing:.04em}
.pr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.pr-btn{display:inline-flex;justify-content:center;border-radius:8px;padding:10px 16px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;border:1px solid #17150f;text-decoration:none}
.pr-btn.primary{background:#17150f;color:#fff}
.pr-btn.ghost{background:#fff;color:#17150f;border-color:rgba(0,0,0,.18)}
.pr-btn:disabled{opacity:.5;cursor:default}
.pr-link{border:0;background:none;padding:0;font:inherit;color:#17150f;text-decoration:underline;cursor:pointer}
.pr-warn{margin-top:8px;background:#fff7ed;color:#7c2d12;border-radius:10px;padding:12px;display:grid;gap:10px;font-size:13px}
.pr-err{color:#b91c1c;font-size:12.5px;margin-top:10px !important}
.pr-toast{color:#253a33;font-size:12.5px;margin-top:10px !important}
.pr-foot{margin-top:28px !important;font-size:11.5px;color:#8b8578;text-align:center}
`;
