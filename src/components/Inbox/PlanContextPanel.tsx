"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, MessageSquare, Users } from "lucide-react";
import Parse from "@/lib/parse-client";

export interface PlanContext {
  planId: string;
  title: string | null;
  dateISO: string | null;
  timeString: string | null;
  description: string | null;
  locationName: string | null;
  locationAddress: string | null;
  attendeeCount: number | null;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Format "18:00" as "6:00 PM". The host-typed wall clock on the event is the
// source of truth for when a plan happens — deliberately NOT derived from the
// date, which is a machine timestamp that can drift from it.
function formatTime(hhmm: string | null): string | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = m[2];
  if (!Number.isFinite(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${suffix}`;
}

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-zinc-400 mt-0.5 shrink-0">{icon}</span>
      <div className="text-sm text-zinc-700 min-w-0">{children}</div>
    </div>
  );
}

// Right rail of a plan thread — the plan being discussed, so an owner can
// answer "can we move it to 7pm?" without leaving the conversation.
//
// Only renders for plan threads; calendar-level concierge threads have no
// single plan to describe. Collapses below `lg` so the message column doesn't
// get squeezed on smaller screens.
export default function PlanContextPanel({ plan }: { plan: PlanContext }) {
  // A servicing timeline used to load here from getVirtualHostTimeline —
  // the persona's completed steps plus the venue milestone being waited on.
  // Both the cloud function and the persona are gone (2026-09-02).

  const dateLabel = formatDate(plan.dateISO);
  const timeLabel = formatTime(plan.timeString);

  return (
    <aside className="hidden lg:flex lg:flex-col w-[300px] xl:w-[340px] shrink-0 border-l border-zinc-200 bg-white overflow-y-auto">
      <div className="px-5 py-4 border-b border-zinc-100">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          About this plan
        </p>
        <h2 className="text-sm font-semibold text-zinc-900 mt-1.5 leading-snug">
          {plan.title || "Untitled plan"}
        </h2>
      </div>

      <div className="px-5 py-4 space-y-3 border-b border-zinc-100">
        {dateLabel && (
          <Row icon={<CalendarDays className="w-4 h-4" />}>{dateLabel}</Row>
        )}
        {timeLabel && <Row icon={<Clock className="w-4 h-4" />}>{timeLabel}</Row>}
        {plan.locationName && (
          <Row icon={<MapPin className="w-4 h-4" />}>
            <span className="block">{plan.locationName}</span>
            {plan.locationAddress && (
              <span className="block text-xs text-zinc-400 mt-0.5">
                {plan.locationAddress}
              </span>
            )}
          </Row>
        )}
        {plan.attendeeCount != null && (
          <Row icon={<Users className="w-4 h-4" />}>
            {plan.attendeeCount} attendee{plan.attendeeCount === 1 ? "" : "s"}
          </Row>
        )}
      </div>

      {plan.description && (
        <div className="px-5 py-4 border-b border-zinc-100">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
            Details
          </p>
          <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">
            {plan.description}
          </p>
        </div>
      )}

      <div className="px-5 py-4">
        <Link
          href={`/chat/${plan.planId}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          <MessageSquare className="w-4 h-4" />
          Open the plan chat
        </Link>
        <p className="text-[11px] text-zinc-400 mt-1">
          The group thread with your attendees — separate from this
          conversation.
        </p>
      </div>
    </aside>
  );
}
