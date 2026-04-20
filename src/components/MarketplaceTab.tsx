"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Parse from "@/lib/parse-client";
import {
  Plus,
  MapPin,
  Users,
  Clock,
  Calendar,
  Sparkles,
  ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

export interface MarketplaceEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string | null;
  source: string;
  url: string | null;
  venue: { name: string; address: string } | null;
  suggestedDate: string | null;
  suggestedTime: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  suggestedDays: string[];
  suggestedTimes: string[];
}

interface SmartDateTime {
  date: string;
  day: string;
  time: string;
  basedOnPastPlans: number;
}

interface MarketplaceTabProps {
  calendarId: string;
  onAddEvent: (event: MarketplaceEvent) => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000;

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "dining", label: "Dining" },
  { id: "sports", label: "Sports" },
  { id: "music", label: "Music" },
  { id: "arts", label: "Arts" },
  { id: "nightlife", label: "Nightlife" },
  { id: "outdoors", label: "Outdoors" },
];

const DAY_CHIPS = [
  { id: "Monday", label: "Mon" },
  { id: "Tuesday", label: "Tue" },
  { id: "Wednesday", label: "Wed" },
  { id: "Thursday", label: "Thu" },
  { id: "Friday", label: "Fri" },
  { id: "Saturday", label: "Sat" },
  { id: "Sunday", label: "Sun" },
];

const TIME_CHIPS = [
  { id: "morning", label: "Morning" },
  { id: "afternoon", label: "Afternoon" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
];

const SIZE_CHIPS = [
  { id: "small", label: "2–10", min: 0, max: 10 },
  { id: "medium", label: "10–25", min: 10, max: 25 },
  { id: "large", label: "25+", min: 25, max: Infinity },
];

const SOURCE_LABELS: Record<string, string> = {
  ticketmaster: "Ticketmaster",
  tmdb: "Now Showing",
  firecrawl: "Local Find",
  gemini: "AI Suggestion",
};

// ── Cache helpers ──────────────────────────────────────────────────────

function getCachedEvents(calendarId: string): { events: MarketplaceEvent[]; smartDateTime: SmartDateTime | null } | null {
  try {
    const raw = sessionStorage.getItem(`marketplace-${calendarId}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
    return { events: cached.events, smartDateTime: cached.smartDateTime };
  } catch {
    return null;
  }
}

function setCachedEvents(calendarId: string, events: MarketplaceEvent[], smartDateTime: SmartDateTime | null) {
  try {
    sessionStorage.setItem(`marketplace-${calendarId}`, JSON.stringify({
      events,
      smartDateTime,
      timestamp: Date.now(),
    }));
  } catch {
    // quota exceeded
  }
}

// ── Filter helpers ─────────────────────────────────────────────────────

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// ── Component ──────────────────────────────────────────────────────────

export default function MarketplaceTab({ calendarId, onAddEvent }: MarketplaceTabProps) {
  const [section, setSection] = useState<"discover" | "collabs">("discover");
  const [events, setEvents] = useState<MarketplaceEvent[]>([]);
  const [smartDateTime, setSmartDateTime] = useState<SmartDateTime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Filters
  const [category, setCategory] = useState("all");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set());
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const hasFilters = category !== "all" || selectedDays.size > 0 || selectedTimes.size > 0 || selectedSize !== null;

  const fetchEvents = useCallback(async (useCache = false) => {
    if (useCache) {
      const cached = getCachedEvents(calendarId);
      if (cached) {
        setEvents(cached.events);
        setSmartDateTime(cached.smartDateTime);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const result = await Parse.Cloud.run("getMarketplaceEvents", { calendarId });
      const fetchedEvents = result.events || [];
      const fetchedSmartDT = result.smartDateTime || null;
      setEvents(fetchedEvents);
      setSmartDateTime(fetchedSmartDT);
      setCachedEvents(calendarId, fetchedEvents, fetchedSmartDT);
    } catch {
      setError("Couldn\u2019t load marketplace events. Try again.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  useEffect(() => {
    if (section === "discover" && !initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchEvents(true);
    }
  }, [fetchEvents, section]);

  const handleAddEvent = (event: MarketplaceEvent) => {
    const enriched = { ...event };
    if (!enriched.suggestedDate && smartDateTime) {
      enriched.suggestedDate = smartDateTime.date;
    }
    if (!enriched.suggestedTime && smartDateTime) {
      enriched.suggestedTime = smartDateTime.time;
    }
    onAddEvent(enriched);
  };

  // Apply filters
  const filtered = events.filter((e) => {
    // Category filter
    if (category !== "all" && e.category !== category) return false;
    // Day filter
    if (selectedDays.size > 0) {
      const eventDays = e.suggestedDays || [];
      if (eventDays.length > 0 && !eventDays.some((d) => selectedDays.has(d))) return false;
    }
    // Time filter
    if (selectedTimes.size > 0) {
      const eventTimes = e.suggestedTimes || [];
      if (eventTimes.length > 0 && !eventTimes.some((t) => selectedTimes.has(t))) return false;
    }
    // Size filter
    if (selectedSize) {
      const sizeConfig = SIZE_CHIPS.find((s) => s.id === selectedSize);
      if (sizeConfig) {
        const cap = e.capacityMax || e.capacityMin;
        if (cap && (cap < sizeConfig.min || cap > sizeConfig.max)) return false;
      }
    }
    return true;
  });

  const clearFilters = () => {
    setCategory("all");
    setSelectedDays(new Set());
    setSelectedTimes(new Set());
    setSelectedSize(null);
  };

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
          {/* Category filters */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                  category === cat.id
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Day / Time / Size filters */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Day of week */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mr-1">Day</span>
              {DAY_CHIPS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDays(toggleSet(selectedDays, d.id))}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    selectedDays.has(d.id)
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Time of day */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mr-1">Time</span>
              {TIME_CHIPS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTimes(toggleSet(selectedTimes, t.id))}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    selectedTimes.has(t.id)
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Group size */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mr-1">Size</span>
              {SIZE_CHIPS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSize(selectedSize === s.id ? null : s.id)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                    selectedSize === s.id
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-[10px] font-medium text-zinc-400 hover:text-zinc-600 underline"
              >
                Clear
              </button>
            )}
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
                onClick={() => fetchEvents(false)}
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
                {hasFilters ? "No events match your filters" : "No events found for your area"}
              </p>
              <p className="text-xs text-zinc-400">
                {hasFilters ? "Try adjusting your filters." : "Check back later for new ideas."}
              </p>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Event cards grid */}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((event) => {
                const sourceLabel = SOURCE_LABELS[event.source] || event.source;
                const capacityStr =
                  event.capacityMin && event.capacityMax
                    ? `${event.capacityMin}\u2013${event.capacityMax}`
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
                      <div className="h-40 overflow-hidden">
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="h-40 bg-zinc-50 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-zinc-300" />
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
                        {event.url && (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View on {sourceLabel}
                          </a>
                        )}
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

                      {/* Add button */}
                      <div className="flex items-center justify-end pt-1">
                        <button
                          onClick={() => handleAddEvent(event)}
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
