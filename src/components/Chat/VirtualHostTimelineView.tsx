"use client";

import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

interface TimelineEntry {
  id: string;
  stepType: string;
  label: string;
  notes: string;
  createdAtLocal: string;
}

export default function VirtualHostTimelineView({
  entries,
  loading,
  personaName,
}: {
  entries: TimelineEntry[] | null;
  loading: boolean;
  personaName?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!entries || entries.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-zinc-200 bg-gradient-to-b from-teal-50 to-transparent">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center gap-2 hover:bg-teal-100/50 transition-colors"
      >
        <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
        <span className="text-sm font-medium text-teal-900 flex-1 text-left">
          {personaName ? `${personaName} arranging this plan` : "Servicing timeline"}
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
