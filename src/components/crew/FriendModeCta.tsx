"use client";

/**
 * "Keep seeing these people?" — the Friend Mode nudge on a plan's recap (/m/)
 * and plan (/p/) pages. Leads to /crew/start?from=<plan>, where the people
 * from that plan are offered as chips (names only, and only once the
 * visitor is signed in).
 */

import Link from "next/link";
import { useEffect } from "react";
import { trackMarketingEvent } from "@/components/marketing/analytics";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";

export default function FriendModeCta({
  eventGroupId,
  surface,
  peopleCount = 0,
  className = "",
}: {
  eventGroupId: string;
  surface: "recap" | "plan";
  peopleCount?: number;
  className?: string;
}) {
  useEffect(() => { trackMarketingEvent("friend_mode_cta_view", { surface }); }, [surface]);
  const others = Math.max(0, peopleCount - 1);
  return (
    <div className={`rounded-xl border border-dashed border-leaf-300 bg-leaf-50/50 p-4 ${className}`}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-leaf-600"><FriendModeIcon size={24} /> Friend Mode</div>
      <p className="mt-1 text-sm text-leaf-900">
        {surface === "recap" ? "Keep seeing these people?" : "Like this crowd?"}{" "}
        Start a crew and Leaf finds a night that works for all of you, then plans it.
        {others > 1 ? ` The ${others} others from this plan are one tap away.` : ""}
      </p>
      <Link
        href={`/crew/start?from=${encodeURIComponent(eventGroupId)}`}
        onClick={() => trackMarketingEvent("friend_mode_cta_click", { surface })}
        className="mt-3 inline-flex rounded-full bg-leaf-800 px-4 py-2 text-sm font-medium text-white hover:bg-leaf-700"
      >
        Start a crew
      </Link>
    </div>
  );
}
