"use client";

/**
 * The card on file for bars and restaurants. Stripe's Payment Element is
 * mounted into a div; the parent calls `save()` (through the ref) when the
 * merchant taps the main button, so saving the card and accepting is one tap.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";
import Parse from "@/lib/parse-client";

export type Card = { brand: string; last4: string; exp: string; email?: string };
export type CardSetupHandle = { save: () => Promise<Card | null>; hasSavedCard: () => boolean };

const BRAND: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover" };

const CardSetup = forwardRef<
  CardSetupHandle,
  { token: string; card: Card | null; onSaved: (c: Card) => void; feeCents?: number; firstNightFree?: boolean; hostFeeCents?: number }
>(
  function CardSetup({ token, card, onSaved, feeCents = 600, firstNightFree = false, hostFeeCents = 0 }, ref) {
    const fee = `$${Number.isInteger(feeCents / 100) ? feeCents / 100 : (feeCents / 100).toFixed(2)}`;
    const [editing, setEditing] = useState(!card);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountRef = useRef<HTMLDivElement>(null);
    const stripeRef = useRef<Stripe | null>(null);
    const elementsRef = useRef<StripeElements | null>(null);

    useEffect(() => {
      if (!editing || !mountRef.current) return;
      let cancelled = false;
      setReady(false);
      (async () => {
        try {
          const s = (await Parse.Cloud.run("createMerchantCardSetup", { token })) as { clientSecret: string; publishableKey: string };
          if (!s.publishableKey) throw new Error("Card entry isn't available right now.");
          const stripe = await loadStripe(s.publishableKey);
          if (cancelled || !stripe || !mountRef.current) return;
          stripeRef.current = stripe;
          const elements = stripe.elements({
            clientSecret: s.clientSecret,
            appearance: {
              theme: "stripe",
              variables: { borderRadius: "12px", colorPrimary: "#253A33", fontFamily: "inherit", fontSizeBase: "16px" },
            },
          });
          elementsRef.current = elements;
          const el = elements.create("payment", { layout: "tabs", wallets: { applePay: "auto", googlePay: "auto" } });
          el.on("ready", () => !cancelled && setReady(true));
          el.mount(mountRef.current);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load card entry.");
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [editing, token]);

    useImperativeHandle(ref, () => ({
      hasSavedCard: () => Boolean(card) && !editing,
      save: async () => {
        if (card && !editing) return card;
        const stripe = stripeRef.current;
        const elements = elementsRef.current;
        if (!stripe || !elements) throw new Error("Add a card to hold your first free night.");
        const { error: err, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required" });
        if (err) throw new Error(err.message || "That card didn't save.");
        if (!setupIntent) throw new Error("That card didn't save.");
        const r = (await Parse.Cloud.run("saveMerchantCard", { token, setupIntentId: setupIntent.id })) as { card: Card };
        setEditing(false);
        onSaved(r.card);
        return r.card;
      },
    }));

    if (card && !editing) {
      return (
        <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3.5">
          <div>
            <p className="text-[15px] font-medium text-stone-900">
              {card.brand === "link"
                ? `Link${card.email ? ` · ${card.email}` : ""}`
                : card.last4
                  ? `${BRAND[card.brand] || "Card"} ending ${card.last4}`
                  : BRAND[card.brand] || "Payment method saved"}
            </p>
            {card.exp && <p className="text-[13px] text-stone-500">Expires {card.exp}</p>}
            <p className="mt-1 text-[13px] leading-snug text-stone-500">{`Leaf charges ${card.brand === "link" ? "this Link account" : "this card"} ${fee} per RSVP after each night.`}</p>
          </div>
          <button type="button" onClick={() => setEditing(true)} className="min-h-11 px-2 text-[14px] font-semibold text-leaf-700">
            Change
          </button>
        </div>
      );
    }
    return (
      <div>
        <div ref={mountRef} className={ready || error ? "" : "min-h-40"} />
        {!ready && !error && <p className="text-[14px] text-stone-500">Loading secure card entry…</p>}
        {error && <p className="mt-2 text-[14px] text-red-600">{error}</p>}
        {/* Consent for charges made later, when the merchant isn't here (off-session). */}
        <p className="mt-3 text-[13px] leading-snug text-stone-600">
          {`By saving your card, you authorize Leaf to charge it ${fee} per RSVP after each Leaf night at your place, counted 2 hours before the night and never more than you seat${
            hostFeeCents > 0 ? `, plus $${Math.round(hostFeeCents / 100)} for any night you ask a Leaf host to run` : ""
          }. ${firstNightFree ? `Your first night's RSVPs are free. ` : ""}Nights with fewer than 5 RSVPs cost nothing. After your first night, nights come out of a Leaf balance: when you book a night and your balance is under $18, we add $60 to it from this card, and anything the balance doesn't cover is charged after the night. You can turn auto reload off on this page. Nothing is charged today. You can remove your card or stop anytime by replying to Shawn. `}
          <a href="/terms-conditions" target="_blank" className="underline">
            Terms
          </a>
          {" · "}
          <a href="/privacy-policy" target="_blank" className="underline">
            Privacy
          </a>
        </p>
        <p className="mt-1.5 text-[12px] text-stone-400">Saved securely with Stripe.</p>
      </div>
    );
  },
);

export default CardSetup;
