"use client";

/**
 * Start a crew: what kinds of places it goes to (pre-ticked from its name),
 * where (this device's location or an area typed in), and real places near
 * there to tap: at least one, so the book never starts empty. Places come
 * from crewStarterPlaces; a place that isn't listed can be searched for.
 */

import { useEffect, useRef, useState } from "react";
import { Check, LocateFixed, MapPin, Star } from "lucide-react";
import Parse from "@/lib/parse-client";
import VenueSearch from "@/components/VenueSearch";

export type StarterPlace = { placeId: string; name: string; address: string | null; lat: number | null; lng: number | null };
export type StarterArea = { lat: number; lng: number; label: string | null };
type Listed = StarterPlace & { shortAddress: string | null; category: string | null; rating: number | null; reviews: number; photo: string | null; kindLabel: string | null };
type Answer = { kinds: string[]; kindOptions: { key: string; label: string }[]; center: StarterArea | null; places: Listed[] };

const field = "h-11 min-w-0 flex-1 rounded-full border border-fm-line bg-fm-canvas px-4 text-[15px] text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";

export default function StarterPlaces({ crewName, picked, onPicked, onKinds, onArea, oneTime = false }: {
  crewName: string;
  picked: StarterPlace[];
  onPicked: (next: StarterPlace[]) => void;
  onKinds: (kinds: string[]) => void;
  onArea: (area: StarterArea | null) => void;
  /** "Just once": the first place tapped is the night's (the others go in the vote). */
  oneTime?: boolean;
}) {
  const [options, setOptions] = useState<{ key: string; label: string }[]>([]);
  const [kinds, setKinds] = useState<string[] | null>(null);
  const kindsTouched = useRef(false);
  const [center, setCenter] = useState<StarterArea | null>(null);
  const [areaText, setAreaText] = useState("");
  const [list, setList] = useState<Listed[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [searchText, setSearchText] = useState("");

  const ask = async (params: Record<string, unknown>) => (await Parse.Cloud.run("crewStarterPlaces", params)) as Answer;

  // The kinds the name asks for, until the creator picks their own.
  useEffect(() => {
    if (kindsTouched.current) return;
    const t = setTimeout(() => {
      ask({ name: crewName }).then((r) => {
        setOptions(r.kindOptions);
        if (!kindsTouched.current) { setKinds(r.kinds); onKinds(r.kinds); }
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewName]);

  // Places for the kinds near the point.
  useEffect(() => {
    if (!center || !kinds?.length) { setList(center ? [] : null); return; }
    let live = true;
    setLoading(true);
    setNote("");
    ask({ kinds, lat: center.lat, lng: center.lng })
      .then((r) => { if (live) setList(r.places); })
      .catch(() => { if (live) { setList([]); setNote("Couldn't load places. Search for one below."); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, kinds?.join(",")]);

  const toggleKind = (k: string) => {
    kindsTouched.current = true;
    const next = (kinds || []).includes(k) ? (kinds || []).filter((x) => x !== k) : [...(kinds || []), k];
    setKinds(next);
    onKinds(next);
  };
  const setArea = (a: StarterArea | null) => { setCenter(a); onArea(a); };
  const useMyLocation = () => {
    if (!navigator.geolocation) { setNote("Location isn't available here. Type an area instead."); return; }
    setNote("");
    navigator.geolocation.getCurrentPosition(
      (pos) => setArea({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Near you" }),
      () => setNote("Couldn't get your location. Type an area instead."),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };
  const findArea = async () => {
    if (areaText.trim().length < 2) return;
    setNote("");
    const r = await ask({ kinds: kinds || [], area: areaText.trim() }).catch(() => null);
    if (r?.center) setArea(r.center);
    else setNote("Couldn't find that area. Try a neighborhood and city.");
  };
  const isPicked = (id: string) => picked.some((p) => p.placeId === id);
  const toggle = (p: StarterPlace) => onPicked(isPicked(p.placeId) ? picked.filter((x) => x.placeId !== p.placeId) : [...picked, p]);
  const extra = picked.filter((p) => !list?.some((l) => l.placeId === p.placeId));

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold text-fm-ink-2">What kind of places?</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const on = (kinds || []).includes(o.key);
            return (
              <button key={o.key} type="button" aria-pressed={on} onClick={() => toggleKind(o.key)}
                className={`h-9 rounded-full border px-3.5 text-sm font-semibold transition ${on ? "border-fm-accent bg-fm-accent text-fm-canvas" : "border-fm-line text-fm-ink hover:bg-fm-card"}`}>
                {o.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-fm-ink-2">Where?</span>
        {center ? (
          <div className="flex h-11 items-center gap-2 rounded-full border border-fm-line bg-fm-canvas px-4 text-[15px]">
            <MapPin size={16} className="shrink-0 text-fm-accent" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{center.label || "Near you"}</span>
            <button type="button" className="text-xs text-fm-muted underline" onClick={() => { setArea(null); setList(null); }}>Change</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={useMyLocation} className="flex h-11 items-center justify-center gap-2 rounded-full border border-fm-accent text-sm font-semibold text-fm-accent hover:bg-fm-card">
              <LocateFixed size={16} aria-hidden /> Use my location
            </button>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void findArea(); }}>
              <input className={field} value={areaText} onChange={(e) => setAreaText(e.target.value)} placeholder="Or a neighborhood, like Fort Greene" aria-label="Neighborhood or area" />
              <button type="submit" disabled={areaText.trim().length < 2} className="h-11 shrink-0 rounded-full bg-fm-ink px-4 text-sm font-bold text-fm-canvas disabled:opacity-50">Go</button>
            </form>
          </div>
        )}
      </div>

      {center && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-fm-ink-2">
            {oneTime ? "Tap where you’re going (or a few to vote on)" : "Tap at least one to start the book"}
          </span>
          {!kinds?.length ? (
            <p className="m-0 text-sm text-fm-muted">Pick a kind of place above.</p>
          ) : loading && !list?.length ? (
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0" aria-hidden>
              {[0, 1, 2, 3].map((i) => <li key={i} className="h-[150px] animate-pulse rounded-2xl bg-fm-card" />)}
            </ul>
          ) : list && list.length ? (
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
              {list.map((p) => {
                const on = isPicked(p.placeId);
                return (
                  <li key={p.placeId}>
                    <button type="button" aria-pressed={on} onClick={() => toggle(p)}
                      className={`flex w-full flex-col overflow-hidden rounded-2xl border text-left transition ${on ? "border-fm-accent" : "border-fm-line hover:border-fm-ink-2"}`}>
                      <span className="relative block h-[96px] w-full bg-fm-card">
                        {p.photo
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                          : <span aria-hidden className="absolute bottom-2 left-3 font-fm-serif text-[34px] leading-none text-fm-line">{p.name.charAt(0)}</span>}
                        <span aria-hidden className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border ${on ? "border-fm-accent bg-fm-accent text-fm-canvas" : "border-white/70 bg-black/30"}`}>
                          {on && <Check size={14} strokeWidth={3} />}
                        </span>
                      </span>
                      <span className="flex flex-col gap-0.5 px-2.5 py-2">
                        <span className="truncate text-sm font-semibold text-fm-ink">{p.name}</span>
                        <span className="flex items-center gap-1 truncate text-xs text-fm-muted">
                          {p.rating ? <><Star size={11} className="shrink-0 fill-current" aria-hidden />{p.rating.toFixed(1)} · </> : null}
                          {p.kindLabel || p.category || p.shortAddress}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="m-0 text-sm text-fm-muted">Nothing came up nearby. Search for a place below.</p>
          )}
          {extra.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {extra.map((p) => (
                <button key={p.placeId} type="button" onClick={() => toggle(p)} className="flex h-9 items-center gap-1.5 rounded-full border border-fm-accent px-3 text-sm text-fm-ink">
                  <Check size={14} className="text-fm-accent" aria-hidden /> {p.name}
                </button>
              ))}
            </div>
          )}
          <VenueSearch
            value={searchText}
            onChange={setSearchText}
            onSelect={(v) => {
              const place = v as { placeId?: string | null; name: string; address?: string | null; lat?: number | null; lng?: number | null };
              if (place.placeId && !isPicked(place.placeId)) onPicked([...picked, { placeId: place.placeId, name: place.name, address: place.address ?? null, lat: place.lat ?? null, lng: place.lng ?? null }]);
              setSearchText("");
            }}
            placeholder="Not listed? Search for a place"
            className="h-11 w-full rounded-full border border-fm-line bg-fm-canvas px-4 text-[15px] text-fm-ink placeholder:text-fm-muted"
          />
        </div>
      )}
      {note && <p className="m-0 text-xs text-fm-danger">{note}</p>}
    </div>
  );
}
