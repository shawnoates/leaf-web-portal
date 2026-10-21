"use client";

/**
 * "You've been to 3 of these with Maya and Dev. Make it a crew?" After an
 * RSVP on a calendar's page, or on the recap after one of its plans. The
 * server decides whether to show it (getCrewNudge): real people only (two
 * or more plans together in 90 days), not people already in a crew with
 * them, at most once a month, never on a calendar that turned it off. Start
 * opens Start a crew with them picked, credited to the calendar, its places
 * offered for the book.
 */

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import StartCrewModal from "@/components/crew/StartCrewModal";
import type { CrewPerson } from "@/components/crew/StartCrewForm";
import { track } from "@/lib/track";

type Nudge = { people: (CrewPerson & { avatar?: string | null; sharedPlans?: number })[]; calendar?: { id: string; name: string | null } | null };

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export default function CrewNudgeCard({ calendarId = null, calendarName = null, notificationId = null, source }: {
  calendarId?: string | null;
  calendarName?: string | null;
  /** The viewer's own invite, for a recap link opened without a session. */
  notificationId?: string | null;
  source: "calendar_prompt" | "recap";
}) {
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [hidden, setHidden] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Parse.Cloud.run("getCrewNudge", { calendarId, notificationId })
      .then((r: unknown) => {
        if (cancelled) return;
        const n = r as Nudge;
        if (n?.people?.length) {
          setNudge(n);
          track("crew_nudge_shown", { src: source, people: n.people.length });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [calendarId, notificationId, source]);

  if (!nudge || hidden) return null;
  const firsts = nudge.people.map((p) => firstName(p.name));
  const names = firsts.length === 1 ? firsts[0] : `${firsts.slice(0, -1).join(", ")} and ${firsts[firsts.length - 1]}`;
  const most = Math.max(...nudge.people.map((p) => p.sharedPlans || 0));
  const headline = most >= 2
    ? `You've been to ${most} plans with ${names}`
    : `You keep ending up at plans with ${names}`;
  const calendar = nudge.calendar || (calendarId ? { id: calendarId, name: calendarName } : null);
  const suggestedName = firsts.length >= 2 ? `${firsts.slice(0, -1).join(", ")} & ${firsts[firsts.length - 1]}` : "";

  return (
    <>
      <section className="fm rounded-2xl bg-fm-canvas p-5 text-fm-ink font-fm-sans" aria-label="Make it a crew">
        <div className="flex">
          {nudge.people.map((p, i) => (
            <span
              key={p.userId}
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-fm-canvas text-sm font-extrabold text-fm-canvas ${i > 0 ? "-ml-2" : ""}`}
              style={{ background: ["#c8f25a", "#ffb27a", "#6fe3d3"][i % 3] }}
              aria-hidden
            >
              {p.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar} alt="" className="h-full w-full object-cover" />
              ) : firstName(p.name).charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
        <h3 className="mb-1 mt-3 font-fm-serif text-[24px] font-normal leading-tight">{headline}</h3>
        <p className="m-0 text-sm leading-relaxed text-fm-ink-2">
          Make it a crew: Leaf finds a time that works for all of you, every few weeks{calendar?.name ? `, at places from ${calendar.name}` : ""}.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => { track("crew_nudge_start", { src: source }); setStarting(true); }}
            className="flex h-11 items-center rounded-full bg-fm-accent px-5 text-sm font-bold text-fm-canvas hover:brightness-105"
          >
            {nudge.people.length === 1 ? `Start a crew with ${firsts[0]}` : "Start a crew with them"}
          </button>
          <button type="button" onClick={() => setHidden(true)} className="h-11 px-2 text-sm text-fm-muted hover:text-fm-ink">
            Not now
          </button>
        </div>
      </section>
      {starting && (
        <StartCrewModal
          people={nudge.people.map((p) => ({ userId: p.userId, name: p.name }))}
          suggestedName={suggestedName}
          source={source}
          fromCalendar={calendar}
          onClose={() => { setStarting(false); setHidden(true); }}
          onOpenCrew={(id) => { window.location.href = `/crew/${id}`; }}
        />
      )}
    </>
  );
}
