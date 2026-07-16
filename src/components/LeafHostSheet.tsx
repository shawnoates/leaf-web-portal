"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock, Loader2, X } from "lucide-react";
import Parse from "@/lib/parse-client";

// Shape returned by getCalendarHostingQuote. Kept narrow — only the
// fields the sheet renders. Server strips everything else.
interface HostablePlan {
  planId: string;
  title: string;
  dateISO: string | null;
  time: string | null;
  venueName: string | null;
}

interface Quote {
  calendarId: string;
  calendarName: string;
  persona: { id: string; name: string; avatarUrl: string | null };
  perPlanRate: number;
  maxGroupSize: number;
  turnaroundHours: number;
  hostablePlans: HostablePlan[];
  // Non-null when a hosting run is already active for this calendar —
  // Phase 3 uses this to render an "arranging" state instead of the
  // fresh-authorization form.
  inFlight: {
    hostingId: string;
    status: string;
    paymentStatus: string;
    planCount: number;
    quotedTotal: number;
  } | null;
}

interface Props {
  calendarId: string;
  onClose: () => void;
}

// Formats a plan's date + time into a single readable line. Falls back
// to bare time or bare date if either is missing.
function formatPlanWhen(plan: HostablePlan): string {
  if (!plan.dateISO && !plan.time) return "Date TBD";
  let datePart: string | null = null;
  if (plan.dateISO) {
    try {
      const d = new Date(plan.dateISO);
      datePart = d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      datePart = null;
    }
  }
  return [datePart, plan.time].filter(Boolean).join(" · ");
}

