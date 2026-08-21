"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { Plus, MapPin, Sparkles, ExternalLink, Search } from "lucide-react";
import { getDefaultCoverForSeed } from "@/lib/default-covers";

// Marketplace discovery cards, redesigned: one image per card (the map is gone
// — the venue is a text line with a Map link out to Google Maps), a type chip
// on the cover, and a full-width Add-to-calendar pill. Data flow is unchanged:
// four sources fetched in parallel, cached per calendar, locally re-ranked
// against the org's blacklist/keyword settings.

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
  ticketmaster_direct: "Event",
  yelp: "Place",
  tmdb: "Movie",
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

// Local recommendation engine — applies the org's blacklist + keyword filters,
// then round-robins across sources for diversity. No model tokens consumed.
function computeLocalRecommendations(
  events: MarketplaceEvent[],
  orgSettings: OrgSettings,
): string[] {
  const blacklistSet = new Set(
    (orgSettings.blacklistCategories || []).map((c) => c.toLowerCase().trim()).filter(Boolean),
  );
  const excludeKeywords = (orgSettings.excludeKeywords || [])
    .map((k) => k.toLowerCase().trim())
    .filter(Boolean);

  const filtered = events.filter((e) => {
    const cat = (e.category || "").toLowerCase();
    if (blacklistSet.has(cat)) return false;
    if (excludeKeywords.length > 0) {
      const haystack = `${e.title || ""} ${e.description || ""} ${cat}`.toLowerCase();
      for (const kw of excludeKeywords) {
        if (haystack.includes(kw)) return false;
      }
    }
    return true;
  });

  return getFallbackRecommended(filtered).map((e) => e.id);
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
      <img src={url} alt={alt} className="w-full h-full object-cover" />
    );
  }

  if (url === undefined) {
    // Loading shimmer
    return <div className="w-full h-full bg-zinc-100 animate-pulse" />;
  }

  // No photo found — fall back to a default cover gradient seeded by venue name
  const cover = getDefaultCoverForSeed(`${venue.name}|${venue.address}`);
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: cover.gradient }}
    >
      <MapPin className="w-8 h-8 text-white/70" />
    </div>
  );
});

// ── Component ──────────────────────────────────────────────────────────

