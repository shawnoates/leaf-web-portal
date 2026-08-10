"use client";

import { ChevronDown, Clock, Loader2 } from "lucide-react";
import { useState } from "react";

interface TimelineEntry {
  id: string;
  stepType: string;
  label: string;
  notes: string;
  createdAt: string | null;
  createdAtLocal: string;
}

// What the host is WAITING on — a venue's onsale or reservation release that
// hasn't arrived yet. Timeline rows only exist for work already done, so on a
// plan booked months ahead this is the only thing there is to show, and without
// it the panel reads as "nobody is doing anything".
export interface UpcomingMilestone {
  kind: "tickets" | "reservation";
  opensAt: string;
  opensAtLocal: string;
  label: string;
}

// The header shows one line and wants "2h ago"; the expanded log wants the
// exact wall-clock in the calendar's timezone (createdAtLocal, formatted
// server-side). Relative time is computed client-side off the ISO createdAt so
// it stays honest while a long-lived drawer sits open.
function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 0) return "just now";
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return null;
}

export default function VirtualHostTimelineView({
  entries,
  loading,
  personaName,
  personaAvatarUrl,
  upcomingMilestone,
}: {
  entries: TimelineEntry[] | null;
  loading: boolean;
  personaName?: string | null;
  personaAvatarUrl?: string | null;
  upcomingMilestone?: UpcomingMilestone | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  // A pending milestone is enough to render on its own: before the first task
  // completes there are no entries at all, and that is exactly the stretch
  // where the owner most needs to see something is being waited on.
  if ((!entries || entries.length === 0) && !upcomingMilestone) {
    return null;
  }

  const latest = entries && entries.length > 0 ? entries[0] : null;

  return (
    <div className="border-t border-zinc-200 bg-gradient-to-b from-teal-50 to-transparent">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-teal-100/50 transition-colors"
      >
        {personaAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={personaAvatarUrl}
            alt={personaName || "AI-assisted host"}
            className="w-6 h-6 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-[11px] font-bold shrink-0">
            {(personaName || "L").charAt(0).toUpperCase()}
          </div>
        )}
        {/* Collapsed, this row is the whole story the owner gets — so lead
            with where things actually stand, not a static "arranging" label.
            Entries arrive newest-first from getVirtualHostTimeline. */}
        {/* The pending milestone leads when there is one — "waiting on tickets,
            Mar 3" is more useful to an owner than the last thing that happened,
            and it's the answer to the question the empty stretch provokes. */}
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-sm font-medium text-teal-900 truncate">
            {upcomingMilestone ? upcomingMilestone.label : latest!.label}
          </span>
          <span className="block text-[11px] text-teal-600 truncate">
            {personaName ? `${personaName} · ` : ""}
            {upcomingMilestone
              ? upcomingMilestone.opensAtLocal
              : relativeTime(latest!.createdAt) || latest!.createdAtLocal}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-teal-600 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Timeline */}
      {isOpen && (
        <div className="px-4 py-3 space-y-3 border-t border-teal-200/50">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Head of the list, hollow-dotted: this one hasn't happened yet. */}
              {upcomingMilestone && (
                <div className="flex gap-2.5">
                  <div className="flex flex-col items-center flex-shrink-0 pt-1">
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-teal-400 bg-transparent" />
                    {entries && entries.length > 0 && <div className="w-px h-6 bg-teal-200 mt-1" />}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-xs font-medium text-teal-900 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {upcomingMilestone.label}
                    </p>
                    <p className="text-[10px] text-teal-600 mt-0.5">{upcomingMilestone.opensAtLocal}</p>
                    <p className="text-xs text-teal-700 mt-1 italic">
                      {upcomingMilestone.kind === "tickets"
                        ? "We'll buy them as soon as they're released."
                        : "We'll book as soon as the tables are released."}
                    </p>
                  </div>
                </div>
              )}
              {(entries || []).map((entry, i) => (
                <div key={entry.id} className="flex gap-2.5">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center flex-shrink-0 pt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                    {i < (entries?.length ?? 0) - 1 && (
                      <div className="w-px h-6 bg-teal-200 mt-1" />
                    )}
                  </div>
                  {/* Entry content */}
                  <div className="flex-1 pb-1">
                    <p className="text-xs font-medium text-teal-900">{entry.label}</p>
                    <p className="text-[10px] text-teal-600 mt-0.5">{entry.createdAtLocal}</p>
                    {entry.notes && (
                      <p className="text-xs text-teal-700 mt-1 italic">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
