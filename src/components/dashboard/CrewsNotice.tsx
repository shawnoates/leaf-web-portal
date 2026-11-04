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
    setShow(false);
  };

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      <p className="min-w-0 truncate">
        <span className="font-medium text-zinc-900">Crews are on.</span>{" "}
        <span className="hidden sm:inline">Regulars at your plans get invited to make their own plans together, starting with your places.</span>
        <span className="sm:hidden">Regulars can make plans together.</span>
      </p>
      <Link
        href={`/dashboard/${orgId}/calendars/${calendarId}/edit`}
        onClick={dismiss}
        className="shrink-0 font-medium text-zinc-900 underline-offset-2 hover:underline"
      >
        Settings
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 px-1 text-sm leading-none text-zinc-400 hover:text-zinc-900"
      >
        ×
      </button>
    </div>
  );
}
