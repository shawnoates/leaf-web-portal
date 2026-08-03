"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";

interface TimelineEntry {
  id: string;
  stepType: string;
  label: string;
  notes: string;
  createdAt: string | null;
  createdAtLocal: string;
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
}: {
  entries: TimelineEntry[] | null;
  loading: boolean;
  personaName?: string | null;
  personaAvatarUrl?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!entries || entries.length === 0) {
    return null;
  }

  const latest = entries[0];

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
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-sm font-medium text-teal-900 truncate">
            {latest.label}
          </span>
          <span className="block text-[11px] text-teal-600 truncate">
            {personaName ? `${personaName} · ` : ""}
            {relativeTime(latest.createdAt) || latest.createdAtLocal}
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
              {entries.map((entry, i) => (
                <div key={entry.id} className="flex gap-2.5">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center flex-shrink-0 pt-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                    {i < entries.length - 1 && (
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
