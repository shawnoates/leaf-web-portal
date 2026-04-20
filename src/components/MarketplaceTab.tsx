"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Parse from "@/lib/parse-client";
import {
  Plus,
  MapPin,
  Sparkles,
  ExternalLink,
  Star,
  Search,
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

export interface OrgSettings {
  name: string;
  description: string;
  orgType: string | null;
  calendarDescription: string;
  blacklistCategories: string[];
  excludeKeywords: string[];
  daysOfWeek: number[];
  preferredTimes: string[];
}

interface MarketplaceTabProps {
  calendarId: string;
  city?: string;
  orgSettings?: OrgSettings;
  onAddEvent: (event: MarketplaceEvent) => void;
}

// ── Constants ──────────────────────────────────────────────────────────

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

const SOURCE_LABELS: Record<string, string> = {
  ticketmaster_direct: "Ticketmaster",
  yelp: "Yelp",
  tmdb: "Now Showing",
  firecrawl: "Local Find",
};

const SOURCE_FILTERS = [
  { id: "recommended", label: "Recommended" },
  { id: "all", label: "All" },
  { id: "ticketmaster_direct", label: "Ticketmaster" },
  { id: "yelp", label: "Yelp" },
  { id: "tmdb", label: "Movies" },
  { id: "firecrawl", label: "Local Finds" },
];

// Day index to name mapping for recommendation scoring
const DAY_INDEX_TO_NAME: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

// Blacklist category mapping (org settings use specific names, events use generic)
const BLACKLIST_MAP: Record<string, string[]> = {
  "Bars": ["nightlife"],
  "Nightclubs": ["nightlife"],
  "Casinos": ["nightlife"],
  "Adult venues": ["nightlife"],
  "Smoking lounges": ["nightlife"],
  "Late-night venues": ["nightlife"],
  "Fast food": ["dining"],
  "Religious venues": [],
};

// ── Cache helpers ──────────────────────────────────────────────────────

function getCachedEvents(calendarId: string): { events: MarketplaceEvent[]; stale: boolean } | null {
  try {
    const raw = localStorage.getItem(`marketplace-${calendarId}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const stale = Date.now() - cached.timestamp > CACHE_TTL_MS;
    return { events: cached.events, stale };
  } catch {
    return null;
  }
}

function setCachedEvents(calendarId: string, events: MarketplaceEvent[]) {
  try {
    localStorage.setItem(`marketplace-${calendarId}`, JSON.stringify({
      events,
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

// ── Recommendation scoring ───────────────────────────────────────────

// Solo/non-group activities that don't make good plan ideas
const SOLO_KEYWORDS = [
  "gym", "personal training", "crossfit", "pilates", "yoga studio",
  "tanning", "nail salon", "hair salon", "barbershop", "spa",
  "chiropractor", "dentist", "doctor", "urgent care", "pharmacy",
  "laundromat", "dry cleaning", "auto repair", "storage",
];

function scoreEvent(event: MarketplaceEvent, settings: OrgSettings): number | null {
  const titleLower = event.title.toLowerCase();
  const descLower = event.description.toLowerCase();

  // Exclude solo/non-group activities
  for (const kw of SOLO_KEYWORDS) {
    if (titleLower.includes(kw) || descLower.includes(kw)) return null;
  }

  // Exclude blacklisted categories
  for (const blacklisted of settings.blacklistCategories) {
    const mappedCategories = BLACKLIST_MAP[blacklisted] || [];
    if (mappedCategories.includes(event.category)) return null;
  }

  // Exclude events matching exclude keywords
  for (const keyword of settings.excludeKeywords) {
    const kw = keyword.toLowerCase();
    if (titleLower.includes(kw) || descLower.includes(kw)) return null;
  }

  let score = 1;

  // Boost for matching preferred days
  if (settings.daysOfWeek.length > 0 && event.suggestedDays.length > 0) {
    const preferredDayNames = settings.daysOfWeek.map((i) => DAY_INDEX_TO_NAME[i]).filter(Boolean);
    if (event.suggestedDays.some((d) => preferredDayNames.includes(d))) {
      score += 2;
    }
  }

  // Boost for matching preferred times
  if (settings.preferredTimes.length > 0 && event.suggestedTimes.length > 0) {
    if (event.suggestedTimes.some((t) => settings.preferredTimes.includes(t))) {
      score += 2;
    }
  }

  return score;
}

function getRecommended(events: MarketplaceEvent[], settings: OrgSettings): MarketplaceEvent[] {
  // Group by source, score within each group
  const bySource = new Map<string, { event: MarketplaceEvent; score: number }[]>();

  for (const event of events) {
    const s = scoreEvent(event, settings);
    if (s === null) continue;
    const sourceKey = event.source === "yelp_venue" ? "yelp" : event.source;
    if (!bySource.has(sourceKey)) bySource.set(sourceKey, []);
    bySource.get(sourceKey)!.push({ event, score: s });
  }

  // Sort each source by score
  for (const items of bySource.values()) {
    items.sort((a, b) => b.score - a.score);
  }

  // Round-robin pick from each source to ensure diversity
  const sources = Array.from(bySource.entries());
  const result: MarketplaceEvent[] = [];
  let round = 0;

  while (result.length < 10 && sources.some(([, items]) => items.length > round)) {
    for (const [, items] of sources) {
      if (round < items.length && result.length < 10) {
        result.push(items[round].event);
      }
    }
    round++;
  }

  return result;
}

// ── Component ──────────────────────────────────────────────────────────

export default function MarketplaceTab({ calendarId, city, orgSettings, onAddEvent }: MarketplaceTabProps) {
  const [section, setSection] = useState<"discover" | "collabs">("discover");
  const [events, setEvents] = useState<MarketplaceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Filters
  const [sourceFilter, setSourceFilter] = useState("recommended");
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchFromServer = useCallback(async (query?: string) => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (query) params.set("q", query);
    const qs = params.toString() ? `?${params.toString()}` : "";

    // Fetch from all 4 sources in parallel
    const [yelpResult, ticketmasterResult, tmdbResult, parseResult] = await Promise.allSettled([
      city ? fetch(`/api/yelp${qs}`).then((r) => r.json()) : Promise.resolve({ events: [] }),
      city ? fetch(`/api/ticketmaster${qs}`).then((r) => r.json()) : Promise.resolve({ events: [] }),
      fetch(`/api/tmdb${query ? `?q=${encodeURIComponent(query)}` : ""}`).then((r) => r.json()),
      query ? Promise.resolve({ events: [] }) : Parse.Cloud.run("getMarketplaceEvents", { calendarId }),
    ]);

    let allEvents: MarketplaceEvent[] = [];

    if (yelpResult.status === "fulfilled") {
      allEvents.push(...(yelpResult.value.events || []));
    }

    if (ticketmasterResult.status === "fulfilled") {
      allEvents.push(...(ticketmasterResult.value.events || []));
    }

    if (tmdbResult.status === "fulfilled") {
      allEvents.push(...(tmdbResult.value.events || []));
    }

    // From Parse, only take firecrawl (scraped) events
    if (parseResult.status === "fulfilled") {
      const scraped = (parseResult.value.events || []).filter(
        (e: MarketplaceEvent) => e.source === "firecrawl"
      );
      allEvents.push(...scraped);
    }

    allEvents = deduplicateEvents(allEvents);

    setEvents(allEvents);
    // Only cache non-search results
    if (!query) {
      setCachedEvents(calendarId, allEvents);
    }
  }, [calendarId, city]);

  const fetchEvents = useCallback(async (useCache = false, query?: string) => {
    if (useCache && !query) {
      const cached = getCachedEvents(calendarId);
      if (cached) {
        setEvents(cached.events);
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
      await fetchFromServer(query);
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

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(() => {
      const trimmed = value.trim();
      setSearchQuery(trimmed);
      if (trimmed) {
        setSourceFilter("all");
        fetchEvents(false, trimmed);
      } else {
        fetchEvents(true);
      }
    }, 500);
  }, [fetchEvents]);

  const handleAddEvent = (event: MarketplaceEvent) => {
    onAddEvent(event);
  };

  // Apply source filter, then recommendation or category filters
  const filtered = useMemo(() => {
    let result = events;

    // Source filter
    if (sourceFilter === "recommended" && orgSettings) {
      return getRecommended(result, orgSettings);
    }

    if (sourceFilter !== "all" && sourceFilter !== "recommended") {
      result = result.filter((e) => e.source === sourceFilter);
    }

    // Category filter
    if (category !== "all") {
      result = result.filter((e) => e.category === category);
    }

    return result;
  }, [events, sourceFilter, orgSettings, category]);

  const isRecommended = sourceFilter === "recommended";

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
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search events, venues, movies..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-transparent placeholder:text-zinc-400"
            />
            {searchInput && (
              <button
                onClick={() => handleSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Source filter chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {SOURCE_FILTERS.map((sf) => (
              <button
                key={sf.id}
                onClick={() => setSourceFilter(sf.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors flex items-center gap-1 ${
                  sourceFilter === sf.id
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {sf.id === "recommended" && <Star className="w-3 h-3" />}
                {sf.label}
              </button>
            ))}
          </div>

          {/* Category filter (hide when Recommended is active) */}
          {!isRecommended && (
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
          )}

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
                  : category !== "all" || sourceFilter !== "all"
                  ? "No events match your filters"
                  : "No events found for your area"}
              </p>
              <p className="text-xs text-zinc-400">
                {!city
                  ? "Go to Calendars and add a city to get started."
                  : category !== "all" || sourceFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Check back later for new ideas."}
              </p>
            </div>
          )}

          {/* Section heading */}
          {!loading && !error && filtered.length > 0 && (
            <div className="flex items-center gap-2">
              {searchQuery ? (
                <>
                  <Search className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    Results for &ldquo;{searchQuery}&rdquo;
                  </h3>
                </>
              ) : isRecommended ? (
                <>
                  <Star className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Recommended for You</h3>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-zinc-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    {sourceFilter === "all" ? "All Events" : SOURCE_LABELS[sourceFilter] || "Events"}
                  </h3>
                </>
              )}
            </div>
          )}

          {/* Event cards grid */}
          {!loading && !error && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((event) => {
                const sourceLabel = SOURCE_LABELS[event.source] || event.source;

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
                      {event.venue && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {event.venue.name}
                          </span>
                        </div>
                      )}

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
