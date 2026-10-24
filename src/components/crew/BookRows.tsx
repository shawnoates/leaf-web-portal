"use client";

/*
 * The book's rows, shared by the book page and the crew page:
 *   - Discover: one-tap ideas (a member's save, a place like one in the book,
 *     popular nearby), each with why it's here. "+" adds it to the book.
 *   - Happenings: shared plans, dated events and movies, and events the crew
 *     watches for, soonest first (compact cards, for the crew page).
 */

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Eye, MapPin, Plus } from "lucide-react";
import PlacePhoto from "@/components/crew/PlacePhoto";
import { crewHref, run, type BookSpot, type CrewAuth, type DiscoverItem } from "@/lib/crew";

const fmtYmd = (ymd: string, weekday = false) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { ...(weekday ? { weekday: "short" as const } : {}), month: "short", day: "numeric" });

/** "Sat, Oct 18" · "Until Nov 5" · "Oct 10 – Nov 5" */
export function windowLabel(start: string, end: string) {
  if (start === end) return fmtYmd(start, true);
  const today = new Date().toLocaleDateString("en-CA");
  return start <= today ? `Until ${fmtYmd(end)}` : `${fmtYmd(start)} – ${fmtYmd(end)}`;
}

/** A Happening's one line: when it is, or what it still needs. */
export function happeningLine(h: BookSpot): string {
  if (h.kind === "watch") return h.next ? `Next: ${fmtYmd(h.next.date, true)} · ${h.next.watchParty ? "watch together" : h.next.venueName}` : "Leaf looks for dates every week";
  if (h.eventPassed) return "Passed";
  const when = h.eventStart ? windowLabel(h.eventStart, h.eventEnd || h.eventStart) : null;
  const where = h.needsPlace ? "Where is this?" : h.locationId ? h.neighborhood || h.category : null;
  return [when, where].filter(Boolean).join(" · ") || (h.kind === "plan" ? "Shared plan" : "");
}

const KIND_LABEL: Record<string, string> = { plan: "Shared plan", event: "Event", movie: "Movie", watch: "Watching for" };

/**
 * Discover: a carousel of ideas, one tap each. Adding hides the card right
 * away, then `onAdded` refreshes the book.
 */