// Full-page overlay sheet — spec §4 pre-pay detail sheet.
//
// Order enforced by the layout below (not just by intent):
//   1. What Leaf does
//   2. Plan selection (§4a)
//   3. Capacity intake (§5)
//   4. Live quote with visible math
//   5. Fee-vs-tab line at full weight (§4)
//   6. Turnaround
//   7. Void/swap promise
//   8. Guarantee (§9)
//   9. Single confirm
//
// Phase 2 stub: Confirm shows an alert. Phase 3 replaces with a Stripe
// PaymentIntent authorize step + CalendarHosting record creation.
export default function LeafHostSheet({ calendarId, onClose }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Per-plan selection — the Set stores selected planIds. Defaults to
  // ALL selected once the quote lands (spec §4a: "Default: all
  // selected").
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Default capacity — a single number used at authorization time; the
  // per-plan capacity gets refined later in the concierge thread (spec
  // §5 "collect a default headcount for the calendar pre-payment").
  const [capacity, setCapacity] = useState<number>(6);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = (await Parse.Cloud.run("getCalendarHostingQuote", {
          calendarId,
        })) as Quote;
        if (cancelled) return;
        setQuote(result);
        setSelected(new Set(result.hostablePlans.map((p) => p.planId)));
        setLoadState("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Could not load hosting quote.");
        setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [calendarId]);

  const togglePlan = useCallback((planId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!quote) return;
    setSelected(new Set(quote.hostablePlans.map((p) => p.planId)));
  }, [quote]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  // Live quote total — spec §4 "Show the math, not just a total.
  // Updates live as the selection changes."
  const quoteTotal = useMemo(() => {
    if (!quote) return 0;
    return selected.size * quote.perPlanRate;
  }, [quote, selected]);

  const [authorizing, setAuthorizing] = useState(false);
  const [authorizeError, setAuthorizeError] = useState<string | null>(null);

  const canConfirm =
    selected.size > 0 &&
    capacity > 0 &&
    loadState === "ready" &&
    !authorizing &&
    !quote?.inFlight;

  // Fires the payment authorization flow. Server creates the Stripe
  // Checkout Session in manual-capture mode, mints the CalendarHosting
  // record in `pending` state, and returns the hosted checkout URL.
  // Browser redirects there; the webhook flips the record to
  // `arranging` before the user lands back at /org/[shareId].
  //
  // Error handling: on any failure the sheet stays open and surfaces
  // the reason. The CalendarHosting row may already exist server-side
  // (created before the Checkout Session call throws) but stays in
  // `pending`; the duplicate-in-flight guard covers this on retry.
  const handleConfirm = async () => {
    if (!quote || selected.size === 0) return;
    setAuthorizing(true);
    setAuthorizeError(null);
    try {
      const result = (await Parse.Cloud.run("authorizeCalendarHosting", {
        calendarId: quote.calendarId,
        selectedPlanIds: Array.from(selected),
        defaultCapacity: capacity,
        returnUrl:
          typeof window !== "undefined" ? window.location.href.split("?")[0] : undefined,
      })) as { checkoutUrl?: string; hostingId?: string };
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      throw new Error("Checkout session could not be created.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setAuthorizeError(msg);
      setAuthorizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-t-2xl md:rounded-2xl relative my-0 md:my-8 flex flex-col max-h-[95vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {loadState === "loading" && (
          <div className="py-24 flex flex-col items-center gap-3 text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Preparing your quote…</p>
          </div>
        )}

        {loadState === "error" && (
          <div className="py-16 px-8 text-center space-y-4">
            <AlertCircle className="w-8 h-8 mx-auto text-zinc-400" />
            <p className="text-sm text-zinc-600">{errorMsg}</p>
            <button
              onClick={onClose}
              className="text-sm text-zinc-500 hover:text-zinc-900 underline"
            >
              Close
            </button>
          </div>
        )}

        {loadState === "ready" && quote && (
          <>
            {/* Scrollable body */}
            <div className="overflow-y-auto p-8 md:p-10 space-y-8">
              {/* Header — persona face, brand promise. */}
              <div className="flex items-start gap-4">
                {quote.persona.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={quote.persona.avatarUrl}
                    alt=""
                    aria-hidden="true"
                    className="w-14 h-14 rounded-full object-cover ring-1 ring-zinc-200 flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-zinc-200 flex-shrink-0" />
                )}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Let Leaf host it
                  </p>
                  <h2 className="text-2xl font-light tracking-tight mt-1">
                    Hand your calendar to a real host.
                  </h2>
                  <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
                    We&rsquo;ll review every plan on {quote.calendarName}, secure
                    the reservations, and be your point of contact day-of.
                  </p>
                </div>
              </div>

              {/* 1. What Leaf does — spec §1 in plain language. */}
              <section className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  What Leaf does
                </p>
                <ul className="space-y-2 text-sm text-zinc-700">
                  {[
                    "Review each plan for fit, timing, and realism.",
                    "Validate the suggested venue — confirm it's real, open, and can actually take the booking.",
                    "Secure the reservation, or make the arrangements where a reservation isn't the mechanism.",
                    "Suggest improvements — better night, better room, better time for the group size.",
                    "Share tips: what to order, where to sit, when to arrive.",
                    "Send invites and reminders. Be a point of contact day-of.",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 2. Plan selection — spec §4a scope. */}
              <section className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Which plans should Leaf host?
                  </p>
                  {quote.hostablePlans.length > 1 && (
                    <div className="flex items-center gap-3 text-xs">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-zinc-500 hover:text-zinc-900 underline"
                      >
                        Select all
                      </button>
                      <span className="text-zinc-300">|</span>
                      <button
                        type="button"
                        onClick={selectNone}
                        className="text-zinc-500 hover:text-zinc-900 underline"
                      >
                        Select none
                      </button>
                    </div>
                  )}
                </div>
                {quote.hostablePlans.length === 0 ? (
                  <p className="text-sm text-zinc-500 italic py-4 border border-zinc-100 rounded-lg px-4">
                    No plans currently need a host. Add plans to the calendar to have Leaf host them.
                  </p>
                ) : (
                  <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100">
                    {quote.hostablePlans.map((plan) => {
                      const isSelected = selected.has(plan.planId);
                      return (
                        <label
                          key={plan.planId}
                          className="flex items-start gap-3 p-4 cursor-pointer hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => togglePlan(plan.planId)}
                            className="w-4 h-4 accent-zinc-900 rounded mt-0.5 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 truncate">
                              {plan.title}
                            </p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {formatPlanWhen(plan)}
                              {plan.venueName ? ` · ${plan.venueName}` : ""}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 3. Capacity intake — spec §5. Cap at maxGroupSize; above
                  routes to manual (see disabled state). Per-plan capacity
                  refinement happens after payment. */}
              <section className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  About how many people are you planning for?
                </p>
                <div className="flex items-baseline gap-3">
                  <input
                    type="number"
                    min={1}
                    max={quote.maxGroupSize}
                    value={capacity}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v)) setCapacity(Math.max(1, Math.min(quote.maxGroupSize, v)));
                    }}
                    className="w-24 border border-zinc-200 rounded-lg px-3 py-2 text-lg font-light focus:outline-none focus:border-zinc-400"
                  />
                  <span className="text-sm text-zinc-500">people, on average</span>
                </div>
                <p className="text-xs text-zinc-500">
                  Larger than {quote.maxGroupSize}? Most venues switch to
                  large-party contracts above that. Reach out and we&rsquo;ll
                  quote it manually.
                </p>
              </section>

              {/* 4. Live quote — spec §4 "Show the math". */}
              <section className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Your quote
                </p>
                <div className="border border-zinc-200 rounded-xl px-5 py-4 space-y-2">
                  <div className="flex items-baseline justify-between text-sm text-zinc-600">
                    <span>
                      {selected.size} plan{selected.size === 1 ? "" : "s"} × ${quote.perPlanRate}
                    </span>
                    <span className="text-3xl font-light text-zinc-900">
                      ${quoteTotal}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Authorized on submit. Captured only after every selected plan is secured and you&rsquo;ve approved.
                  </p>
                </div>
              </section>

              {/* 5. Fee-vs-tab — spec §4 mandatory, prominent, NOT fine
                  print. Rendered at full weight as an inline callout. */}
              <section>
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                  <p className="text-sm font-medium text-zinc-900 leading-relaxed">
                    <span className="font-bold">${quoteTotal || quote.perPlanRate}</span>{" "}
                    covers planning, booking, and running your calendar.
                    Drinks and food are on your group, paid at the venue.
                  </p>
                </div>
              </section>

              {/* 6. Turnaround. */}
              <section className="flex items-start gap-3 text-sm text-zinc-600">
                <Clock className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                <p>
                  Your validated plans, ready to review, within{" "}
                  <span className="font-medium text-zinc-900">
                    {quote.turnaroundHours} hours
                  </span>
                  .
                </p>
              </section>

              {/* 7. Void/swap promise. */}
              <section className="text-sm text-zinc-600 leading-relaxed">
                <p>
                  If a venue can&rsquo;t be secured, we&rsquo;ll swap it for
                  something comparable. If we still can&rsquo;t deliver, the
                  authorization is voided — we never charge for a plan we
                  couldn&rsquo;t secure.
                </p>
              </section>

              {/* 8. Guarantee — spec §9. */}
              <section className="text-sm text-zinc-600 leading-relaxed border-t border-zinc-100 pt-6">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
                  Guarantee
                </p>
                <p>
                  Money-back on your first Leaf-hosted calendar. If we
                  deliver only some of the plans, we refund the difference —
                  no support ticket, no back-and-forth.
                </p>
              </section>
            </div>

            {/* 9. Single confirm — sticky footer so the CTA is visible
                even when the sheet body is scrolled. */}
            <div className="border-t border-zinc-100 px-8 md:px-10 py-5 bg-white rounded-b-2xl space-y-3">
              {authorizeError && (
                <div className="flex items-start gap-2 text-xs text-red-600">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{authorizeError}</p>
                </div>
              )}
              {quote.inFlight ? (
                <div className="flex items-start gap-3 text-sm text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3">
                  <Clock className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
                  <p>
                    <span className="font-medium">
                      {quote.persona.name} is already working on this calendar.
                    </span>{" "}
                    Once every plan is delivered, you&rsquo;ll be able to add more.
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="w-full bg-zinc-900 text-white py-3.5 text-xs uppercase tracking-widest font-bold rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {authorizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecting to Stripe…
                    </>
                  ) : selected.size === 0 ? (
                    "Select at least one plan"
                  ) : (
                    `Authorize $${quoteTotal} — Let ${quote.persona.name} host it`
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
