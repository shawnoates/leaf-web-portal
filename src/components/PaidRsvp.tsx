"use client";

/**
 * Paying for a ticket to an Offer Pipeline night.
 *
 * Shown in place of "Confirm RSVP" when a plan has a ticket price, once the
 * phone is verified: the server never sells a ticket on a bare phone number.
 * "Get a ticket" starts the order and opens the checkout as its own step
 * (2026-10-18): full screen on a phone, a two-panel sheet on desktop, with
 * the night and the price on one side and payment on the other, so nothing
 * scrolls in a small window. Apple Pay / Google Pay come first (Stripe's
 * Express Checkout Element), then a card form trimmed to card, expiry, CVC
 * and ZIP (the order is card-only on the server, so no bank, Cash App,
 * Klarna or Link blocks). Paid on Stripe's side, it waits for the server to
 * mark the ticket paid (the webhook, or the status check asking Stripe
 * directly) before saying "you're in". The RSVP itself is made by the server.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import { ArrowRight, Loader2, Lock, X } from "lucide-react";
import Parse from "@/lib/parse-client";

function money(cents: number): string {
  const d = cents / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

type Order = {
  state: "checkout" | "attending" | "sold_out";
  ticketId?: string;
  clientSecret?: string;
  publishableKey?: string | null;
  priceCents?: number;
  feeCents?: number;
  totalCents?: number;
};

/** What the checkout shows about the night, beside the payment. */
export type TicketSummary = { title: string; when: string; place?: string | null; image?: string | null };

