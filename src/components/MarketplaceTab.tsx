"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
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
  planTitle?: string;
  planDescription?: string;
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
  prefetchedEvents?: MarketplaceEvent[] | null;
  onAddEvent: (event: MarketplaceEvent) => void;
}

// ── Constants ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SOURCE_LABELS: Record<string, string> = {
  ticketmaster_direct: "Events",
  yelp: "Places",
  tmdb: "Now Showing",
  firecrawl: "Local Find",
};

const SOURCE_FILTERS = [
  { id: "recommended", label: "Recommended" },
  { id: "all", label: "All" },
  { id: "ticketmaster_direct", label: "Events" },
  { id: "yelp", label: "Places" },
  { id: "tmdb", label: "Movies" },
  { id: "firecrawl", label: "Local Finds" },
];


// ── Cache helpers ──────────────────────────────────────────────────────

function getCachedEvents(calendarId: string): { events: MarketplaceEvent[]; recommendedIds: string[] | null; stale: boolean } | null {
  try {
    const raw = localStorage.getItem(`marketplace-${calendarId}`);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    const stale = Date.now() - cached.timestamp > CACHE_TTL_MS;
    return { events: cached.events, recommendedIds: cached.recommendedIds || null, stale };
  } catch {
    return null;
  }
}

function setCachedEvents(calendarId: string, events: MarketplaceEvent[], recommendedIds?: string[] | null) {
  try {
    localStorage.setItem(`marketplace-${calendarId}`, JSON.stringify({
      events,
      recommendedIds: recommendedIds || null,
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

// ── Fallback recommendation (balanced across key sources) ────────────

const PRIORITY_SOURCES = ["ticketmaster_direct", "yelp", "tmdb", "firecrawl"];

function getFallbackRecommended(events: MarketplaceEvent[]): MarketplaceEvent[] {
  const bySource = new Map<string, MarketplaceEvent[]>();
  for (const event of events) {
    const key = event.source === "yelp_venue" ? "yelp" : event.source;
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(event);
  }

  const result: MarketplaceEvent[] = [];

  // First pass: take up to 3 from each priority source (round-robin)
  for (let round = 0; round < 3 && result.length < 10; round++) {
    for (const src of PRIORITY_SOURCES) {
      const items = bySource.get(src);
      if (items && round < items.length && result.length < 10) {
        result.push(items[round]);
      }
    }
  }

  // Fill remaining slots from any source (including yelp)
  const usedIds = new Set(result.map((e) => e.id));
  for (const event of events) {
    if (result.length >= 10) break;
    if (!usedIds.has(event.id)) {
      result.push(event);
      usedIds.add(event.id);
    }
  }

  return result;
}

// ── Venue photo (lazy Google Places lookup) ─────────────────────────────

const venuePhotoCache = new Map<string, string | null>();

const VenuePhoto = memo(function VenuePhoto({ venue, alt }: { venue: { name: string; address: string }; alt: string }) {
  const [url, setUrl] = useState<string | null | undefined>(() => {
    const key = `${venue.name} ${venue.address}`;
    return venuePhotoCache.has(key) ? venuePhotoCache.get(key) : undefined;
  });

  useEffect(() => {
    if (url !== undefined) return; // already resolved
    const key = `${venue.name} ${venue.address}`;
    fetch(`/api/places-photo?query=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((data) => {
        venuePhotoCache.set(key, data.url);
        setUrl(data.url);
      })
      .catch(() => {
        venuePhotoCache.set(key, null);
        setUrl(null);
      });
  }, [venue.name, venue.address, url]);

  if (url) {
    return (
      <img src={url} alt={alt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
    );
  }

  if (url === undefined) {
    // Loading shimmer
    return <div className="w-full h-full bg-zinc-100 animate-pulse" />;
  }

  // No photo found
  return (
    <div className="w-full h-full bg-zinc-50 flex items-center justify-center">
      <MapPin className="w-8 h-8 text-zinc-300" />
    </div>
  );
});

// ── Component ──────────────────────────────────────────────────────────

export default function MarketplaceTab({ calendarId, city, orgSettings, prefetchedEvents, onAddEvent }: MarketplaceTabProps) {
  const [section, setSection] = useState<"discover" | "collabs">("discover");
  const [events, setEvents] = useState<MarketplaceEvent[]>(prefetchedEvents || []);
  const [recommendedIds, setRecommendedIds] = useState<string[] | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [loading, setLoading] = useState(!prefetchedEvents);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(!!prefetchedEvents);

  // Filters
  const [sourceFilter, setSourceFilter] = useState("recommended");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);

  const fetchFromServer = useCallback(async (query?: string) => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (query) params.set("q", query);
    const qs = params.toString() ? `?${params.toString()}` : "";

    // Fetch from all 4 sources in parallel
    const [yelpResult, ticketmasterResult, tmdbResult, scrapeResult] = await Promise.allSettled([
      city ? fetch(`/api/yelp${qs}`).then((r) => r.json()) : Promise.resolve({ events: [] }),
      city ? fetch(`/api/ticketmaster${qs}`).then((r) => r.json()) : Promise.resolve({ events: [] }),
      fetch(`/api/tmdb${query ? `?q=${encodeURIComponent(query)}` : ""}`).then((r) => r.json()),
      city && !query ? fetch(`/api/scrape?city=${encodeURIComponent(city)}`).then((r) => r.json()) : Promise.resolve({ events: [] }),
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

    if (scrapeResult.status === "fulfilled") {
      allEvents.push(...(scrapeResult.value.events || []));
    }

    allEvents = deduplicateEvents(allEvents);

    setEvents(allEvents);
    // Only cache non-search results
    if (!query) {
      setCachedEvents(calendarId, allEvents);
      // Fetch AI recommendations in background
      if (orgSettings && allEvents.length > 0) {
        fetchRecommendations(allEvents);
      }
    }
  }, [calendarId, city]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecommendations = useCallback(async (eventsToRank: MarketplaceEvent[]) => {
    if (!orgSettings || eventsToRank.length === 0) return;
    setLoadingRecs(true);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: eventsToRank.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            source: e.source,
          })),
          orgSettings,
        }),
      });
      const data = await res.json();
      const ids: string[] = data.recommendedIds || [];
      if (ids.length > 0) {
        setRecommendedIds(ids);
        setCachedEvents(calendarId, eventsToRank, ids);
      }
    } catch {
      // Silently fall back to round-robin
    } finally {
      setLoadingRecs(false);
    }
  }, [calendarId, orgSettings]);

  const fetchEvents = useCallback(async (useCache = false, query?: string) => {
    if (useCache && !query) {
      const cached = getCachedEvents(calendarId);
      if (cached) {
        setEvents(cached.events);
        setRecommendedIds(cached.recommendedIds);
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

  // Trigger recommendations for prefetched data
  useEffect(() => {
    if (prefetchedEvents && prefetchedEvents.length > 0 && orgSettings && !recommendedIds) {
      fetchRecommendations(prefetchedEvents);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(() => {
      const trimmed = value.trim();
      setSearchQuery(trimmed);
      setVisibleCount(10);
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

  // Apply source filter or recommendation
  const filtered = useMemo(() => {
    if (sourceFilter === "recommended") {
      // Use Gemini recommendations if available
      if (recommendedIds && recommendedIds.length > 0) {
        const idSet = new Set(recommendedIds);
        const byId = new Map(events.map((e) => [e.id, e]));
        return recommendedIds
          .filter((id) => byId.has(id))
          .map((id) => byId.get(id)!);
      }
      // Fallback to round-robin
      return getFallbackRecommended(events);
    }

    if (sourceFilter !== "all") {
      return events.filter((e) => e.source === sourceFilter);
    }

    return events;
  }, [events, sourceFilter, recommendedIds]);

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
                onClick={() => { setSourceFilter(sf.id); setVisibleCount(10); }}
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

          {/* Loading skeleton */}
          {(loading || (loadingRecs && isRecommended && !recommendedIds)) && (
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
                  : sourceFilter !== "all"
                  ? "No events match your filters"
                  : "No events found for your area"}
              </p>
              <p className="text-xs text-zinc-400">
                {!city
                  ? "Go to Calendars and add a city to get started."
                  : sourceFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Check back later for new ideas."}
              </p>
            </div>
          )}

          {/* Section heading */}
          {!loading && !error && filtered.length > 0 && (
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {searchQuery
                  ? `Results for \u201c${searchQuery}\u201d`
                  : isRecommended
                  ? "Recommended for You"
                  : sourceFilter === "all"
                  ? "All"
                  : SOURCE_LABELS[sourceFilter] || "Events"}
              </h3>
            </div>
          )}

          {/* Event cards grid */}
          {!loading && !error && filtered.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.slice(0, visibleCount).map((event) => {
                  const sourceLabel = SOURCE_LABELS[event.source] || event.source;
                  const showPlan = event.planTitle && (isRecommended || event.source === "firecrawl");
                  const displayTitle = showPlan ? event.planTitle : event.title;
                  const displayDescription = showPlan ? event.planDescription : event.description;

                  return (
                    <div
                      key={event.id}
                      className="border border-zinc-100 rounded-lg overflow-hidden hover:border-zinc-300 transition-colors group"
                    >
                      {/* Image */}
                      <div className="h-40 overflow-hidden relative">
                        {event.image ? (
                          <img
                            src={event.image}
                            alt={displayTitle}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : event.venue ? (
                          <VenuePhoto venue={event.venue} alt={displayTitle || ""} />
                        ) : (
                          <div className="w-full h-full bg-zinc-50 flex items-center justify-center">
                            <Sparkles className="w-8 h-8 text-zinc-300" />
                          </div>
                        )}
                        <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-[9px] font-semibold text-zinc-600 px-2 py-0.5 rounded-full">
                          {sourceLabel}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-3">
                        <div>
                          <h3 className="text-sm font-medium text-zinc-900 line-clamp-1">
                            {displayTitle}
                          </h3>
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                            {displayDescription}
                          </p>
                          {event.url && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View details
                            </a>
                          )}
                        </div>

                        {/* Metadata */}
                        {event.venue && (
                          <div className="text-[10px] text-zinc-400 uppercase tracking-widest space-y-0.5">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {event.venue.name}
                            </span>
                            {event.venue.address && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue.address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block pl-4 normal-case text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                {event.venue.address}
                              </a>
                            )}
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

              {/* Load more */}
              {filtered.length > visibleCount && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setVisibleCount((c) => c + 10)}
                    className="px-5 py-2 text-xs font-medium text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
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
