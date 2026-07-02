"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { X } from "lucide-react";

type Subscription =
  | "pending"
  | "active"
  | "cancelling"
  | "past_due"
  | "paused"
  | "cancelled"
  | null;

interface BannerState {
  loading: boolean;
  visible: boolean;
  kind:
    | "none"
    | "eligible"
    | "enrolling"
    | "cancelling"
    | "paused_voluntary"
    | "paused_involuntary"
    | "past_due";
  periodEnd?: Date;
  resumeAt?: Date;
}

/**
 * Concierge state banner for the owner dashboard.
 *
 * Surfaces the highest-priority transient state:
 *   - eligible / invited            → "Start enrollment" CTA
 *   - cancel_scheduled               → "Concierge ends Aug 31. [Restore]"
 *   - paused voluntary               → "Resumes Oct 1"
 *   - paused involuntary / past_due  → "Update your card"
 *
 * Dismissible only for `eligible` — the others are actionable state.
 */
export default function ConciergeDashboardBanner({ calendarId }: { calendarId: string }) {
  const [state, setState] = useState<BannerState>({ loading: true, visible: false, kind: "none" });
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ParseAny = Parse as any;

  const load = async () => {
    try {
      const cal = await new ParseAny.Query("Groups").get(calendarId);
      const eligibility = cal.get("conciergeEligibilityState") || "not_eligible";
      const sub: Subscription = cal.get("conciergeSubscriptionStatus") || null;
      const cancelAt = cal.get("conciergeSubscriptionCancelAt");
      const resumeAt = cal.get("conciergePauseResumeAt");
      const pauseReason = cal.get("conciergePauseReason");

      let kind: BannerState["kind"] = "none";
      if (sub === "cancelling") kind = "cancelling";
      else if (sub === "paused") {
        kind = pauseReason === "involuntary_past_due" ? "paused_involuntary" : "paused_voluntary";
      } else if (sub === "past_due") kind = "past_due";
      // Started enrollment (checkout created) but hasn't completed payment.
      else if (eligibility === "enrolling" || sub === "pending") kind = "enrolling";
      else if (["eligible", "invited"].includes(eligibility) && !["active", "pending"].includes(sub || ""))
        kind = "eligible";

      setState({
        loading: false,
        visible: kind !== "none",
        kind,
        periodEnd: cancelAt ? new Date(cancelAt) : undefined,
        resumeAt: resumeAt ? new Date(resumeAt) : undefined,
      });
    } catch (err) {
      console.warn("[Concierge] banner load failed:", err);
      setState({ loading: false, visible: false, kind: "none" });
    }
  };

  useEffect(() => {
    const key = `concierge_banner_dismissed_${calendarId}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(key) === "1") {
      setDismissed(true);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarId]);

  const handleRestore = async () => {
    setActing(true);
    setError(null);
    try {
      await ParseAny.Cloud.run("restoreConciergeSubscription", { calendarId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore.");
    } finally {
      setActing(false);
    }
  };

  const handleResume = async () => {
    setActing(true);
    setError(null);
    try {
      await ParseAny.Cloud.run("resumeConciergeSubscription", { calendarId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resume.");
    } finally {
      setActing(false);
    }
  };

  const handleBillingPortal = async () => {
    setActing(true);
    setError(null);
    try {
      const result = await ParseAny.Cloud.run("createOrgBillingPortalSession", {
        calendarId,
        returnUrl: typeof window !== "undefined" ? window.location.href : undefined,
      });
      if (result?.url) window.location.href = result.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal.");
      setActing(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`concierge_banner_dismissed_${calendarId}`, "1");
    }
  };

  if (state.loading || !state.visible || dismissed) return null;

  const formatDate = (d?: Date) =>
    d
      ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : "";

  return (
    <div className="bg-zinc-900 text-white border-b border-zinc-800">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0 text-sm">
          {state.kind === "eligible" && (
            <>
              <strong className="font-semibold">You&apos;re invited to enroll in Concierge.</strong>{" "}
              <span className="text-zinc-300">
                Bring on a dedicated host to run your calendar and host plans for your community, every month. We run them, you choose.
              </span>
            </>
          )}
          {state.kind === "enrolling" && (
            <>
              <strong className="font-semibold">Finish setting up Concierge.</strong>{" "}
              <span className="text-zinc-300">
                You started enrolling — pick up where you left off.
              </span>
            </>
          )}
          {state.kind === "cancelling" && (
            <>
              <strong className="font-semibold">
                Concierge ends {formatDate(state.periodEnd)}.
              </strong>{" "}
              <span className="text-zinc-300">Changed your mind?</span>
            </>
          )}
          {state.kind === "paused_voluntary" && (
            <>
              <strong className="font-semibold">Concierge is paused.</strong>{" "}
              <span className="text-zinc-300">Resumes {formatDate(state.resumeAt)}.</span>
            </>
          )}
          {state.kind === "paused_involuntary" && (
            <>
              <strong className="font-semibold">Update your card to resume Concierge.</strong>{" "}
              <span className="text-zinc-300">Billing on your last subscription failed.</span>
            </>
          )}
          {state.kind === "past_due" && (
            <>
              <strong className="font-semibold">Your Concierge payment didn&apos;t go through.</strong>{" "}
              <span className="text-zinc-300">Update your card to avoid interruption.</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {state.kind === "eligible" && (
            <Link
              href={`/organizations/enroll/${calendarId}`}
              className="bg-white text-zinc-900 px-4 py-2 text-xs font-semibold rounded-full hover:bg-white/90"
            >
              Start enrollment
            </Link>
          )}
          {state.kind === "enrolling" && (
            <Link
              href={`/organizations/enroll/${calendarId}`}
              className="bg-white text-zinc-900 px-4 py-2 text-xs font-semibold rounded-full hover:bg-white/90"
            >
              Resume enrollment
            </Link>
          )}
          {state.kind === "cancelling" && (
            <button
              onClick={handleRestore}
              disabled={acting}
              className="bg-white text-zinc-900 px-4 py-2 text-xs font-semibold rounded-full hover:bg-white/90 disabled:opacity-60"
            >
              {acting ? "Restoring…" : "Restore"}
            </button>
          )}
          {state.kind === "paused_voluntary" && (
            <button
              onClick={handleResume}
              disabled={acting}
              className="bg-white text-zinc-900 px-4 py-2 text-xs font-semibold rounded-full hover:bg-white/90 disabled:opacity-60"
            >
              {acting ? "Resuming…" : "Resume now"}
            </button>
          )}
          {(state.kind === "paused_involuntary" || state.kind === "past_due") && (
            <button
              onClick={handleBillingPortal}
              disabled={acting}
              className="bg-white text-zinc-900 px-4 py-2 text-xs font-semibold rounded-full hover:bg-white/90 disabled:opacity-60"
            >
              {acting ? "Opening…" : "Update card"}
            </button>
          )}
          {state.kind === "eligible" && (
            <button
              onClick={handleDismiss}
              className="text-zinc-400 hover:text-white p-1"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="max-w-5xl mx-auto px-6 pb-3 text-xs text-red-300">{error}</div>
      )}
    </div>
  );
}