export default function PaidRsvp({
  planId,
  sessionToken,
  name,
  phone,
  priceCents,
  feeCents,
  summary,
  brandColor,
  onPaid,
}: {
  planId: string;
  sessionToken: string;
  name: string;
  /** The verified number, shown as who's paying. */
  phone?: string;
  priceCents: number;
  feeCents: number;
  summary?: TicketSummary;
  brandColor?: string;
  /** totalCents: what they paid (0 when they already had a ticket). */
  onPaid: (alreadyAttending: boolean, totalCents: number) => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [walletShown, setWalletShown] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const walletRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const emailRef = useRef("");
  const orderRef = useRef<Order | null>(null);
  const settleRef = useRef<(() => Promise<void>) | null>(null);
  // The page's callback changes every render; reading it through a ref keeps
  // the Stripe form mounted once.
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    emailRef.current = email;
  }, [email]);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const accent = brandColor || "#18181b";
  const total = order?.totalCents ?? priceCents + feeCents;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("createPlanTicketOrder", { planId, name }, { sessionToken })) as Order;
      if (r.state === "attending") {
        onPaid(true, 0);
        return;
      }
      setOrder(r);
      if (r.state === "checkout") setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open || order?.state !== "checkout" || !order.clientSecret || !cardRef.current) return;
    let cancelled = false;
    // Paid on Stripe's side: wait for the server to make the RSVP, rather than assuming it.
    const settle = async () => {
      const o = orderRef.current;
      for (let i = 0; i < 12; i += 1) {
        try {
          const s = (await Parse.Cloud.run("getPlanTicketStatus", { ticketId: o?.ticketId }, { sessionToken })) as { status: string };
          if (s.status === "paid") {
            setOpen(false);
            onPaidRef.current(false, o?.totalCents ?? 0);
            return;
          }
        } catch {
          /* keep waiting */
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      setError("Your payment went through, and we're still confirming your spot. You'll get a text, or refresh in a minute.");
      setBusy(false);
    };
    settleRef.current = settle;
    (async () => {
      try {
        if (!order.publishableKey) throw new Error("Payments are not configured.");
        const stripe = stripeRef.current || (await loadStripe(order.publishableKey));
        if (cancelled || !stripe) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({
          clientSecret: order.clientSecret,
          appearance: {
            theme: "stripe",
            variables: { borderRadius: "10px", colorPrimary: accent, fontFamily: "inherit", fontSizeBase: "15px", spacingUnit: "4px" },
          },
        });
        elementsRef.current = elements;
        // Apple Pay / Google Pay on top; hidden when the device has neither.
        if (walletRef.current) {
          const wallet = elements.create("expressCheckout", {
            buttonType: { applePay: "buy", googlePay: "buy" },
            buttonHeight: 46,
            paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never" },
          });
          wallet.on("ready", (e) => setWalletShown(Boolean(e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean))));
          wallet.on("confirm", async () => {
            setBusy(true);
            setError(null);
            const { error: err } = await stripe.confirmPayment({
              elements,
              clientSecret: order.clientSecret as string,
              confirmParams: { return_url: window.location.href },
              redirect: "if_required",
            });
            if (err) {
              setError(err.message || "That didn't go through.");
              setBusy(false);
              return;
            }
            await settle();
          });
          wallet.mount(walletRef.current);
        }
        // The card form, just the fields a card needs (country is the US).
        elements
          .create("payment", {
            layout: "tabs",
            wallets: { applePay: "never", googlePay: "never" },
            fields: { billingDetails: { address: { country: "never", postalCode: "auto" } } },
          })
          .mount(cardRef.current!);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load card entry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, order, accent, sessionToken]);

  const payByCard = async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || !order?.ticketId) return;
    setBusy(true);
    setError(null);
    const receipt = emailRef.current.trim();
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
        payment_method_data: { billing_details: { address: { country: "US" } } },
        ...(receipt ? { receipt_email: receipt } : {}),
      },
      redirect: "if_required",
    });
    if (err) {
      setError(err.message || "That didn't go through.");
      setBusy(false);
      return;
    }
    await settleRef.current?.();
  };

  const btn = "w-full rounded-xl text-white py-3.5 text-[15px] font-semibold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50";

  if (order?.state === "sold_out") {
    return <p className="text-sm text-zinc-600 text-center">This one just sold out. Keep an eye on the calendar for the next.</p>;
  }

  const priceLines = (
    <div className="border-t border-[#e7e1d6] pt-3 text-[14px]">
      <div className="flex justify-between py-1 text-zinc-600">
        <span>1 ticket</span>
        <span>{money(order?.priceCents ?? priceCents)}</span>
      </div>
      <div className="flex justify-between py-1 text-zinc-600">
        <span>Booking fee</span>
        <span>{money(order?.feeCents ?? feeCents)}</span>
      </div>
      <div className="mt-1.5 flex justify-between border-t border-[#e7e1d6] pt-2.5 font-semibold text-zinc-900">
        <span>Total</span>
        <span>{money(total)}</span>
      </div>
    </div>
  );
  const policy = `Cancel 48 hours or more before for your ${money(order?.priceCents ?? priceCents)} back. If the night is cancelled, you get everything back.`;

  const sheet = open && typeof document !== "undefined"
    ? createPortal(
      <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-zinc-900/60 backdrop-blur-sm md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="Checkout">
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white md:grid md:h-auto md:max-h-[calc(100dvh-3rem)] md:max-w-[820px] md:grid-cols-[320px_1fr] md:rounded-3xl md:shadow-2xl">
          {/* The night and the price: a full panel on desktop, one compact row on a phone. */}
          <aside className="hidden flex-col gap-4 bg-[#f6f2ea] p-6 md:flex">
            {summary?.image && <div className="h-40 rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url(${summary.image})` }} />}
            {summary && (
              <div>
                <p className="font-serif text-[21px] leading-tight text-zinc-900">{summary.title}</p>
                <p className="mt-1 text-[14px] text-zinc-500">
                  {summary.when}
                  {summary.place ? ` · ${summary.place}` : ""}
                </p>
              </div>
            )}
            {priceLines}
            <p className="text-[12px] leading-snug text-zinc-500">{policy}</p>
          </aside>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4 md:border-0 md:px-7 md:pt-6 md:pb-0">
              <p className="text-[17px] font-semibold text-zinc-900">Pay for your ticket</p>
              <button type="button" onClick={() => !busy && setOpen(false)} className="ml-auto rounded-full p-1.5 text-zinc-400 hover:text-zinc-900" aria-label="Close checkout">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4 md:px-7">
              {summary && (
                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[#f6f2ea] p-2.5 md:hidden">
                  {summary.image && <div className="h-14 w-14 shrink-0 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${summary.image})` }} />}
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-zinc-900">{summary.title}</p>
                    <p className="text-[12px] text-zinc-500">{summary.when}</p>
                  </div>
                  <p className="ml-auto pr-1 text-[15px] font-semibold">{money(total)}</p>
                </div>
              )}
              {(name || phone) && (
                <p className="mb-4 text-[13px] text-zinc-500">
                  Paying as {[name, phone].filter(Boolean).join(" · ")}
                </p>
              )}
              <div ref={walletRef} />
              {walletShown && (
                <div className="my-4 flex items-center gap-3 text-[12px] text-zinc-400">
                  <span className="h-px flex-1 bg-zinc-200" />
                  or pay with card
                  <span className="h-px flex-1 bg-zinc-200" />
                </div>
              )}
              <div ref={cardRef} />
              <label className="mt-4 block text-[13px] text-zinc-600">
                Email for your receipt (optional)
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-[10px] border border-zinc-200 px-3 py-2.5 text-[15px] text-zinc-900 focus:border-zinc-900 focus:outline-none"
                />
              </label>
              <p className="mt-4 text-[12px] leading-snug text-zinc-500 md:hidden">
                {money(order?.priceCents ?? priceCents)} ticket + {money(order?.feeCents ?? feeCents)} booking fee. {policy}
              </p>
            </div>

            {/* Always in reach: fixed at the bottom of the panel. */}
            <div className="border-t border-zinc-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:px-7 md:pb-6">
              {error && <p className="mb-2 text-[13px] text-red-600">{error}</p>}
              <button type="button" onClick={payByCard} disabled={busy} className={btn} style={{ backgroundColor: accent }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Pay {money(total)}</>}
              </button>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-zinc-400">
                <Lock className="h-3 w-3" /> Secured by Stripe. We&rsquo;ll text you your ticket.
              </p>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <div className="space-y-3">
      <button type="button" onClick={order?.state === "checkout" ? () => setOpen(true) : start} disabled={busy || !name} className={btn} style={{ backgroundColor: accent }}>
        {busy && !open ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Get a ticket · {money(priceCents + feeCents)} <ArrowRight className="h-4 w-4" /></>}
      </button>
      {error && !open && <p className="text-xs text-red-600">{error}</p>}
      {sheet}
    </div>
  );
}
