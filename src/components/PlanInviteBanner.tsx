"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { captureInviteCode, fetchPlanInvite, holdUntilLabel, inviteCodeFor, type PlanInviteInfo } from "@/lib/plan-invite";

// "Maya saved you a spot" on a plan opened from a friend's personal link
// (/p/<plan>?i=<code>). Shows nothing for a code that's been used, has
// expired, or belongs to another plan — the page is just the plan then.
// Mounting it also remembers the code for this plan, so the RSVP carries it.
export default function PlanInviteBanner({ planId, className = "" }: { planId: string; className?: string }) {
  const [info, setInfo] = useState<PlanInviteInfo | null>(null);

  useEffect(() => {
    const fresh = captureInviteCode(planId);
    const code = fresh || inviteCodeFor(planId);
    if (!code) return;
    let live = true;
    fetchPlanInvite(code, planId).then((r) => {
      if (!live || !r?.found) return;
      setInfo(r);
      if (fresh) track("plan_invite_arrival", { planId, holdsSeat: Boolean(r.holdsSeat), status: r.status || "open" });
    });
    return () => { live = false; };
  }, [planId]);

  if (!info?.found || (info.status !== "open" && info.status !== "claimed")) return null;
  // A used invite still says who sent it; only a live hold gets the countdown.
  const name = info.inviterFirstName || "A friend";
  const until = info.holdsSeat ? holdUntilLabel(info.expiresAt) : null;
  const headline = until ? `${name} saved you a spot` : `${name} invited you`;

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left ${className}`}>
      {info.inviterPhoto ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={info.inviterPhoto} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
      ) : (
        <span className="w-9 h-9 rounded-full bg-emerald-200 text-emerald-900 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm font-bold text-emerald-950">{headline}</p>
        {until ? (
          <p className="text-xs text-emerald-800">Held for you until {until}. RSVP to take it.</p>
        ) : info.status === "open" ? (
          <p className="text-xs text-emerald-800">RSVP below and {name} will know you&apos;re coming.</p>
        ) : null}
      </div>
    </div>
  );
}