export default function MarketplaceTab({ calendarId, city, orgSettings, prefetchedEvents, onAddEvent }: MarketplaceTabProps) {
  const [events, setEvents] = useState<MarketplaceEvent[]>(prefetchedEvents || []);
  const [recommendedIds, setRecommendedIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(!prefetchedEvents);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(!!prefetchedEvents);

  // Filters
  const [sourceFilter, setSourceFilter] = useState("recommended");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  // Fetch Unsplash images for events missing images (fire-and-forget enrichment)
  const enrichWithUnsplash = useCallback(async (allEvents: MarketplaceEvent[]) => {
    const needImages = allEvents.filter(e => !e.image && !e.venue);
    if (needImages.length === 0) return;
    // Limit to 4 lookups to stay within rate limits
    const batch = needImages.slice(0, 4);
    const results = await Promise.allSettled(
      batch.map(e =>
        fetch(`/api/unsplash?query=${encodeURIComponent(e.title)}`)
          .then(r => r.json())
          .then(data => ({ id: e.id, url: data.results?.[0]?.url || null }))
      )
    );
    const imageMap = new Map<string, string>();
    for (const r of results) {
      if (r.status === "fulfilled" && r.value.url) {
        imageMap.set(r.value.id, r.value.url);
      }
    }
    if (imageMap.size > 0) {
      setEvents(prev => prev.map(e => imageMap.has(e.id) ? { ...e, image: imageMap.get(e.id)! } : e));
    }
  }, []);

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
    // Enrich events missing images with Unsplash (background)
    enrichWithUnsplash(allEvents);
    // Only cache non-search results
    if (!query) {
      setCachedEvents(calendarId, allEvents);
      // Fetch AI recommendations in background
      if (orgSettings && allEvents.length > 0) {
        fetchRecommendations(allEvents);
      }
    }
  }, [calendarId, city]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecommendations = useCallback((eventsToRank: MarketplaceEvent[]) => {
    if (!orgSettings || eventsToRank.length === 0) return;
    const ids = computeLocalRecommendations(eventsToRank, orgSettings);
    if (ids.length > 0) {
      setRecommendedIds(ids);
      setCachedEvents(calendarId, eventsToRank, ids);
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
      setError("Couldn’t load marketplace events. Try again.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [calendarId, fetchFromServer]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchEvents(true);
    }
  }, [fetchEvents]);

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
      setVisibleCount(12);
      if (trimmed) {
        setSourceFilter("all");
        fetchEvents(false, trimmed);
      } else {
        fetchEvents(true);
      }
    }, 500);
  }, [fetchEvents]);

  // Apply source filter or recommendation
  const filtered = useMemo(() => {
    if (sourceFilter === "recommended") {
      if (recommendedIds && recommendedIds.length > 0) {
        const idSet = new Set(recommendedIds);
        const byId = new Map(events.map((e) => [e.id, e]));
        return recommendedIds
          .filter((id) => idSet.has(id) && byId.has(id))
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
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search events, venues, orgs"
          className="w-full h-10 pl-10 pr-14 text-sm border border-zinc-200 rounded-full focus:outline-none focus:border-zinc-900 placeholder:text-zinc-400"
        />
        {searchInput && (
          <button
            onClick={() => handleSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* DISCOVER row — filter chips + sort note */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase mr-1.5">
          Discover
        </span>
        {SOURCE_FILTERS.map((sf) => (
          <button
            key={sf.id}
            onClick={() => { setSourceFilter(sf.id); setVisibleCount(12); }}
            className={`px-3.5 py-2 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              sourceFilter === sf.id
                ? "bg-zinc-900 text-white"
                : "border border-zinc-200 text-zinc-600 hover:border-zinc-300"
            }`}
          >
            {sf.label}
          </button>
        ))}
        <span className="flex-1" />
        <span className="hidden lg:inline text-[11px] text-zinc-400">
          Sorted by what fits your community
        </span>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="border border-zinc-200 rounded-xl overflow-hidden animate-pulse">
              <div className="h-[120px] bg-zinc-100" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-zinc-100 rounded w-3/4" />
                <div className="h-3 bg-zinc-100 rounded w-full" />
                <div className="h-9 bg-zinc-100 rounded-full w-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="text-center py-16 space-y-4">
          <p className="text-sm text-zinc-500">{error}</p>
          <button
            onClick={() => fetchEvents(false)}
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900 underline"
          >
            Retry
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

      {/* Event cards grid */}
      {!loading && !error && filtered.length > 0 && (
        <>
          {searchQuery && (
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Results for &ldquo;{searchQuery}&rdquo;
            </h3>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filtered.slice(0, visibleCount).map((event) => {
              const sourceLabel = SOURCE_LABELS[event.source] || event.source;
              const showPlan = event.planTitle && (isRecommended || event.source === "firecrawl");
              const displayTitle = showPlan ? event.planTitle : event.title;
              const displayDescription = showPlan ? event.planDescription : event.description;

              return (
                <div
                  key={event.id}
                  className="border border-zinc-200 rounded-xl overflow-hidden flex flex-col"
                >
                  {/* One image per card, type chip bottom-left */}
                  <div className="h-[120px] relative overflow-hidden shrink-0">
                    {event.image ? (
                      <img
                        src={event.image}
                        alt={displayTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : event.venue ? (
                      <VenuePhoto venue={event.venue} alt={displayTitle || ""} />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: getDefaultCoverForSeed(event.id).gradient }}
                      >
                        <Sparkles className="w-8 h-8 text-white/70" />
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 bg-white/[0.92] text-zinc-900 text-[9px] font-semibold tracking-[0.08em] uppercase px-2 py-1 rounded-[5px]">
                      {sourceLabel}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="text-sm font-medium leading-[1.35] text-zinc-900">
                      {displayTitle}
                    </h3>
                    {displayDescription && (
                      <p className="text-xs leading-normal text-zinc-500 mt-1.5 line-clamp-2">
                        {displayDescription}
                      </p>
                    )}

                    {/* Venue line — text + Map link, no embedded map */}
                    {event.venue && (
                      <p className="flex items-center gap-1.5 mt-2.5 text-xs text-zinc-700 min-w-0">
                        <span className="w-[5px] h-[5px] rounded-full bg-zinc-400 shrink-0" />
                        <span className="truncate">
                          {event.venue.name}
                          {event.venue.address ? ` · ${event.venue.address}` : ""}
                        </span>
                        {event.venue.address && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue.name}, ${event.venue.address}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-zinc-500 underline shrink-0 hover:text-zinc-900"
                          >
                            Map
                          </a>
                        )}
                      </p>
                    )}
                    {event.url && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View details
                      </a>
                    )}

                    <span className="flex-1" />
                    <button
                      onClick={() => onAddEvent(event)}
                      className="mt-3.5 w-full h-[38px] inline-flex items-center justify-center gap-1.5 bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to calendar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load more */}
          {filtered.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount((c) => c + 12)}
                className="px-5 py-2.5 text-xs font-medium text-zinc-600 border border-zinc-200 rounded-full hover:border-zinc-300 transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
