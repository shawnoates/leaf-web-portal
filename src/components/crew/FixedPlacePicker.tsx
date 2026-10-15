"use client";

/**
 * Skip venue rotation: the one place a crew always meets. One search box for
 * anything: a place (the same bar every week) is used as is; an address
 * becomes one of the organizer's own places, named what they call it (Home),
 * like the app's custom locations. Their saved places are one tap, and a name
 * with no match ("Mom's") still works.
 */

import { useEffect, useState } from "react";
import { Home, MapPin, Search } from "lucide-react";
import VenueSearch from "@/components/VenueSearch";
import { Button, Mono } from "@/components/crew/CrewShell";
import { run, type CrewAuth, type FixedPlace } from "@/lib/crew";

type MyPlace = { locationId: string; name: string; address: string | null; photo: string | null };
type Picked = { placeId: string; address: string };

export default function FixedPlacePicker({ auth, calendarId, current, busy, onSave }: {
  auth: CrewAuth;
  calendarId: string;
  current: FixedPlace | null;
  busy: boolean;
  onSave: (params: Record<string, unknown>) => Promise<void>;
}) {
  const [mine, setMine] = useState<MyPlace[] | null>(null);
  const [query, setQuery] = useState("");
  // An address waiting for its name ("Home").
  const [address, setAddress] = useState<Picked | null>(null);
  const [name, setName] = useState("Home");
  const [editing, setEditing] = useState(!current);

  useEffect(() => {
    run<{ places: MyPlace[] }>("getMyCrewPlaces", auth, { calendarId })
      .then((r) => setMine(r.places))
      .catch(() => setMine([]));
  }, [auth, calendarId]);

  const save = async (params: Record<string, unknown>) => {
    await onSave({ calendarId, mode: "fixed", ...params });
    setQuery("");
    setAddress(null);
    setEditing(false);
  };
  const field = "h-11 w-full rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";

  if (current && !editing) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-fm-line-dim px-3 py-2.5">
        {current.custom ? <Home size={16} aria-hidden className="shrink-0 text-fm-muted" /> : <MapPin size={16} aria-hidden className="shrink-0 text-fm-muted" />}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] text-fm-ink">{current.label}</span>
          {current.address && <span className="truncate text-xs text-fm-muted">{current.address}</span>}
        </span>
        <Button small kind="ghost" onClick={() => setEditing(true)}>Change</Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {mine && mine.length > 0 && !address && (
        <>
          <Mono className="px-1 text-fm-muted">Your places</Mono>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {mine.map((p) => (
              <li key={p.locationId}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save({ locationId: p.locationId, label: p.name, address: p.address || "" })}
                  className="flex min-h-10 items-center gap-1.5 rounded-full border border-fm-line px-3.5 text-sm text-fm-ink hover:border-fm-ink-2 disabled:opacity-50"
                  title={p.address || undefined}
                >
                  <Home size={14} aria-hidden className="text-fm-muted" /> {p.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {!address ? (
        <>
          <label className="relative block">
            <span className="sr-only">Search a place or an address</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-fm-muted" />
            <VenueSearch
              value={query}
              onChange={setQuery}
              onSelect={(v) => {
                if (v.kind === "address") {
                  setAddress({ placeId: v.placeId, address: v.description || [v.name, v.address].filter(Boolean).join(", ") });
                } else {
                  void save({ placeId: v.placeId, kind: "place", label: v.name, address: v.address });
                }
              }}
              placeholder="Search a place or an address"
              className="h-11 w-full rounded-xl border pl-10 pr-3 text-[16px] outline-none"
            />
          </label>
          {query.trim().length >= 2 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save({ label: query.trim() })}
              className="w-fit px-1 text-left text-sm text-fm-muted underline underline-offset-4 hover:text-fm-ink disabled:opacity-50"
            >
              Just call it &ldquo;{query.trim()}&rdquo;, no address
            </button>
          )}
        </>
      ) : (
        <form
          className="flex flex-col gap-2 rounded-xl border border-fm-line-dim p-3"
          onSubmit={(e) => { e.preventDefault(); void save({ placeId: address.placeId, kind: "address", label: name.trim(), address: address.address }); }}
        >
          <span className="text-sm text-fm-ink-2">{address.address}</span>
          <label className="text-sm font-semibold text-fm-ink" htmlFor="fixed-place-name">What do you call it?</label>
          <input id="fixed-place-name" className={field} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Home, Mom's, the lake house" />
          <p className="m-0 text-xs text-fm-muted">Saved to your places, like in the app. Only the crew sees the address.</p>
          <div className="flex gap-2">
            <Button small type="submit" disabled={busy || name.trim().length < 1}>{busy ? "Saving…" : "Save place"}</Button>
            <Button small kind="ghost" onClick={() => setAddress(null)}>Back</Button>
          </div>
        </form>
      )}

      {current && (
        <button type="button" onClick={() => { setEditing(false); setAddress(null); setQuery(""); }} className="w-fit px-1 text-sm text-fm-muted hover:text-fm-ink">
          Keep {current.label}
        </button>
      )}
    </div>
  );
}
