"use client";

/**
 * Paying for a ticket to an Offer Pipeline night, inside the RSVP modal.
 *
 * Shown in place of "Confirm RSVP" when a plan has a ticket price. Needs the
 * session from phone verification: the server never sells a ticket on a bare
 * phone number. Starts the order, mounts Stripe's Payment Element, confirms,
 * then waits for the server to mark the ticket paid (the webhook, or the
 * status check asking Stripe directly) before saying "you're in". The RSVP
 * itself is made by the server once payment lands.
 */

import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import { ArrowRight, Loader2 } from "lucide-react";
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

export default function PaidRsvp({
  planId,
  sessionToken,
  name,
  priceCents,
  feeCents,
  brandColor,
  onPaid,
}: {
  planId: string;
  sessionToken: string;
  name: string;
  priceCents: number;
  feeCents: number;
  brandColor?: string;
  onPaid: (alreadyAttending: boolean) => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = (await Parse.Cloud.run("createPlanTicketOrder", { planId, name }, { sessionToken })) as Order;
      if (r.state === "attending") {
        onPaid(true);
        return;
      }
      setOrder(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (order?.state !== "checkout" || !order.clientSecret || !mountRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        if (!order.publishableKey) throw new Error("Payments are not configured.");
        const stripe = stripeRef.current || (await loadStripe(order.publishableKey));
        if (cancelled || !stripe) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({
          clientSecret: order.clientSecret,
          appearance: { theme: "stripe", variables: { borderRadius: "8px", colorPrimary: brandColor || "#18181b", fontFamily: "inherit" } },
        });
        elementsRef.current = elements;
        elements.create("payment", { layout: "tabs" }).mount(mountRef.current!);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load card entry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order, brandColor]);

  const pay = async () => {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements || !order?.ticketId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (err) {
      setError(err.message || "That didn't go through.");
      setBusy(false);
      return;
    }
    // Paid on Stripe's side. The server makes the RSVP when it sees the
    // payment; wait for that rather than assuming it.
    for (let i = 0; i < 12; i += 1) {
      try {
        const s = (await Parse.Cloud.run("getPlanTicketStatus", { ticketId: order.ticketId }, { sessionToken })) as { status: string };
        if (s.status === "paid") {
          onPaid(false);
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

  const btn = "w-full text-white py-3.5 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50";

  if (order?.state === "sold_out") {
    return <p className="text-sm text-zinc-600 text-center">This one just sold out. Keep an eye on the calendar for the next.</p>;
  }

  return (
    <div className="space-y-3">
      {order?.state === "checkout" ? (
        <>
          <div ref={mountRef} />
          <p className="text-xs text-zinc-500">
            {money(order.priceCents ?? priceCents)} ticket + {money(order.feeCents ?? feeCents)} booking fee. Cancel 48 hours or more before for the ticket price back.
          </p>
          <button type="button" onClick={pay} disabled={busy} className={btn} style={{ backgroundColor: brandColor || "#18181b" }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Pay {money(order.totalCents ?? priceCents + feeCents)} <ArrowRight className="w-4 h-4" /></>}
          </button>
        </>
      ) : (
        <button type="button" onClick={start} disabled={busy || !name} className={btn} style={{ backgroundColor: brandColor || "#18181b" }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Get a ticket · {money(priceCents + feeCents)} <ArrowRight className="w-4 h-4" /></>}
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
