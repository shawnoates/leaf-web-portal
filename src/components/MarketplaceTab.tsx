"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  MapPin,
  Users,
  Clock,
  Calendar,
  Sparkles,
  ExternalLink,
  TrendingUp,
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

interface MarketplaceTabProps {
  calendarId: string;
  city?: string;
  onAddEvent: (event: MarketplaceEvent) => void;
}

// ── Constants ──────────────────────────────────────────────────────────

// Cache events for 24 hours so content stays fresh weekly
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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
  ticketmaster_direct: "Ticketmaster",
  yelp: "Yelp",
  yelp_venue: "Trending Spot",
  stubhub: "StubHub",
};

// ── Cache helpers ──────────────────────────────────────────────────────

interface CachedData {
  events: MarketplaceEvent[];
  trendingVenues: MarketplaceEvent[];
}

function getCachedEvents(calendarId: string): CachedData & { stale: boolean } | null {
  try {
    const raw = localStorage.getItem(`marketplace-${calendarId}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const stale = Date.now() - cached.timestamp > CACHE_TTL_MS;
    return { events: cached.events, trendingVenues: cached.trendingVenues || [], stale };
  } catch {
    return null;
  }
}

function setCachedEvents(calendarId: string, events: MarketplaceEvent[], trendingVenues: MarketplaceEvent[]) {
  try {
    localStorage.setItem(`marketplace-${calendarId}`, JSON.stringify({
      events,
      trendingVenues,
      timestamp: Date.now(),
    }));
  } catch {
    // quota exceeded
  }
}

// ── Dedup helper ──────────────────────────────────────────────────────

function deduplicateEvents(events: MarketplaceEvent[]): MarketplaceEvent[] {
  const seen = new Map<string, MarketplaceEvent>();
  for (const event of events) {
    const key = event.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
    if (!seen.has(key)) {
      seen.set(key, event);
    }
  }
  return Array.from(seen.values());
}

// ── Component ──────────────────────────────────────────────────────────

export default function MarketplaceTab({ calendarId, city, onAddEvent }: MarketplaceTabProps) {
  const [section, setSection] = useState<"discover" | "collabs">("discover");
  const [events, setEvents] = useState<MarketplaceEvent[]>([]);
  const [trendingVenues, setTrendingVenues] = useState<MarketplaceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Filters
  const [category, setCategory] = useState("all");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set());
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const hasFilters = category !== "all" || selectedDays.size > 0 || selectedTimes.size > 0 || selectedSize !== null;

  const fetchFromServer = useCallback(async () => {
    if (!city) {
      setEvents([]);
      setTrendingVenues([]);
      return;
    }

    const cityParam = `?city=${encodeURIComponent(city)}`;

    // Fetch from all API routes in parallel
    const [yelpResult, stubhubResult, ticketmasterResult] = await Promise.allSettled([
      fetch(`/api/yelp${cityParam}`).then((r) => r.json()),
      fetch(`/api/stubhub${cityParam}`).then((r) => r.json()),
      fetch(`/api/ticketmaster${cityParam}`).then((r) => r.json()),
    ]);

    let allEvents: MarketplaceEvent[] = [];
    let allTrendingVenues: MarketplaceEvent[] = [];

    if (yelpResult.status === "fulfilled") {
      allEvents.push(...(yelpResult.value.events || []));
      allTrendingVenues = yelpResult.value.trendingVenues || [];
    }

    if (stubhubResult.status === "fulfilled") {
      allEvents.push(...(stubhubResult.value.events || []));
    }

    if (ticketmasterResult.status === "fulfilled") {
      allEvents.push(...(ticketmasterResult.value.events || []));
    }

    allEvents = deduplicateEvents(allEvents);

    setEvents(allEvents);
    setTrendingVenues(allTrendingVenues);
    setCachedEvents(calendarId, allEvents, allTrendingVenues);
  }, [calendarId, city]);

  const fetchEvents = useCallback(async (useCache = false) => {
    if (useCache) {
      const cached = getCachedEvents(calendarId);
      if (cached) {
        setEvents(cached.events);
        setTrendingVenues(cached.trendingVenues);
        setLoading(false);
        if (cached.stale) {
          fetchFromServer().catch(() => {});
        }
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      await fetchFromServer();
    } catch {
      setError("Couldn\u2019t load marketplace events. Try again.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [calendarId, fetchFromServer]);

  useEffect(() => {
    if (section === "discover" && !initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchEvents(true);
    }
  }, [fetchEvents, section]);

  const handleAddEvent = (event: MarketplaceEvent) => {
    onAddEvent(event);
  };

  // Apply filters
  const filtered = events.filter((e) => {
    if (category !== "all" && e.category !== category) return false;
    if (selectedDays.size > 0) {
      const eventDays = e.suggestedDays || [];
      if (eventDays.length > 0 && !eventDays.some((d) => selectedDays.has(d))) return false;
    }
    if (selectedTimes.size > 0) {
      const eventTimes = e.suggestedTimes || [];
      if (eventTimes.length > 0 && !eventTimes.some((t) => selectedTimes.has(t))) return false;
    }
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
          {/* Trending Locations */}
          {!loading && trendingVenues.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-zinc-500" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Trending Locations</h3>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {trendingVenues.slice(0, 8).map((venue) => (
                  <div
                    key={venue.id}
                    className="flex-shrink-0 w-48 border border-zinc-100 rounded-lg overflow-hidden hover:border-zinc-300 transition-colors group cursor-pointer"
                    onClick={() => handleAddEvent(venue)}
                  >
                    {venue.image ? (
                      <div className="h-24 overflow-hidden">
                        <img
                          src={venue.image}
                          alt={venue.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="h-24 bg-zinc-50 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-zinc-300" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-xs font-medium text-zinc-900 line-clamp-1">{venue.title}</p>
                      <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{venue.description}</p>
                      {venue.venue && (
                        <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {venue.venue.address.split(",")[0]}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Sub-filters */}
          <div className="flex items-center gap-3">
            <select
              value={selectedDays.size === 1 ? [...selectedDays][0] : ""}
              onChange={(e) => setSelectedDays(e.target.value ? new Set([e.target.value]) : new Set())}
              className="text-xs font-medium text-zinc-500 bg-zinc-100 border-0 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-300 appearance-none cursor-pointer"
            >
              <option value="">Any Day</option>
              {DAY_CHIPS.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>

            <select
              value={selectedTimes.size === 1 ? [...selectedTimes][0] : ""}
              onChange={(e) => setSelectedTimes(e.target.value ? new Set([e.target.value]) : new Set())}
              className="text-xs font-medium text-zinc-500 bg-zinc-100 border-0 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-300 appearance-none cursor-pointer"
            >
              <option value="">Any Time</option>
              {TIME_CHIPS.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>

            <select
              value={selectedSize || ""}
              onChange={(e) => setSelectedSize(e.target.value || null)}
              className="text-xs font-medium text-zinc-500 bg-zinc-100 border-0 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-300 appearance-none cursor-pointer"
            >
              <option value="">Any Size</option>
              {SIZE_CHIPS.map((s) => (
                <option key={s.id} value={s.id}>{s.label} people</option>
              ))}
            </select>

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
                {!city
                  ? "Set a city on your calendar to discover events"
                  : hasFilters
                  ? "No events match your filters"
                  : "No events found for your area"}
              </p>
              <p className="text-xs text-zinc-400">
                {!city
                  ? "Go to Calendars and add a city to get started."
                  : hasFilters
                  ? "Try adjusting your filters."
                  : "Check back later for new ideas."}
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

          {/* Popular Events heading */}
          {!loading && !error && filtered.length > 0 && (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-500" />
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Popular Events</h3>
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
                      <div className="h-40 overflow-hidden relative">
                        <img
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-[9px] font-semibold text-zinc-600 px-2 py-0.5 rounded-full">
                          {sourceLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="h-40 bg-zinc-50 flex items-center justify-center relative">
                        <Sparkles className="w-8 h-8 text-zinc-300" />
                        <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-[9px] font-semibold text-zinc-600 px-2 py-0.5 rounded-full">
                          {sourceLabel}
                        </span>
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
