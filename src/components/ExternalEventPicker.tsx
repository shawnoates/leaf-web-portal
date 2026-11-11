"use client";

import { useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import { detectCity } from "@/lib/detectCity";
import { isEventLink, priceLine, whenLine, type ExternalEvent } from "@/lib/externalEvents";
import { ArrowLeft, CalendarDays, ExternalLink, MapPin, Search, Ticket, User } from "lucide-react";

type Suggestion = {
  type: "attraction" | "venue" | "event";
  name: string;
  detail: string | null;
  imageUrl: string | null;
  event?: ExternalEvent;
};

function nearHere(): { lat: number; lng: number } | null {
  const here = detectCity();
  return here.lat != null && here.lng != null ? { lat: here.lat, lng: here.lng } : null;
}

/**
 * "Find an event" inside the new-plan drawer: Ticketmaster and SeatGeek near
 * the manager (searchExternalEvents), a list on the left, the picked event's
 * details on the right, and "Use this event" to fill the plan from it.
 *
 * Before typing it shows the week's big draws nearby; from two letters it
 * suggests artists, teams, venues and events (suggestExternalEvents) under
 * the box, and picking one searches for it.
 */
export default function ExternalEventPicker({
  onPick,
  onBack,
}: {
  onPick: (event: ExternalEvent) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExternalEvent | null>(null);
  const [searchedFor, setSearchedFor] = useState("");
  // This week near you, shown while the box is empty.
  const [nearby, setNearby] = useState<ExternalEvent[] | null>(null);
  // Typeahead under the box.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  // A picked suggestion searches at once; this keeps the typing debounce
  // from searching the same text again a moment later.
  const committed = useRef<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const here = nearHere();
    if (!here) { setNearby([]); return; }
    let cancelled = false;
    Parse.Cloud.run("searchExternalEvents", {
      q: "",
      ...here,
      radiusMiles: 15,
      dateTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      limit: 12,
    })
      .then((res: { events: ExternalEvent[] }) => {
        if (cancelled) return;
        setNearby(res.events || []);
        setSelected((cur) => cur ?? (res.events || [])[0] ?? null);
      })
      .catch(() => { if (!cancelled) setNearby([]); });
    return () => { cancelled = true; };
  }, []);

  /** A pasted Luma, Partiful, Eventbrite, Ticketmaster or SeatGeek link: read that one event. */
  async function readLink(url: string) {
    committed.current = url;
    setSuggestions([]);
    setSuggestOpen(false);
    setLoading(true);
    setError(null);
    try {
      const res = (await Parse.Cloud.run("resolveExternalEventFromUrl", { url })) as { found: boolean; event?: ExternalEvent };
      if (res.found && res.event) {
        setEvents([res.event]);
        setSelected(res.event);
        setSearchedFor(url);
      } else {
        setEvents([]);
        setSelected(null);
        setError("Couldn't read an event from that page. Try the event's own page, or close this and fill in the plan yourself.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't read that link.");
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(q: string) {
    committed.current = q;
    setLoading(true);
    setError(null);
    try {
      const here = nearHere();
      const res = (await Parse.Cloud.run("searchExternalEvents", {
        q,
        ...(here ? { ...here, radiusMiles: 60 } : {}),
        limit: 24,
      })) as { events: ExternalEvent[] };
      setEvents(res.events || []);
      setSelected((res.events || [])[0] || null);
      setSearchedFor(q);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search didn't work. Try again.");
    } finally {
      setLoading(false);
    }
  }

  // Suggestions: quick, from two letters.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q === committed.current || isEventLink(q) || /^https?:\/\//i.test(q)) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      const here = nearHere();
      Parse.Cloud.run("suggestExternalEvents", { q, ...(here ?? {}) })
        .then((res: { suggestions: Suggestion[] }) => {
          if (cancelled) return;
          setSuggestions(res.suggestions || []);
          setActiveIdx(-1);
          setSuggestOpen(true);
        })
        .catch(() => { if (!cancelled) setSuggestions([]); });
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  // Full results: after a pause, from three letters.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setEvents([]);
      setSearchedFor("");
      if (!q) setSelected(nearby?.[0] ?? null);
      return;
    }
    if (q === committed.current) return;
    const link = isEventLink(q) || /^https?:\/\/\S+\.\S+/i.test(q);
    const timer = setTimeout(() => (link ? readLink(q) : runSearch(q)), link ? 150 : 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pickSuggestion(sg: Suggestion) {
    setSuggestOpen(false);
    setSuggestions([]);
    setQuery(sg.name);
    if (sg.event) {
      // An event: show it right away; the search fills in the rest of its run.
      setEvents([sg.event]);
      setSelected(sg.event);
    }
    runSearch(sg.name);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const open = suggestOpen && suggestions.length > 0;
    if (e.key === "ArrowDown" && open) {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && open) {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIdx >= 0) pickSuggestion(suggestions[activeIdx]);
      else if (query.trim().length >= 2) {
        setSuggestOpen(false);
        const q = query.trim();
        if (isEventLink(q) || /^https?:\/\//i.test(q)) readLink(q); else runSearch(q);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setSuggestOpen(false);
    }
  }

  const typed = query.trim();
  const showingNearby = !typed && (nearby?.length ?? 0) > 0;
  const list = typed ? events : (nearby ?? []);
  const suggestIcon = (t: Suggestion["type"]) =>
    t === "venue" ? <MapPin className="w-4 h-4 text-zinc-400" aria-hidden />
      : t === "event" ? <CalendarDays className="w-4 h-4 text-zinc-400" aria-hidden />
        : <User className="w-4 h-4 text-zinc-400" aria-hidden />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the plan"
          className="w-9 h-9 -ml-2 rounded-full grid place-items-center hover:bg-zinc-100"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-zinc-900">Find an event</h3>
      </div>

      <div className="relative">
        <label className="flex items-center gap-2 border border-zinc-300 rounded-lg px-3 h-11 focus-within:border-zinc-900">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSuggestOpen(true); }}
            onKeyDown={onKeyDown}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
            placeholder="An artist, team or show, or paste an event link"
            aria-label="Search ticketed events"
            role="combobox"
            aria-expanded={suggestOpen && suggestions.length > 0}
            aria-controls="event-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={activeIdx >= 0 ? `event-suggestion-${activeIdx}` : undefined}
            className="flex-1 min-w-0 text-sm focus:outline-none bg-transparent"
            autoComplete="off"
          />
        </label>
        {suggestOpen && suggestions.length > 0 && (
          <ul
            id="event-suggestions"
            role="listbox"
            className="absolute z-20 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 max-h-80 overflow-y-auto"
          >
            {suggestions.map((sg, i) => (
              <li
                key={`${sg.type}:${sg.name}:${i}`}
                id={`event-suggestion-${i}`}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => { e.preventDefault(); pickSuggestion(sg); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${i === activeIdx ? "bg-zinc-100" : ""}`}
              >
                {sg.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sg.imageUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                ) : (
                  <span className="w-8 h-8 rounded bg-zinc-100 grid place-items-center shrink-0">{suggestIcon(sg.type)}</span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm text-zinc-900 truncate">{sg.name}</span>
                  {sg.detail && <span className="block text-xs text-zinc-500 truncate">{sg.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {loading && (
        <p className="text-xs text-zinc-500">
          {isEventLink(typed) || /^https?:\/\//i.test(typed) ? "Reading the event…" : "Searching Ticketmaster and SeatGeek…"}
        </p>
      )}
      {!typed && (
        <p className="text-xs text-zinc-500">Have a Luma, Partiful or Eventbrite link? Paste it above.</p>
      )}
      {!loading && searchedFor && events.length === 0 && !error && (
        <p className="text-xs text-zinc-500">
          Nothing near you for &ldquo;{searchedFor}&rdquo;. Have a link? Close this and paste it into the box above the form.
        </p>
      )}

      {showingNearby && (
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">This week near you</p>
      )}
      {!typed && nearby === null && <p className="text-xs text-zinc-500">Finding what&rsquo;s on near you…</p>}

      {list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
          <ul className="space-y-1 max-h-[440px] overflow-y-auto -mx-1 px-1" aria-label="Events">
            {list.map((ev) => {
              const active = selected?.externalId === ev.externalId && selected?.source === ev.source;
              return (
                <li key={`${ev.source}:${ev.externalId}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(ev)}
                    aria-pressed={active}
                    className={`w-full text-left flex gap-3 rounded-lg p-2 ${active ? "bg-zinc-100" : "hover:bg-zinc-50"}`}
                  >
                    <DateTile ev={ev} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-zinc-900 truncate">{ev.title}</span>
                      <span className="block text-xs text-zinc-500 truncate">
                        {[ev.venue?.name, ev.venue?.city].filter(Boolean).join(", ")}
                      </span>
                      <span className="block text-xs text-zinc-500 truncate">
                        {[priceLine(ev), ev.sourceLabel].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected && (
            <div className="border border-zinc-200 rounded-xl overflow-hidden self-start">
              <div className="h-32 bg-zinc-900 relative">
                {selected.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
              </div>
              <div className="p-4 space-y-2">
                <p className="text-base font-semibold text-zinc-900 leading-snug">{selected.title}</p>
                <p className="text-sm text-zinc-700">{whenLine(selected)}</p>
                {selected.venue?.name && (
                  <p className="text-sm text-zinc-700">
                    {selected.venue.name}
                    {selected.venue.address ? <span className="text-zinc-500"> · {selected.venue.address}</span> : null}
                  </p>
                )}
                <p className="text-sm text-zinc-700 flex items-center gap-1.5">
                  <Ticket className="w-4 h-4 text-zinc-400" aria-hidden />
                  {[priceLine(selected), `Tickets on ${selected.sourceLabel}`].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs text-zinc-500">
                  Guests buy tickets on {selected.sourceLabel}. The plan keeps the group and the chat, and moves if the show moves.
                </p>
                {/* Stacked, so neither wraps to two lines in the narrow column. */}
                <div className="flex flex-col items-stretch gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onPick(selected)}
                    className="h-10 w-full px-4 rounded-full bg-zinc-900 text-white text-sm font-semibold whitespace-nowrap hover:bg-zinc-800"
                  >
                    Use this event
                  </button>
                  {selected.url && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-center text-sm text-zinc-700 inline-flex items-center gap-1 whitespace-nowrap hover:text-zinc-900"
                    >
                      See it on {selected.sourceLabel} <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DateTile({ ev }: { ev: ExternalEvent }) {
  let month = "TBA";
  let day = "–";
  if (ev.localDate) {
    const [y, m, d] = ev.localDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    month = dt.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" }).toUpperCase();
    day = String(d);
  }
  return (
    <span className="w-11 h-11 rounded-lg bg-zinc-900 text-white flex flex-col items-center justify-center shrink-0" aria-hidden>
      <span className="text-[9px] font-bold tracking-wider leading-none">{month}</span>
      <span className="text-base leading-tight">{day}</span>
    </span>
  );
}
