"use client";

import { useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import { detectCity } from "@/lib/detectCity";
import { priceLine, whenLine, type ExternalEvent } from "@/lib/externalEvents";
import { ArrowLeft, ExternalLink, Search, Ticket } from "lucide-react";

/**
 * "Find an event" inside the new-plan drawer: Ticketmaster and SeatGeek near
 * the manager (searchExternalEvents), a list on the left, the picked event's
 * details on the right, and "Use this event" to fill the plan from it.
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setEvents([]);
      setSearchedFor("");
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const here = detectCity();
        const res = (await Parse.Cloud.run("searchExternalEvents", {
          q,
          ...(here.lat != null && here.lng != null ? { lat: here.lat, lng: here.lng, radiusMiles: 60 } : {}),
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
    }, 450);
    return () => clearTimeout(timer);
  }, [query]);

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

      <label className="flex items-center gap-2 border border-zinc-300 rounded-lg px-3 h-11 focus-within:border-zinc-900">
        <Search className="w-4 h-4 text-zinc-400 shrink-0" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="An artist, team or show"
          aria-label="Search ticketed events"
          className="flex-1 min-w-0 text-sm focus:outline-none bg-transparent"
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {loading && <p className="text-xs text-zinc-500">Searching Ticketmaster and SeatGeek…</p>}
      {!loading && searchedFor && events.length === 0 && !error && (
        <p className="text-xs text-zinc-500">
          Nothing near you for &ldquo;{searchedFor}&rdquo;. Have a link? Close this and paste it into the box above the form.
        </p>
      )}

      {events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
          <ul className="space-y-1 max-h-[440px] overflow-y-auto -mx-1 px-1" aria-label="Events">
            {events.map((ev) => {
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
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onPick(selected)}
                    className="h-10 px-4 rounded-full bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-800"
                  >
                    Use this event
                  </button>
                  {selected.url && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-zinc-700 inline-flex items-center gap-1 hover:text-zinc-900"
                    >
                      See it on {selected.sourceLabel} <ExternalLink className="w-3.5 h-3.5" aria-hidden />
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
