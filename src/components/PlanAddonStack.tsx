"use client";

/**
 * The add-on option stack — design §1 and §2.
 *
 * Shown once, on the RSVP confirmation step, when the plan has at least one
 * live add-on. Three states in one slot: the stack, then card entry, then
 * Added. The block's bounds never change between them.
 *
 * Uses the vanilla Stripe Elements API rather than @stripe/react-stripe-js,
 * which is not a dependency of this app and is not worth adding for one
 * mount point.
 *
 * NOTHING HERE DECIDES A PRICE. The component sends PlanAddon ids and renders
 * the total the server computed; a client that could name its own price would
 * be the whole vulnerability.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import { loadStripe, type Stripe, type StripeElements } from "@stripe/stripe-js";

interface Addon {
  objectId: string;
  frameworkSlug: string;
  title: string;
  description: string | null;
  priceCents: number;
  imageUrl: string | null;
}

interface Purchased {
  objectId: string;
  planAddonId: string | null;
  title: string | null;
  quantity: number;
  grossCents: number;
  status: string;
}

/** `$6`, never `$6.00` — the design is explicit about this. */
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

type Step = "stack" | "card" | "added" | "declined";

export default function PlanAddonStack({
  eventGroupId,
  phoneNumber,
  name,
  startIso,
  onDismiss,
}: {
  eventGroupId: string;
  phoneNumber: string;
  name?: string;
  startIso?: string | null;
  onDismiss?: () => void;
}) {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [purchased, setPurchased] = useState<Purchased[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("stack");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  // Comes back WITH the order rather than from an env var, so the key that
  // renders the card form can never be from a different Stripe mode than the
  // secret key that created the intent.
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [totalCents, setTotalCents] = useState(0);
  const stripeRef = useRef<Stripe | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const cardMountRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await Parse.Cloud.run("getPlanAddonsForGuest", { eventGroupId, phoneNumber });
      setAddons(r?.addons || []);
      setPurchased(r?.purchased || []);
      if ((r?.purchased || []).length > 0) setStep("added");
    } catch {
      // A stack that cannot load is a stack that does not render. An RSVP that
      // already succeeded must never look broken because of an upsell.
      setAddons([]);
    } finally {
      setLoading(false);
    }
  }, [eventGroupId, phoneNumber]);

  useEffect(() => {
    load();
  }, [load]);

  // Mount the Payment Element once we have a client secret and the div exists.
  useEffect(() => {
    if (step !== "card" || !clientSecret || !cardMountRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        const pk = publishableKey;
        if (!pk) throw new Error("Payments are not configured.");
        const stripe = stripeRef.current || (await loadStripe(pk));
        if (cancelled || !stripe) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: { borderRadius: "8px", colorPrimary: "#18181b", fontFamily: "inherit" },
          },
        });
        elementsRef.current = elements;
        elements.create("payment", { layout: "tabs" }).mount(cardMountRef.current!);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load card entry");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, clientSecret, publishableKey]);

  const sum = selected.reduce(
    (t, id) => t + (addons.find((a) => a.objectId === id)?.priceCents || 0),
    0
  );

  async function startOrder() {
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await Parse.Cloud.run("createPlanAddonOrder", {
        eventGroupId,
        planAddonIds: selected,
        phoneNumber,
        name,
      });
      setClientSecret(r.clientSecret);
      setPublishableKey(r.publishableKey || null);
      setTotalCents(r.totalCents);
      setStep("card");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start that");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    const stripe = stripeRef.current;
    const elements = elementsRef.current;
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    // `redirect: "if_required"` keeps card payments inline. A method that
    // genuinely needs a redirect still gets one; we simply have no return_url
    // worth sending people to mid-RSVP for the methods we expect.
    const { error: err } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (err) {
      setError(err.message || "That didn't go through.");
      setBusy(false);
      return;
    }
    // Paid. The webhook is what actually marks the rows paid, and it may not
    // have landed yet — so re-read rather than asserting success locally.
    await load();
    setStep("added");
    setBusy(false);
  }

  if (loading) return null;
  if (step === "declined") return null;
  if (addons.length === 0 && purchased.length === 0) return null;

  const heading = `Add to ${momentWord(startIso || null)}`;

  return (
    <div className="border-t border-b border-zinc-100 py-[18px] flex flex-col gap-[14px] text-left">
      {step === "stack" && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-[15px] leading-5 font-medium text-zinc-900">{heading}</p>
            <p className="text-xs leading-[18px] text-zinc-500">
              Prices include tax. One charge for whatever&apos;s ticked.
            </p>
          </div>

          <div className="flex flex-col gap-[10px]">
            {addons.map((a) => {
              const on = selected.includes(a.objectId);
              return (
                <button
                  key={a.objectId}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() =>
                    setSelected((p) =>
                      on ? p.filter((x) => x !== a.objectId) : [...p, a.objectId]
                    )
                  }
                  // Selected grows the border inward so nothing shifts.
                  className={`flex gap-[14px] items-start text-left rounded-xl box-border min-h-[44px] ${
                    on ? "border-2 border-zinc-900 p-[15px]" : "border border-zinc-200 p-4"
                  }`}
                >
                  {a.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.imageUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover bg-zinc-100 flex-none"
                    />
                  )}
                  <span className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-[15px] leading-5 font-medium text-zinc-900">
                        {a.title}
                      </span>
                      <span
                        className={`w-5 h-5 rounded flex-none flex items-center justify-center ${
                          on ? "bg-zinc-900" : "border-[1.5px] border-zinc-300 bg-white"
                        }`}
                      >
                        {on && (
                          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                            <path
                              d="M1 5l3.5 3.5L11 1.5"
                              stroke="#fff"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                    </span>
                    {a.description && (
                      <span className="text-[13px] leading-[19px] text-zinc-500 -mt-1">
                        {a.description}
                      </span>
                    )}
                    <span className="text-[15px] leading-5 font-medium text-zinc-900">
                      {money(a.priceCents)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {error && <p className="text-[13px] text-red-700">{error}</p>}

          <div className="flex flex-col gap-3">
            <button
              onClick={startOrder}
              disabled={selected.length === 0 || busy}
              className="w-full h-12 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-[0.05em] disabled:opacity-50"
            >
              {busy ? "One moment…" : selected.length === 0 ? "Add it" : `Add it · ${money(sum)}`}
            </button>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] leading-4 text-zinc-400">
                Card entry next. Nothing&apos;s charged yet.
              </span>
              <button
                onClick={() => {
                  setStep("declined");
                  onDismiss?.();
                }}
                className="text-xs font-bold uppercase tracking-[0.05em] text-zinc-600"
              >
                No thanks
              </button>
            </div>
          </div>
        </>
      )}

      {step === "card" && (
        <>
          <p className="text-[15px] leading-5 font-medium text-zinc-900">{heading}</p>
          <div className="flex flex-col gap-2">
            {selected.map((id) => {
              const a = addons.find((x) => x.objectId === id);
              if (!a) return null;
              return (
                <div key={id} className="flex justify-between text-[13px] leading-[19px] text-zinc-600">
                  <span>{a.title}</span>
                  <span>{money(a.priceCents)}</span>
                </div>
              );
            })}
            <div className="flex justify-between text-[15px] leading-5 font-medium text-zinc-900 border-t border-zinc-100 pt-2">
              <span>Total</span>
              <span>{money(totalCents)}</span>
            </div>
          </div>

          <div ref={cardMountRef} className="border border-zinc-200 rounded-lg p-3" />

          {error && <p className="text-[13px] text-red-700">{error}</p>}

          <button
            onClick={pay}
            disabled={busy}
            className="w-full h-12 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-[0.05em] disabled:opacity-50"
          >
            {busy ? "Paying…" : `Pay ${money(totalCents)}`}
          </button>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] leading-4 text-zinc-400">
              Full card entry every time. No saved cards in v1.
            </span>
            <button
              onClick={() => {
                setStep("stack");
                setError(null);
              }}
              className="text-xs font-bold uppercase tracking-[0.05em] text-zinc-700"
            >
              Back
            </button>
          </div>
        </>
      )}

      {step === "added" && purchased.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap text-[15px] leading-5 font-medium text-zinc-900">
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden="true">
              <path
                d="M1 6l4 4 8-8.5"
                stroke="#059669"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              You&apos;re in for{" "}
              {purchased
                .map((p) => (p.title || "your add-on").toLowerCase())
                .join(" and ")}
            </span>
          </div>
          <p className="text-xs leading-[18px] text-zinc-500">
            {money(purchased.reduce((t, p) => t + (p.grossCents || 0), 0))}, one charge.
            {purchased.some((p) => p.status === "pending")
              ? " Confirming with your bank — this page is safe to close."
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}
