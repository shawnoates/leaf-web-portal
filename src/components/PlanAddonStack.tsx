"use client";

/**
 * The add-on option stack, paid to the host (server: cloud/addon-purchase.js).
 *
 * Shown on the RSVP confirmation step and the already-going plan view when
 * the plan has live add-ons. The host who fulfils them chose them, set the
 * prices and said how they get paid; the guest picks quantities, orders, and
 * pays the host straight on Venmo / Cash App / PayPal / Zelle with the order's
 * LEAF code in the note, then taps "I paid". The host confirms from their
 * checklist. Leaf never touches the money and adds nothing on top.
 *
 * NOTHING HERE DECIDES A PRICE: the component sends PlanAddon ids and
 * quantities and shows the total the server computed.
 */

import { useCallback, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";

interface Addon {
  objectId: string;
  title: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
  maxQuantity: number;
  // What to ask for a note ("Your coffee or tea order"); null = a general note.
  notePrompt?: string | null;
}

type Method = "venmo" | "cashapp" | "paypal" | "zelle";

interface PayOption {
  method: Method;
  label: string;
  handle: string;
  url: string | null;
  notePrefilled: boolean;
  hint?: string;
  recipientName?: string | null;
}

interface Order {
  orderId: string;
  status: "unpaid" | "claimed" | "paid";
  ref: string;
  totalCents: number;
  items: { planAddonId: string | null; title: string; quantity: number; unitCents: number; guestNote?: string | null }[];
  method: Method | null;
  autoConfirmAt: string | null;
  note: string;
  options: PayOption[];
}

const LABELS: Record<Method, string> = { venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", zelle: "Zelle" };

/** `$6`, never `$6.00`. */
function money(cents: number) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

/** "Add to your morning" — the heading names the plan's moment, not the clock. */
function momentWord(startIso: string | null): string {
  if (!startIso) return "your plan";
  const h = new Date(startIso).getHours();
  if (h < 11) return "your morning";
  if (h < 16) return "your afternoon";
  if (h < 21) return "your evening";
  return "your night";
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export default function PlanAddonStack({
  eventGroupId,
  phoneNumber,
  name,
  startIso,
}: {
  eventGroupId: string;
  phoneNumber: string;
  name?: string;
  startIso?: string | null;
  onDismiss?: () => void;
}) {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payee, setPayee] = useState("the host");
  const [qty, setQty] = useState<Record<string, number>>({});
  // A note for the host per add-on ("oat latte, no sugar"), optional.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const auth = useCallback(() => (phoneNumber ? { phoneNumber: phoneNumber.replace(/\D/g, "") } : {}), [phoneNumber]);

  const load = useCallback(async () => {
    try {
      const r = (await Parse.Cloud.run("getPlanAddonsForGuest", { eventGroupId, ...auth() })) as {
        addons: Addon[]; orders: Order[]; payee: { name: string };
      };
      setAddons(r.addons || []);
      setOrders(r.orders || []);
      setPayee(r.payee?.name || "the host");
    } catch {
      setAddons([]);
    } finally {
      setLoading(false);
    }
  }, [eventGroupId, auth]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const run = async (fn: string, params: Record<string, unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    try {
      await Parse.Cloud.run(fn, { ...params, ...auth() });
      if (done) setToast(done);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const picked = addons.filter((a) => (qty[a.objectId] || 0) > 0);
  const pickedTotal = picked.reduce((n, a) => n + a.priceCents * (qty[a.objectId] || 0), 0);
  const order = async () => {
    const ok = await run("orderPlanAddons", {
      eventGroupId, name,
      items: picked.map((a) => ({ planAddonId: a.objectId, quantity: qty[a.objectId], note: (notes[a.objectId] || "").trim() || undefined })),
    });
    if (ok) {
      setQty({});
      setNotes({});
    }
  };

  if (loading) return null;
  if (addons.length === 0 && orders.length === 0) return null;
  const host = payee.charAt(0).toUpperCase() + payee.slice(1);

  return (
    <div className="border-t border-b border-zinc-100 py-[18px] flex flex-col gap-[14px] text-left">
      {orders.map((o) => (
        <OrderCard key={o.orderId} order={o} host={host} busy={busy}
          onPaid={(m) => run("markAddonOrderPaid", { orderId: o.orderId, method: m }, `We told ${host}.`)}
          onCancel={() => run("cancelAddonOrder", { orderId: o.orderId }, "Order cancelled.")}
          onCopied={(what) => setToast(what)} />
      ))}

      {addons.length > 0 && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-[15px] leading-5 font-medium text-zinc-900">Add to {momentWord(startIso || null)}</p>
            <p className="text-xs leading-[18px] text-zinc-500">
              You pay {host} directly — what you see is what it costs.
            </p>
          </div>
          <div className="flex flex-col gap-[10px]">
            {addons.map((a) => {
              const n = qty[a.objectId] || 0;
              const set = (v: number) => setQty((p) => ({ ...p, [a.objectId]: Math.max(0, Math.min(a.maxQuantity, v)) }));
              return (
                <div key={a.objectId}
                  className={`flex gap-[14px] items-start rounded-xl box-border ${n ? "border-2 border-zinc-900 p-[15px]" : "border border-zinc-200 p-4"}`}>
                  {a.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover bg-zinc-100 flex-none" />
                  )}
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <span className="text-[15px] leading-5 font-medium text-zinc-900">{a.title}</span>
                    {a.description && <span className="text-[13px] leading-[19px] text-zinc-500 -mt-1">{a.description}</span>}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[15px] leading-5 font-medium text-zinc-900">{money(a.priceCents)}</span>
                      <div className="flex items-center gap-2" role="group" aria-label={`How many ${a.title}`}>
                        <button type="button" aria-label="One fewer" disabled={n === 0} onClick={() => set(n - 1)}
                          className="w-8 h-8 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-30">−</button>
                        <span className="w-5 text-center text-sm tabular-nums" aria-live="polite">{n}</span>
                        <button type="button" aria-label="One more" disabled={n >= a.maxQuantity} onClick={() => set(n + 1)}
                          className="w-8 h-8 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-30">+</button>
                      </div>
                    </div>
                    {n > 0 && (
                      <input
                        type="text"
                        value={notes[a.objectId] || ""}
                        maxLength={200}
                        onChange={(e) => setNotes((p) => ({ ...p, [a.objectId]: e.target.value }))}
                        placeholder={a.notePrompt ? `${a.notePrompt} (optional)` : `Note for ${host} (optional)`}
                        aria-label={a.notePrompt || `Note for ${host}`}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-[16px] sm:text-sm focus:border-zinc-900 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {picked.length > 0 && (
            <button type="button" disabled={busy} onClick={order}
              className="w-full bg-zinc-900 text-white rounded-lg py-3 text-sm font-semibold disabled:opacity-50">
              {busy ? "Ordering…" : `Order · ${money(pickedTotal)}`}
            </button>
          )}
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {toast && <p className="text-xs text-emerald-800" role="status">{toast}</p>}
    </div>
  );
}

function OrderCard({ order, host, busy, onPaid, onCancel, onCopied }: {
  order: Order;
  host: string;
  busy: boolean;
  onPaid: (m: Method) => void;
  onCancel: () => void;
  onCopied: (what: string) => void;
}) {
  const [last, setLast] = useState<Method | null>(null);
  const [picking, setPicking] = useState(false);
  const what = order.items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.title}${i.guestNote ? ` (${i.guestNote})` : ""}`).join(", ");

  if (order.status === "paid") {
    return (
      <div className="rounded-xl bg-emerald-50 px-4 py-3">
        <p className="text-sm font-medium text-emerald-900">Paid ✓ · {what}</p>
        <p className="text-xs text-emerald-800">{host} confirmed your {money(order.totalCents)}.</p>
      </div>
    );
  }
  if (order.status === "claimed") {
    return (
      <div className="rounded-xl border border-zinc-200 px-4 py-3">
        <p className="text-sm font-medium text-zinc-900">Paid · waiting on {host} to confirm</p>
        <p className="text-xs text-zinc-500">
          {what} — {money(order.totalCents)}{order.method ? ` on ${LABELS[order.method]}` : ""}.
          {order.autoConfirmAt ? ` If ${host} doesn't answer, it confirms itself ${when(order.autoConfirmAt)}.` : ""}
        </p>
      </div>
    );
  }
  const zelle = order.options.find((o) => o.method === "zelle");
  return (
    <div className="rounded-xl border border-zinc-200 p-4 flex flex-col gap-3">
      <div>
        <p className="text-[15px] font-semibold text-zinc-900">Pay {host} {money(order.totalCents)}</p>
        <p className="text-xs text-zinc-500">{what}</p>
      </div>
      <button type="button" className="flex justify-between items-center rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500"
        onClick={async () => { if (await copy(order.note)) onCopied("Note copied"); }}>
        <span>Put this in the note</span>
        <span><b className="font-mono text-zinc-900 tracking-wide">{order.ref}</b> <u>Copy</u></span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        {order.options.map((o) => o.url ? (
          <a key={o.method} href={o.url} target="_blank" rel="noopener noreferrer"
            onClick={() => { setLast(o.method); if (!o.notePrefilled) void copy(order.note).then((ok) => ok && onCopied("Note copied — paste it in “For”")); }}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-left hover:border-zinc-900">
            <span className="block text-sm font-semibold text-zinc-900">{o.label}</span>
            <span className="block text-[11px] text-zinc-500 truncate">{o.handle}</span>
          </a>
        ) : (
          <button key={o.method} type="button" onClick={() => setLast(o.method)}
            className={`rounded-lg border px-3 py-2 text-left ${last === o.method ? "border-zinc-900" : "border-zinc-200"}`}>
            <span className="block text-sm font-semibold text-zinc-900">{o.label}</span>
            <span className="block text-[11px] text-zinc-500 truncate">{o.handle}</span>
          </button>
        ))}
      </div>
      {last === "zelle" && zelle && (
        <p className="text-xs text-zinc-600 bg-zinc-50 rounded-lg px-3 py-2">
          Send {money(order.totalCents)} to {zelle.handle} from your bank&apos;s app with {order.ref} in the memo.
          {zelle.recipientName ? <> Your bank should show <b>{zelle.recipientName}</b>.</> : null}
        </p>
      )}
      {picking ? (
        <div className="flex flex-wrap gap-2 items-center text-xs text-zinc-500">
          Which app did you use?
          {order.options.map((o) => (
            <button key={o.method} type="button" disabled={busy} onClick={() => onPaid(o.method)}
              className="rounded-md border border-zinc-300 px-2.5 py-1 text-zinc-900">{o.label}</button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <button type="button" disabled={busy} onClick={() => (last ? onPaid(last) : setPicking(true))}
            className="flex-1 bg-zinc-900 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
            {last ? `I paid on ${LABELS[last]}` : "I've paid"}
          </button>
          <button type="button" disabled={busy} onClick={onCancel} className="text-xs text-zinc-400 underline">Cancel</button>
        </div>
      )}
    </div>
  );
}
