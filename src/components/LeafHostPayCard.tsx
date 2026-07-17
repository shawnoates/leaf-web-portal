"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock, Loader2 } from "lucide-react";
import Parse from "@/lib/parse-client";

// Payload shapes shared with LeafHostThread. Kept narrow — server
// endpoint owns the source of truth.
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
  perPlanRate: number;
  maxGroupSize: number;
  turnaroundHours: number;
  hostablePlans: HostablePlan[];
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
  perPlanRate: number;
  maxGroupSize: number;
  turnaroundHours: number;
  personaName: string;
  inFlight: Quote["inFlight"] | null;
  onAuthorized: () => void;
  onCloseDrawer: () => void;
}

// Format the plan's when-line. Server sends `dateISO` (full ISO
// timestamp) and sometimes a separate `time` string (from
// EventDetail.time_event). Prefer the explicit `time` when present;
// otherwise pull the time from the ISO. Rendering something for time
// on every plan matters — an empty right side reads as "date only,
// unclear when" and drops confidence.
function formatPlanWhen(plan: HostablePlan): string {
  if (!plan.dateISO && !plan.time) return "Date TBD";
  let datePart: string | null = null;
  let timePart: string | null = null;
  if (plan.dateISO) {
    try {
      const d = new Date(plan.dateISO);
      datePart = d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      // Only derive time from the ISO when the server didn't send one
      // explicitly — the explicit `time` may be a curated string
      // (\"7:00 PM\") we shouldn't overwrite.
      if (!plan.time) {
        timePart = d.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        });
      }
    } catch {
      datePart = null;
    }
  }
  return [datePart, plan.time || timePart].filter(Boolean).join(" · ");
}

// Inline pay card that renders as a special message-kind in the
// leaf-host chat drawer. Owns:
//   * Fetching the fresh quote (server may have added/removed hostable
//     plans since the thread intro was seeded).
//   * Plan selection + capacity intake.
//   * Live-updating total with visible math.
//   * The Authorize confirm → Stripe redirect.
// Reuses the same authorizeCalendarHosting cloud fn the earlier
// LeafHostSheet used, so the entire payment lifecycle server-side is
// unchanged.
export default function LeafHostPayCard({
  calendarId,
  perPlanRate,
  maxGroupSize,
  personaName,
  inFlight,
  onCloseDrawer,
}: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [capacity, setCapacity] = useState<number>(6);
  const [authorizing, setAuthorizing] = useState(false);
  const [authorizeError, setAuthorizeError] = useState<string | null>(null);

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
        setErrorMsg(
          err instanceof Error ? err.message : "Couldn't load your quote.",
        );
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

  const quoteTotal = useMemo(
    () => selected.size * perPlanRate,
    [selected, perPlanRate],
  );

  const canConfirm =
    selected.size > 0 && capacity > 0 && !authorizing && !inFlight;

  const handleConfirm = async () => {
    if (!quote || selected.size === 0) return;
    setAuthorizing(true);
    setAuthorizeError(null);
    try {
      const result = (await Parse.Cloud.run("authorizeCalendarHosting", {
        calendarId,
        selectedPlanIds: Array.from(selected),
        defaultCapacity: capacity,
        returnUrl:
          typeof window !== "undefined"
            ? window.location.href.split("?")[0]
            : undefined,
      })) as { checkoutUrl?: string };
      if (result?.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      throw new Error("Checkout could not be created.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't authorize.";
      setAuthorizeError(msg);
      setAuthorizing(false);
    }
  };

  // In-flight state — persona is already working. Card collapses to
  // a compact "on it" panel instead of showing the confirm form.
  if (inFlight) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 max-w-[85%]">
        <div className="flex items-start gap-2">
          <Clock className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-zinc-900">
              I&rsquo;m already on it.
            </p>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              {inFlight.planCount} plan{inFlight.planCount === 1 ? "" : "s"},
              ${inFlight.quotedTotal} authorized. You&rsquo;ll hear from me
              with the validated set shortly.
            </p>
            <button
              type="button"
              onClick={onCloseDrawer}
              className="mt-3 text-xs font-medium text-zinc-600 hover:text-zinc-900 underline"
            >
              Close for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadState === "loading") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 max-w-[85%]">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <p className="text-sm">Pulling together your quote…</p>
        </div>
      </div>
    );
  }

  if (loadState === "error" || !quote) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 max-w-[85%]">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            {errorMsg || "Couldn't load your quote."}
          </p>
        </div>
      </div>
    );
  }

  if (quote.hostablePlans.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 max-w-[85%]">
        <p className="text-sm text-zinc-600 leading-relaxed">
          There aren&rsquo;t any hostable plans right now — add or generate
          some, and I&rsquo;ll pick this back up.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden max-w-[92%]">
      <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/60">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
          Authorize hosting
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Card is authorized now, charged only after every selected plan is
          secured and you&rsquo;ve approved.
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Plan selection — the operative choice. Checkboxes right at
            the top of the card so the owner acts, not reads. */}
        <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100">
          {quote.hostablePlans.map((plan) => {
            const isSelected = selected.has(plan.planId);
            return (
              <label
                key={plan.planId}
                className="flex items-start gap-3 p-3 cursor-pointer hover:bg-zinc-50 first:rounded-t-xl last:rounded-b-xl"
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
                    {plan.venueName && plan.venueName !== plan.title
                      ? ` · ${plan.venueName}`
                      : ""}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Capacity intake — kept as a single row so the card doesn't
            balloon. The "> cap? manual quote" nudge stays intentionally
            terse; the fee-disclaimer message above the card carries the
            full-weight warning per spec §4. */}
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs font-medium text-zinc-600">
            About how many people?
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={maxGroupSize}
              value={capacity}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v))
                  setCapacity(Math.max(1, Math.min(maxGroupSize, v)));
              }}
              className="w-20 border border-zinc-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-zinc-400"
            />
            <span className="text-xs text-zinc-500">up to {maxGroupSize}</span>
          </div>
        </div>

        {/* Live total. */}
        <div className="border-t border-zinc-100 pt-3 flex items-baseline justify-between">
          <span className="text-xs text-zinc-500">
            {selected.size} plan{selected.size === 1 ? "" : "s"} × $
            {perPlanRate}
          </span>
          <span className="text-2xl font-light text-zinc-900">
            ${quoteTotal}
          </span>
        </div>

        {/* Fee-vs-tab at point-of-decision. The persona already said
            this upfront in the chat, but by the time the owner has
            scrolled through plan selection + capacity they may have
            lost that beat — repeating it here (compact, muted) keeps
            the disclosure unmissable per spec §4 without duplicating
            visual weight. */}
        <div className="rounded-lg bg-amber-50/70 border border-amber-100 px-3 py-2">
          <p className="text-[11px] text-zinc-700 leading-snug">
            <span className="font-semibold">${quoteTotal || perPlanRate}</span>{" "}
            covers planning, booking, and running your calendar. Drinks
            and food are on your group, paid at the venue.
          </p>
        </div>

        {authorizeError && (
          <div className="flex items-start gap-2 text-xs text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{authorizeError}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          className="w-full bg-zinc-900 text-white py-3 text-xs uppercase tracking-widest font-bold rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {authorizing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to Stripe…
            </>
          ) : selected.size === 0 ? (
            "Select at least one plan"
          ) : (
            <>
              <Check className="w-4 h-4" />
              Authorize ${quoteTotal} — Let {personaName} run it
            </>
          )}
        </button>
      </div>
    </div>
  );
}
