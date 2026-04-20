"use client";

import { useState, useEffect, useCallback } from "react";
import Parse from "@/lib/parse-client";
import {
  RefreshCw,
  Plus,
  MapPin,
  Users,
  Clock,
  Calendar,
  Sparkles,
  Ticket,
  Film,
  Globe,
  Handshake,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

export interface MarketplaceEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string | null;
  source: string;
  venue: { name: string; address: string } | null;
  suggestedDate: string | null;
  suggestedTime: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  suggestedDays: string[];
  suggestedTimes: string[];
}

interface MarketplaceTabProps {
  calendarId: string;
  onAddEvent: (event: MarketplaceEvent) => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "dining", label: "Dining" },
  { id: "sports", label: "Sports" },
  { id: "music", label: "Music" },
  { id: "arts", label: "Arts" },
  { id: "nightlife", label: "Nightlife" },
  { id: "outdoors", label: "Outdoors" },
];

const SOURCE_LABELS: Record<string, string> = {
  ticketmaster: "Ticketmaster",
  tmdb: "Now Showing",
  firecrawl: "Local Find",
  gemini: "AI Suggestion",
};

const SOURCE_ICONS: Record<string, typeof Ticket> = {
  ticketmaster: Ticket,
  tmdb: Film,
  firecrawl: Globe,
  gemini: Sparkles,
};

// ── Component ──────────────────────────────────────────────────────────

export default function MarketplaceTab({ calendarId, onAddEvent }: MarketplaceTabProps) {
  const [section, setSection] = useState<"discover" | "collabs">("discover");
  const [events, setEvents] = useState<MarketplaceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await Parse.Cloud.run("getMarketplaceEvents", {
        calendarId,
        category: filter === "all" ? undefined : filter,
      });
      setEvents(result.events || []);
    } catch {
      setError("Couldn\u2019t load marketplace events. Try again.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [calendarId, filter]);

  useEffect(() => {
    if (section === "discover") {
      fetchEvents();
    }
  }, [fetchEvents, section]);

  const filtered = filter === "all"
    ? events
    : events.filter((e) => e.category === filter);

  return (
    <div className="space-y-6">
      {/* Section sub-tabs */}
      <div className="flex gap-1 border-b border-zinc-100">
        <button
          onClick={() => setSection("discover")}
          className={`px-4 py-2 text-xs font-medium uppercase tracking-widest border-b-2 transition-colors ${
            section === "discover"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          Discover
        </button>
        <button
          onClick={() => setSection("collabs")}
          className={`px-4 py-2 text-xs font-medium uppercase tracking-widest border-b-2 transition-colors ${
            section === "collabs"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-400 hover:text-zinc-600"
          }`}
        >
          Collabs
        </button>
      </div>

      {/* ──── Discover Section ──── */}
      {section === "discover" && (
        <>
          {/* Category filters + refresh */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilter(cat.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                    filter === cat.id
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <button
              onClick={fetchEvents}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border border-zinc-100 rounded-lg overflow-hidden animate-pulse">
                  <div className="h-40 bg-zinc-100" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-zinc-100 rounded w-3/4" />
                    <div className="h-3 bg-zinc-100 rounded w-full" />
                    <div className="h-3 bg-zinc-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center py-16 space-y-4">
              <p className="text-sm text-zinc-400">{error}</p>
              <button
                onClick={fetchEvents}
                className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <Sparkles className="w-8 h-8 text-zinc-300 mx-auto" />
              <p className="text-sm font-medium text-zinc-500">
                No events found for your area
              </p>
              <p className="text-xs text-zinc-400">
                Try a different category or refresh to get new ideas.
              </p>
              <button
                onClick={fetchEvents}
                className="mt-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 underline"
              >
                Refresh
              </button>
            </div>
          )}

          {/* Event cards grid */}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((event) => {
                const SourceIcon = SOURCE_ICONS[event.source] || Sparkles;
                const sourceLabel = SOURCE_LABELS[event.source] || event.source;
                const capacityStr =
                  event.capacityMin && event.capacityMax
                    ? `${event.capacityMin}–${event.capacityMax}`
                    : event.capacityMax
                    ? `Up to ${event.capacityMax}`
                    : event.capacityMin
                    ? `${event.capacityMin}+`
                    : null;
                const daysStr = event.suggestedDays.length > 0
                  ? event.suggestedDays.join(", ")
                  : null;
                const timesStr = event.suggestedTimes.length > 0
                  ? event.suggestedTimes.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ")
                  : null;

                return (
                  <div
                    key={event.id}
                    className="border border-zinc-100 rounded-lg overflow-hidden hover:border-zinc-300 transition-colors group"
                  >
                    {/* Image */}
                    {event.image ? (
                      <div className="relative h-40 overflow-hidden">
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute top-2 left-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-white/90 backdrop-blur-sm rounded-full text-zinc-700">
                            <SourceIcon className="w-3 h-3" />
                            {sourceLabel}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="h-40 bg-zinc-50 flex items-center justify-center">
                        <SourceIcon className="w-8 h-8 text-zinc-300" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-sm font-medium text-zinc-900 line-clamp-1">
                          {event.title}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                          {event.description}
                        </p>
                      </div>

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-400 uppercase tracking-widest">
                        {event.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.venue.name}
                          </span>
                        )}
                        {capacityStr && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {capacityStr} people
                          </span>
                        )}
                        {daysStr && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {daysStr}
                          </span>
                        )}
                        {timesStr && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timesStr}
                          </span>
                        )}
                      </div>

                      {/* Category pill + Add button */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400 bg-zinc-50 px-2 py-0.5 rounded-full">
                          {event.category}
                        </span>
                        <button
                          onClick={() => onAddEvent(event)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          Add to Calendar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ──── Collabs Section (Coming Soon) ──── */}
      {section === "collabs" && (
        <div className="border border-violet-200 rounded-xl p-6 bg-gradient-to-br from-violet-50/60 to-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-medium text-zinc-900">Community Collabs</h3>
            <span className="bg-violet-600 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">Coming Soon</span>
          </div>
          <p className="text-sm text-zinc-500 leading-relaxed mb-4">
            Team up with other community groups to co-host events, share audiences, and grow together.
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li className="text-xs text-zinc-500 leading-relaxed"><strong className="text-zinc-700">Joint Events</strong> — Co-host plans with other groups to double the energy and reach.</li>
            <li className="text-xs text-zinc-500 leading-relaxed"><strong className="text-zinc-700">Cross-Promotion</strong> — Feature your events on partner community calendars automatically.</li>
            <li className="text-xs text-zinc-500 leading-relaxed"><strong className="text-zinc-700">Shared Audiences</strong> — Tap into new members from communities that complement yours.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
