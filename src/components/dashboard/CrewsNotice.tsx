"use client";

/**
 * One-time heads-up for calendar owners: crew suggestions are on by default
 * and the switch lives in the calendar's settings, so tell them once rather
 * than let a follower's crew be the surprise. The setting is per calendar,
 * but the notice is once per owner (this browser): shown on the first
 * calendar they open that has it on, it says it's on for each calendar and
 * links to this one's switch. Gone for good once dismissed or followed.
 * The server gates getCalendarCrewSuggestions, so non-owners never see it.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";

const SEEN_KEY = "leaf.crewsNotice";

export default function CrewsNotice({ orgId, calendarId }: { orgId: string; calendarId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }
    let live = true;
    Parse.Cloud.run("getCalendarCrewSuggestions", { calendarId })
      .then((r: unknown) => { if (live && (r as { on?: boolean })?.on) setShow(true); })
      .catch(() => {});
    return () => { live = false; };
  }, [calendarId]);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* ignore */ }
  };

  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
      <div className="min-w-0 flex-1 text-xs text-zinc-500">
        <p className="text-sm font-medium text-zinc-900">Your followers can form crews</p>
        <p className="mt-0.5 max-w-xl">
          A crew is a small group of your followers who make their own plans together. When the same
          people keep coming to your plans, Leaf invites them to start one, beginning with your places.
          It&apos;s on by default for each of your calendars; you can turn it off per calendar.{" "}
          <Link
            href={`/dashboard/${orgId}/calendars/${calendarId}/edit`}
            onClick={dismiss}
            className="font-medium text-zinc-900 underline"
          >
            Settings for this calendar
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full px-1.5 text-lg leading-none text-zinc-400 hover:text-zinc-900"
      >
        ×
      </button>
    </div>
  );
}