export function DiscoverRow({ items, auth, canAdd, onAdded, compact = false }: {
  items: DiscoverItem[];
  auth: CrewAuth;
  canAdd: boolean;
  onAdded: () => void | Promise<void>;
  compact?: boolean;
}) {
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const keyOf = (d: DiscoverItem) => d.locationId || d.placeId || `${d.name}:${d.event?.date || ""}`;
  const shown = items.filter((d) => !added.has(keyOf(d)));
  if (!shown.length) return null;

  const add = async (d: DiscoverItem) => {
    const key = keyOf(d);
    setBusy(key);
    setError("");
    try {
      if (d.event) {
        // An event nearby goes in as a dated event at its venue: Leaf polls that date.
        await run("addCrewEvent", auth, {
          title: d.name, kind: "event", start: d.event.date,
          venue: { name: d.event.venueName || d.name, address: d.address, lat: d.lat, lng: d.lng },
        });
      } else {
        await run("addToCrewBook", auth, d.locationId
          ? { locationId: d.locationId }
          : { placeId: d.placeId, venue: { placeId: d.placeId, name: d.name, address: d.address, lat: d.lat, lng: d.lng } });
      }
      setAdded((s) => new Set(s).add(key));
      await onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add it.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Discover" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-fm-mono text-[11px] uppercase tracking-[0.12em] text-fm-muted">Discover</span>
        <span className="text-xs text-fm-muted">One tap adds it to the book</span>
      </div>
      <ul className="no-scrollbar -mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 scroll-pl-5 lg:mx-0 lg:px-0">
        {shown.map((d) => (
          <li key={keyOf(d)} className={`group relative flex shrink-0 snap-start flex-col gap-2 ${compact ? "w-[140px]" : "w-[160px]"}`}>
            {/* Dimmed, with a dashed edge: ideas, not places already in the book. */}
            <div className={`relative overflow-hidden rounded-[20px] border border-dashed border-fm-line bg-fm-card ${compact ? "h-[110px]" : "h-[130px]"}`}>
              <PlacePhoto
                src={d.photo}
                locationId={d.locationId}
                className="h-full w-full object-cover opacity-50 saturate-50 transition group-hover:opacity-80 group-hover:saturate-100"
                fallback={
                  <span aria-hidden className="absolute inset-0 flex flex-col justify-end p-3">
                    <span className="font-fm-serif text-[40px] leading-[0.8] text-fm-line">{d.name.charAt(0)}</span>
                  </span>
                }
              />
              {d.isNew && <span className="absolute left-2 top-2 rounded-full bg-fm-accent px-1.5 py-0.5 font-fm-mono text-[9px] tracking-[0.06em] text-fm-canvas">NEW</span>}
              {canAdd && (
                <button
                  type="button"
                  onClick={() => void add(d)}
                  disabled={busy !== null}
                  aria-label={`Add ${d.name} to the book`}
                  className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-fm-ink text-fm-canvas shadow-sm transition hover:brightness-110 disabled:opacity-60"
                >
                  {busy === keyOf(d) ? <Check size={16} strokeWidth={2.6} aria-hidden /> : <Plus size={18} strokeWidth={2.6} aria-hidden />}
                </button>
              )}
            </div>
            <div className="min-w-0">
              {d.event?.url
                ? <a href={d.event.url} target="_blank" rel="noreferrer" className="block truncate text-[15px] font-semibold text-fm-ink-2 hover:underline">{d.name}</a>
                : <div className="truncate text-[15px] font-semibold text-fm-ink-2">{d.name}</div>}
              <div className="truncate text-[12px] text-fm-muted">{d.event ? "Event nearby" : [d.category, d.shortAddress].filter(Boolean).join(" · ")}</div>
              {/* Discover is what's not in the book yet: no "Saved by …" (it reads like the book). */}
              {d.why !== "saved" && d.reason && <div className="truncate text-[12px] text-fm-ink-2">{d.reason}</div>}
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="m-0 text-sm text-fm-danger">{error}</p>}
    </section>
  );
}

/** Happenings for the crew page: compact cards, tap through to the book. */
export function HappeningsCards({ items, total, auth }: { items: BookSpot[]; total: number; auth: CrewAuth }) {
  if (!items.length) return null;
  return (
    <section aria-label="Happenings" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-fm-mono text-[11px] uppercase tracking-[0.12em] text-fm-muted">Happenings · {total}</span>
        {total > items.length && <Link href={`${crewHref(auth, "book")}#happenings`} className="text-xs font-semibold text-fm-ink-2 underline underline-offset-4 hover:text-fm-ink">See all</Link>}
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((h) => (
          <li key={h.spotId}>
            <Link href={`${crewHref(auth, "book")}#happenings`} className={`flex items-center gap-3 rounded-2xl border border-fm-line bg-fm-surface p-2.5 pr-3 hover:border-fm-ink-2${h.eventPassed ? " opacity-60" : ""}`}>
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-fm-card">
                <PlacePhoto
                  src={h.photo || h.plan?.imageUrl || h.next?.image}
                  locationId={h.locationId}
                  fallback={
                    <span aria-hidden className="absolute inset-0 flex items-center justify-center text-fm-accent">
                      {h.kind === "watch" ? <Eye size={18} /> : h.eventStart ? <CalendarDays size={18} /> : <MapPin size={18} />}
                    </span>
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{h.plan?.title || h.name}</div>
                <div className={`truncate text-[13px] ${h.needsPlace ? "text-fm-accent" : "text-fm-muted"}`}>
                  <span className="font-fm-mono text-[10px] uppercase tracking-[0.08em]">{KIND_LABEL[h.kind || "plan"]}</span> · {happeningLine(h)}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
