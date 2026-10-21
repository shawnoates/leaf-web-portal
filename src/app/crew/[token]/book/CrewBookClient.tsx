"use client";

/**
 * The Crew Book — /crew/[token]/book
 *
 * Two lists. The crew's shared book (everyone sees it: who added each place,
 * upvotes, tried), and "Your saves" (only you see it) with a one-tap Add.
 * Nothing moves from your saves into the book unless you tap.
 *
 * Phone: one column, the book as rows. Desktop (lg+): the book as a 3-column
 * card grid with your saves in a sidebar.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, ChevronLeft, ChevronUp, Eye, Lock, Plus, Search, Sun } from "lucide-react";
import VenueSearch from "@/components/VenueSearch";
import PlacePhoto from "@/components/crew/PlacePhoto";
import ShareFromInstagramHint from "@/components/crew/ShareFromInstagramHint";
import WatchingStrip from "@/components/crew/WatchingStrip";
import { useCrewAuth } from "@/components/crew/useCrewAuth";
import { Button, CrewShell, CrewTopBar, DeadState, DisplayTitle, Eyebrow, Spinner, useInApp } from "@/components/crew/CrewShell";
import { spotHref, crewHref, run, toDate, type BookSpot, type CrewAuth, type SavedPlace, type WatchItem } from "@/lib/crew";

/** A real place from Google Places (server: crew-places.js). */
type Suggested = {
  placeId: string; name: string; address: string | null; shortAddress: string | null; category: string | null;
  rating: number | null; lat: number | null; lng: number | null; saves: number; isNew?: boolean;
  /** Why it fits the ask (from the prompt search), or the place's own line. */
  blurb?: string | null;
};
type Book = { crew: { id: string; name: string }; shared: BookSpot[]; mine: SavedPlace[]; popular?: Suggested[]; watching?: WatchItem[] };

export default function CrewBookClient({ token }: { token: string }) {
  const load = useCrewAuth(token);
  if (load.status === "loading") return <Spinner label="Opening the book…" />;
  if (load.status === "expired") return <DeadState title="This link has expired." body="Text PLAN to the number Leaf wrote from and you'll get a fresh one." />;
  if (load.status === "error") return <DeadState title="Couldn't open the book." body={load.message} />;
  // Invitees answer on the crew page first; the book stays closed until then.
  if (load.data.me.status === "invited" || load.data.me.status === "declined") return <GoTo href={crewHref(load.auth)} />;
  return <BookView auth={load.auth} crewName={load.data.crew.name} canAdd={load.data.me.status === "in"} isOwner={load.data.me.isOwner} hiddenTips={load.data.me.hiddenTips} />;
}

function GoTo({ href }: { href: string }) {
  useEffect(() => { window.location.replace(href); }, [href]);
  return <Spinner label="Opening your invite…" />;
}

function BookView({ auth, crewName, canAdd, isOwner, hiddenTips }: { auth: CrewAuth; crewName: string; canAdd: boolean; isOwner: boolean; hiddenTips?: string[] }) {
  const [book, setBook] = useState<Book | null>(null);
  const [sort, setSort] = useState<"wanted" | "new">("wanted");
  const [query, setQuery] = useState("");
  const [addingEvent, setAddingEvent] = useState(false);
  // From the crew page's "+ Add": the search starts focused.
  // From the crew page's empty book: "Watch for an event" opens Add an event on "No, Leaf finds it".
  const [focusSearch, setFocusSearch] = useState(false);
  const [watchFirst, setWatchFirst] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFocusSearch(q.has("add"));
    if (q.has("watch")) { setWatchFirst(true); setAddingEvent(true); }
  }, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // "What are you in the mood for?" — real places for a vibe (searchCrewPlaces).
  const [vibe, setVibe] = useState("");
  const [found, setFound] = useState<Suggested[] | null>(null);
  // Why a search came back empty: the crew's daily limit, or an error —
  // both used to read as "Nothing matched", which hid the real cause.
  const [findNote, setFindNote] = useState("");
  const [finding, setFinding] = useState(false);
  const [showAllSaves, setShowAllSaves] = useState(false);
  const inApp = useInApp();
  const findPlaces = async () => {
    if (vibe.trim().length < 3) return;
    setFinding(true);
    setFindNote("");
    try {
      const r = await run<{ results: Suggested[]; limited?: boolean }>("searchCrewPlaces", auth, { query: vibe.trim() });
      setFound(r.results);
      if (r.limited) setFindNote("This crew has used today's searches. More tomorrow.");
    } catch (e) {
      setFound([]);
      setFindNote(e instanceof Error ? e.message : "Search isn't working right now.");
    } finally { setFinding(false); }
  };

  const refresh = useCallback(async () => setBook(await run<Book>("getCrewBook", auth)), [auth]);
  useEffect(() => { refresh().catch((e) => setError(e.message)); }, [refresh]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try { await fn(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(null); }
  };

  if (!book) return <Spinner label="Opening the book…" />;
  const shared = [...book.shared].sort((a, b) => (sort === "wanted" ? b.upvotes - a.upvotes : 0));
  // The same place saved twice (two bookmarks) shows once.
  const seen = new Set<string>();
  const mine = book.mine.filter((p) => !seen.has(p.locationId) && seen.add(p.locationId));

  const suggestionRow = (p: Suggested) => (
    <li key={p.placeId} className="flex items-center gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-semibold lg:text-[15px]">{p.name}</span>
          {p.isNew && <span className="shrink-0 rounded-full bg-fm-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase text-fm-canvas">New</span>}
        </div>
        {p.blurb && <div className="text-[13px] leading-snug text-fm-ink-2">{p.blurb}</div>}
        <div className="truncate text-[13px] text-fm-muted">
          {[p.category, p.shortAddress, p.rating ? `★ ${p.rating.toFixed(1)}` : null, p.saves ? `saved by ${p.saves} on Leaf` : null].filter(Boolean).join(" · ")}
        </div>
      </div>
      <Button small disabled={busy !== null || !canAdd} onClick={() => act(`p-${p.placeId}`, async () => {
        await run("addToCrewBook", auth, { placeId: p.placeId, venue: { name: p.name, address: p.address, lat: p.lat, lng: p.lng, placeId: p.placeId } });
        setFound((f) => f && f.filter((x) => x.placeId !== p.placeId));
      })}>
        <Plus size={14} strokeWidth={2.4} aria-hidden /> Add<span className="sr-only"> {p.name} to {crewName}</span>
      </Button>
    </li>
  );

  return (
    <CrewShell wide topBar={<CrewTopBar auth={auth} active="book" />}>
      {!inApp && (
        <Link href={crewHref(auth)} className="-ml-2 mb-2 flex min-h-11 w-fit items-center gap-0.5 px-2 text-sm font-semibold text-fm-ink-2 hover:text-fm-ink lg:hidden">
          <ChevronLeft size={20} aria-hidden /> {crewName}
        </Link>
      )}

      {/* Title, then the search right under it (it floated at the far right on desktop). */}
      <div className="flex flex-col gap-6 lg:gap-7">
        <div className="flex flex-col gap-2.5 lg:gap-3">
          <span className="hidden text-sm text-fm-muted lg:block">{crewName}</span>
          <DisplayTitle italic="book">The</DisplayTitle>
          <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">Places the crew wants to go. Leaf plans nights from here first.</p>
        </div>
        {canAdd && (
          <div className="lg:mr-[428px]" /* same width as the book column: page minus the 380px saves panel + 48px gap */>
            <label className="relative block">
              <span className="sr-only">Add a place</span>
              <Search size={18} aria-hidden className="pointer-events-none absolute left-[18px] top-1/2 z-10 -translate-y-1/2 text-fm-muted" />
              <VenueSearch
                value={query}
                onChange={setQuery}
                onSelect={(v) => act("search", async () => { await run("addToCrewBook", auth, { placeId: v.placeId, venue: v }); setQuery(""); })}
                placeholder="Add a place, or something to watch for"
                className="h-14 w-full rounded-full border pl-12 pr-5 text-[15px] outline-none"
                autoFocus={focusSearch}
                key={focusSearch ? "focus" : "plain"}
                // A team, a comedian, a tour: watch for it (BETA).
                extraOption={(q) => ({
                  first: looksLikeEvent(q),
                  onSelect: () => void act("watch", async () => { await run("addCrewEventWatch", auth, { query: q }); setQuery(""); }),
                  content: (
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fm-accent text-fm-canvas"><Eye size={18} strokeWidth={2.2} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">Watch for &ldquo;{q}&rdquo; <span className="font-fm-mono text-[9px] text-fm-accent">BETA</span></span>
                        <span className="block text-xs text-fm-muted">Leaf finds the dates and asks when one fits</span>
                      </span>
                    </div>
                  ),
                })}
              />
            </label>
            <p className="mb-0 ml-5 mt-2 text-xs text-fm-muted">
              Goes into the book and your own saves.{" "}
              {!addingEvent && <button type="button" className="font-semibold text-fm-ink-2 underline" onClick={() => setAddingEvent(true)}>Add an event</button>}
            </p>
            {addingEvent && (
              <EventForm
                key={watchFirst ? "find" : "dated"}
                find={watchFirst}
                auth={auth}
                busy={busy === "event"}
                onCancel={() => setAddingEvent(false)}
                onAdd={(p) => act("event", async () => { await run("addCrewEvent", auth, p); setAddingEvent(false); })}
                onWatch={(q) => act("event", async () => { await run("addCrewEventWatch", auth, { query: q }); setAddingEvent(false); })}
              />
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-2xl bg-[#3A2321] px-4 py-3 text-sm text-fm-danger">{error}</p>}

      {(book.watching?.length ?? 0) > 0 && (
        <div className="mt-6 lg:mr-[428px]">
          <WatchingStrip items={book.watching!} auth={auth} isOwner={isOwner} onChange={refresh} />
        </div>
      )}

      {canAdd && (
        <div className="mt-6 lg:mr-[428px]">
          <ShareFromInstagramHint crewName={crewName} inApp={inApp} auth={auth} hiddenTips={hiddenTips} />
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-10 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12">
        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between lg:mb-5">
            <Eyebrow>In the book · {shared.length}</Eyebrow>
            <div role="group" aria-label="Sort" className="flex rounded-full border border-fm-line-dim bg-fm-surface p-[3px]">
              {([["wanted", "Most wanted"], ["new", "New"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={sort === key}
                  onClick={() => setSort(key)}
                  className={`h-8 rounded-full px-3 text-[13px] lg:h-9 lg:px-3.5 ${sort === key ? "bg-fm-ink font-semibold text-fm-canvas" : "font-medium text-fm-ink-2 hover:text-fm-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {shared.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-fm-line px-6 py-12 text-center lg:min-h-[320px] lg:justify-center">
              <p className="m-0 font-fm-serif text-[28px] leading-tight lg:text-[32px]">Empty so far.</p>
              <p className="m-0 max-w-[36ch] text-[15px] leading-relaxed text-fm-ink-2">
                {canAdd ? "Search for a place, or add one from your saves. Leaf plans nights from here first." : "Join the crew to add places."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-fm-line-dim lg:grid lg:grid-cols-3 lg:gap-4 lg:divide-y-0">
              {shared.map((s) => <SpotItem key={s.spotId} s={s} busy={busy} act={act} auth={auth} isOwner={isOwner} />)}
            </ul>
          )}
        </section>

        {/* On desktop the saves stick beside the book and scroll inside their own panel, however many there are. */}
        <aside className="min-w-0 rounded-[28px] border border-fm-line-dim bg-fm-surface px-5 pb-2 pt-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto lg:px-6 lg:pt-6">
          <div className="flex items-center justify-between">
            <h2 className="m-0 font-fm-serif text-[28px] font-normal lg:text-[30px]">Your saves</h2>
            <span className="flex items-center gap-1.5 text-xs text-fm-muted"><Lock size={13} aria-hidden /> Only you see this</span>
          </div>
          {mine.length === 0 ? (
            <p className="mb-4 mt-2 text-[15px] text-fm-ink-2">Nothing saved yet. Places you save on Leaf show up here, ready to add in one tap.</p>
          ) : (
            <ul className="divide-y divide-fm-line-dim">
              {(showAllSaves ? mine : mine.slice(0, 8)).map((p) => (
                <li key={p.bookmarkId} className="flex items-center gap-3 py-3.5">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-fm-line bg-fm-card">
                    <PlacePhoto
                      src={p.photo}
                      locationId={p.locationId}
                      fallback={<span aria-hidden className="absolute inset-0 flex items-center justify-center font-fm-serif text-[22px] text-fm-knob">{p.name.charAt(0)}</span>}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold lg:text-[15px]">{p.name}</div>
                    <div className="truncate text-[13px] text-fm-muted">{[p.neighborhood, p.category].filter(Boolean).join(" · ")}</div>
                  </div>
                  {p.inBook ? (
                    <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-fm-ink-2"><Check size={14} strokeWidth={2.4} aria-hidden /> In the book</span>
                  ) : (
                    <Button small disabled={busy !== null || !canAdd} onClick={() => act(p.bookmarkId, () => run("addToCrewBook", auth, { bookmarkId: p.bookmarkId }))}>
                      <Plus size={14} strokeWidth={2.4} aria-hidden /> Add<span className="sr-only"> {p.name} to {crewName}</span>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {mine.length > 8 && (
            <button className="mb-2 mt-1 text-sm font-medium text-fm-ink underline underline-offset-4" onClick={() => setShowAllSaves(!showAllSaves)}>
              {showAllSaves ? "Show fewer" : `Show all ${mine.length}`}
            </button>
          )}

          <div className="mt-4 border-t border-fm-line-dim pt-5">
            <h2 className="m-0 font-fm-serif text-[28px] font-normal lg:text-[30px]">Find places</h2>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void findPlaces(); }}>
              <input
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                placeholder="What are you in the mood for?"
                className="min-w-0 flex-1 rounded-full border border-fm-line bg-fm-card px-4 py-2.5 text-[15px] text-fm-ink placeholder:text-fm-muted"
              />
              <Button small disabled={finding || vibe.trim().length < 3} type="submit">{finding ? "Looking…" : "Find"}</Button>
            </form>
            <p className="mb-1 mt-2 text-[13px] text-fm-muted">Try &ldquo;coffee shops in Boerum Hill&rdquo; or &ldquo;cheap Thai near Atlantic Ave&rdquo;.</p>
            {found && (found.length ? (
              <ul className="divide-y divide-fm-line-dim">{found.map((p) => suggestionRow(p))}</ul>
            ) : <p className="mt-2 text-[15px] text-fm-ink-2">{findNote || "Nothing matched. Try different words."}</p>)}
          </div>

          {(book.popular?.length ?? 0) > 0 && (
            <>
              <div className="mt-4 flex items-center justify-between border-t border-fm-line-dim pt-5">
                <h2 className="m-0 font-fm-serif text-[28px] font-normal lg:text-[30px]">Popular nearby</h2>
              </div>
              <ul className="divide-y divide-fm-line-dim">{book.popular!.map((p) => suggestionRow(p))}</ul>
            </>
          )}
        </aside>
      </div>
    </CrewShell>
  );
}

function SpotItem({ s, busy, act, auth, isOwner }: {
  s: BookSpot; busy: string | null; act: (key: string, fn: () => Promise<unknown>) => Promise<void>; auth: CrewAuth;
  /** The organizer can take anything out of the book, not only their own adds. */
  isOwner: boolean;
}) {
  const inApp = useInApp();
  const tried = toDate(s.triedAt);
  const triedLabel = tried ? `Tried ${tried.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : null;
  // A dated event: its name and day while it's ahead; once passed, a tag and
  // a dimmed row (the server has already moved it to the bottom).
  const eventLabel = s.eventPassed
    ? `${s.eventKind === "movie" ? "Movie" : "Event"} passed${s.eventTitle ? ` · ${s.eventTitle}` : ""}`
    : s.eventStart
      ? `${s.eventTitle || (s.eventKind === "movie" ? "Movie" : "Event")} · ${windowLabel(s.eventStart, s.eventEnd || s.eventStart)}`
      : null;
  const on = s.upvotedByMe;
  return (
    <li className={`flex items-center gap-3.5 py-3.5 lg:flex-col${s.eventPassed ? " opacity-60" : ""} lg:items-stretch lg:gap-3.5 lg:rounded-3xl lg:border lg:border-fm-line-dim lg:bg-fm-surface lg:p-3 lg:pb-4`}>
      <a href={spotHref(s, inApp)} target={inApp ? undefined : "_blank"} rel="noreferrer" className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-fm-line bg-fm-card lg:h-[180px] lg:w-full lg:border-0">
        <PlacePhoto
          src={s.photo || s.plan?.imageUrl}
          locationId={s.locationId}
          fallback={
            <span aria-hidden className="absolute inset-0 flex items-center justify-center font-fm-serif text-[28px] text-fm-knob lg:inset-auto lg:bottom-3 lg:left-3 lg:text-[64px] lg:leading-[0.8] lg:text-fm-line">
              {s.name.charAt(0)}
            </span>
          }
        />
        {triedLabel && (
          <span className="absolute bottom-3 right-3 hidden h-[26px] items-center gap-1 rounded-full bg-fm-canvas px-2.5 text-xs text-fm-ink-2 lg:flex">
            <Check size={12} strokeWidth={2.6} aria-hidden /> {triedLabel}
          </span>
        )}
      </a>
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:px-1">
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <a href={spotHref(s, inApp)} target={inApp ? undefined : "_blank"} rel="noreferrer" className="truncate text-base font-semibold hover:underline lg:text-[17px]">{s.name}</a>
          <div className="truncate text-[13px] text-fm-muted">
            {[s.neighborhood, s.category].filter(Boolean).join(" · ")}
            <span className="lg:hidden">{s.addedBy && ` · added by ${s.addedByMe ? "you" : s.addedBy}`}</span>
          </div>
          {s.addedBy && <div className="hidden truncate text-xs text-fm-muted lg:block">Added by {s.addedByMe ? "you" : s.addedBy}</div>}
          {s.plan && (s.plan.title || s.plan.description) && (
            <div className="mt-1 flex flex-col gap-1 rounded-xl border border-fm-line-dim bg-fm-canvas px-3 py-2">
              {s.plan.title && <span className="line-clamp-2 text-[13px] font-semibold text-fm-ink">{s.plan.title}</span>}
              {s.plan.description && <span className="line-clamp-3 text-xs leading-snug text-fm-muted">{s.plan.description}</span>}
              {(s.plan.videoUrl || s.plan.sourceUrl) && (
                <span className="flex gap-3 text-xs font-semibold">
                  {s.plan.videoUrl && <a href={s.plan.videoUrl} target="_blank" rel="noreferrer" className="text-fm-ink underline underline-offset-2">Watch the video</a>}
                  {s.plan.sourceUrl && <a href={s.plan.sourceUrl} target="_blank" rel="noreferrer" className="text-fm-ink-2 underline underline-offset-2">See the post</a>}
                </span>
              )}
            </div>
          )}
          {s.needsPlace && <PlaceForPlan s={s} act={act} auth={auth} />}
          {eventLabel && (
            <span className={`mt-0.5 flex h-[22px] w-fit max-w-full items-center gap-1 rounded-full border px-2 text-[11px] ${s.eventPassed ? "border-fm-line-dim text-fm-muted" : "border-fm-line text-fm-ink-2"}`}>
              <CalendarDays size={12} aria-hidden className="shrink-0" /> <span className="truncate">{eventLabel}</span>
            </span>
          )}
          {triedLabel && (
            <span className="mt-0.5 flex h-[22px] w-fit items-center gap-1 rounded-full border border-fm-line px-2 text-[11px] text-fm-ink-2 lg:hidden">
              <Check size={12} strokeWidth={2.6} aria-hidden /> {triedLabel}
            </span>
          )}
          {(s.triggerLabel || ((s.addedByMe || isOwner) && !s.needsPlace)) && (
            <WeatherRule s={s} act={act} auth={auth} canEdit={Boolean(s.addedByMe || isOwner)} />
          )}
          {(s.addedByMe || isOwner) && (
            <button
              className="w-fit text-xs text-fm-muted hover:text-fm-danger"
              disabled={busy !== null}
              onClick={() => act(`rm-${s.spotId}`, () => run("removeFromCrewBook", auth, { spotId: s.spotId }))}
            >
              Remove
            </button>
          )}
        </div>
        <button
          type="button"
          aria-pressed={on}
          aria-label={`Want to go to ${s.name}, ${s.upvotes} ${s.upvotes === 1 ? "vote" : "votes"}`}
          disabled={busy !== null}
          onClick={() => act(s.spotId, () => run("toggleCrewSpotUpvote", auth, { spotId: s.spotId }))}
          className={`flex h-14 w-[52px] shrink-0 flex-col items-center justify-center gap-px rounded-[18px] border transition disabled:opacity-60 ${
            on ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line text-fm-ink hover:border-fm-ink-2"
          }`}
        >
          <ChevronUp size={16} strokeWidth={2.4} aria-hidden />
          <span className={`text-sm ${on ? "font-bold" : "font-semibold"}`}>{s.upvotes}</span>
        </button>
      </div>
    </li>
  );
}

const fmtYmd = (ymd: string, weekday = false) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString("en-US", { ...(weekday ? { weekday: "short" as const } : {}), month: "short", day: "numeric" });

/** "Sat, Oct 18" · "Until Nov 5" · "Oct 10 – Nov 5" */
function windowLabel(start: string, end: string) {
  if (start === end) return fmtYmd(start, true);
  const today = new Date().toLocaleDateString("en-CA");
  return start <= today ? `Until ${fmtYmd(end)}` : `${fmtYmd(start)} – ${fmtYmd(end)}`;
}

type PickedVenue = { placeId?: string | null; name: string; address?: string | null; lat?: number | null; lng?: number | null };

/** Reads like a team, a show or a tour, not a place: the search's Watch for row goes first. */
function looksLikeEvent(q: string) {
  return /\b(vs\.?|versus|game|games|tour|tickets?|concert|comedy|comedian|show|live|festival|plays?|playing|season)\b/i.test(q);
}

type Found = { title: string; date: string; time: string | null; venueName: string; image: string | null };

/** "Sat, Nov 15" for a 'YYYY-MM-DD'. */
function shortDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "19:30" → "7:30". */
function clock12(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")}`;
}

/**
 * Add an event: what it is, then "Do you know the date?"
 *   - One date / Date range: where and when (one night, or a run like a movie
 *     in theaters). Leaf only polls dates inside them; for a movie, at real
 *     showtimes when it has them.
 *   - No, Leaf finds it: a watch (BETA), with a preview of what Leaf finds.
 */
function EventForm({ auth, onAdd, onWatch, onCancel, busy, find = false }: { auth: CrewAuth; onAdd: (p: Record<string, unknown>) => void; onWatch: (query: string) => void; onCancel: () => void; busy: boolean; find?: boolean }) {
  const today = new Date().toLocaleDateString("en-CA");
  const [kind, setKind] = useState<"event" | "movie">("event");
  const [title, setTitle] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [place, setPlace] = useState<PickedVenue | null>(null);
  const [when, setWhen] = useState<"one" | "range" | "find">(find ? "find" : "one");
  const run2 = when === "range";
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  // "No, Leaf finds it": what Leaf would find, looked up as they type.
  const [lookup, setLookup] = useState<{ q: string; matches: Found[] } | null>(null);
  const q = title.trim();
  const found = when === "find" && lookup?.q === q ? lookup.matches : null;
  useEffect(() => {
    if (when !== "find" || q.length < 3) return;
    let live = true;
    const t = setTimeout(() => {
      run<{ matches: Found[] }>("previewCrewEvent", auth, { query: q })
        .then((r) => { if (live) setLookup({ q, matches: r.matches }); })
        .catch(() => { if (live) setLookup({ q, matches: [] }); });
    }, 700);
    return () => { live = false; clearTimeout(t); };
  }, [q, when, auth]);
  const field = "h-11 w-full rounded-xl border border-fm-line bg-fm-canvas px-3 text-[16px] text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none";
  const chip = (on: boolean) => `flex h-10 items-center rounded-full border px-4 text-sm font-semibold ${on ? "border-fm-accent bg-fm-accent text-fm-canvas" : "border-fm-line text-fm-ink hover:bg-fm-card"}`;
  const ready = title.trim() && place && start && (!run2 || (end && end >= start));
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[24px] border border-fm-line-dim bg-fm-surface p-4 lg:p-5">
      {when !== "find" && (
        <div className="flex gap-2">
          <button type="button" className={chip(kind === "event")} aria-pressed={kind === "event"} onClick={() => setKind("event")}>Event</button>
          <button type="button" className={chip(kind === "movie")} aria-pressed={kind === "movie"} onClick={() => { setKind("movie"); setWhen("range"); }}>Movie</button>
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-fm-ink-2">{kind === "movie" && when !== "find" ? "Which movie?" : "What is it?"}</span>
        <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "movie" && when !== "find" ? "The movie's title" : "A show, exhibit, game: Nets vs. Rockets"} maxLength={when === "find" ? 80 : 120} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-fm-ink-2">Do you know the date?</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(when === "one")} aria-pressed={when === "one"} onClick={() => setWhen("one")}>One date</button>
          <button type="button" className={chip(when === "range")} aria-pressed={when === "range"} onClick={() => setWhen("range")}>{kind === "movie" ? "In theaters" : "Date range"}</button>
          <button type="button" className={chip(when === "find")} aria-pressed={when === "find"} onClick={() => { setWhen("find"); setKind("event"); }}>No, Leaf finds it</button>
        </div>
      </div>
      {when === "find" ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-fm-line bg-fm-canvas p-3.5">
          <span className="font-fm-mono text-[10px] uppercase tracking-[0.1em] text-fm-accent">{found?.length ? "Leaf found" : "Leaf looks every week"} · BETA</span>
          {found?.map((f) => (
            <div key={`${f.date}-${f.venueName}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{f.venueName}</span>
              <span className="shrink-0 text-fm-muted">{shortDate(f.date)}{f.time ? ` · ${clock12(f.time)}` : ""}</span>
            </div>
          ))}
          {found && !found.length && title.trim().length >= 3 && <span className="text-sm text-fm-muted">No dates near you yet.</span>}
          <span className="text-xs leading-relaxed text-fm-muted">Leaf keeps looking every week. When a date fits, the organizer gets &ldquo;It&rsquo;s a go?&rdquo; and one tap sends the invites.</span>
        </div>
      ) : (
      <>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-fm-ink-2">{kind === "movie" ? "Which theater?" : "Where?"}</span>
        {place ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-fm-line px-3 py-2.5 text-sm">
            <span className="truncate">{place.name}</span>
            <button type="button" className="text-xs text-fm-muted underline" onClick={() => setPlace(null)}>Change</button>
          </div>
        ) : (
          <VenueSearch value={placeQuery} onChange={setPlaceQuery} onSelect={(v) => setPlace(v as PickedVenue)} placeholder="Search for the place" className="h-11 w-full rounded-xl border px-3 text-[16px] outline-none" />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" className={`${field} max-w-[180px]`} min={today} value={start} onChange={(e) => setStart(e.target.value)} aria-label={run2 ? "From" : "Date"} />
          {run2 && (
            <>
              <span className="text-sm text-fm-muted">to</span>
              <input type="date" className={`${field} max-w-[180px]`} min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Until" />
            </>
          )}
        </div>
        <p className="m-0 text-xs text-fm-muted">Leaf only suggests nights {run2 ? "between these dates" : "on this date"}{kind === "movie" ? ", at real showtimes when it has them" : ""}.</p>
      </div>
      </>
      )}
      <div className="flex gap-2">
        {when === "find" ? (
          <Button small disabled={title.trim().length < 2 || busy} onClick={() => onWatch(title.trim())}>{busy ? "Adding…" : "Watch for it"}</Button>
        ) : (
          <Button small disabled={!ready || busy} onClick={() => onAdd({ title: title.trim(), kind, start, end: run2 ? end : start, placeId: place?.placeId || null, venue: place })}>
            {busy ? "Adding…" : "Add to the book"}
          </Button>
        )}
        <Button small kind="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

/**
 * A shared plan with no place yet (an Instagram post that named none): ask
 * where it is, so Leaf can plan a night for it.
 */
const WEEK = ["S", "M", "T", "W", "T", "F", "S"];
const WEEK_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * "Go when it's nice" (BETA): a weather rule on this place. Leaf watches the
 * forecast here, gives the crew a heads-up when a day clears it, and asks
 * who's in 3 days before. Shown as a chip; whoever added the place (or the
 * organizer) sets or clears it.
 */
function WeatherRule({ s, act, auth, canEdit }: { s: BookSpot; act: (key: string, fn: () => Promise<unknown>) => Promise<void>; auth: CrewAuth; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const wx = s.trigger?.kind === "weather" ? s.trigger : null;
  const [minF, setMinF] = useState(wx?.minF ?? 80);
  const [noRain, setNoRain] = useState(wx?.noRain ?? true);
  const [days, setDays] = useState<number[]>(wx?.days ?? [6, 0]);
  const [time, setTime] = useState(wx?.time ?? "14:00");
  // A watched event: Leaf searches for it weekly; nothing to edit here (Remove drops it).
  if (s.trigger?.kind === "event") {
    return (
      <span className="mt-0.5 flex h-[24px] w-fit max-w-full items-center gap-1 rounded-full border border-fm-accent px-2 text-[11px] text-fm-accent">
        <Search size={12} aria-hidden className="shrink-0" /> <span className="truncate">{s.triggerLabel}</span>
      </span>
    );
  }
  const save = (trigger: Record<string, unknown> | null) =>
    act(`wx-${s.spotId}`, async () => { await run("setCrewSpotTrigger", auth, { spotId: s.spotId, trigger }); setOpen(false); });

  if (!open) {
    return s.triggerLabel ? (
      <button type="button" disabled={!canEdit} onClick={() => setOpen(true)}
        className="mt-0.5 flex h-[24px] w-fit max-w-full items-center gap-1 rounded-full border border-fm-accent px-2 text-[11px] text-fm-accent disabled:cursor-default">
        <Sun size={12} aria-hidden className="shrink-0" /> <span className="truncate">Goes when it&rsquo;s nice · {s.triggerLabel}</span>
      </button>
    ) : (
      <button type="button" onClick={() => setOpen(true)} className="mt-0.5 flex h-8 w-fit items-center gap-1.5 rounded-full border border-fm-line px-3 text-xs font-semibold text-fm-ink-2 hover:bg-fm-card">
        <Sun size={13} aria-hidden /> Go when it&rsquo;s nice <span className="font-fm-mono text-[9px] text-fm-accent">BETA</span>
      </button>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-2.5 rounded-xl border border-fm-line bg-fm-canvas p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-fm-ink-2">At least</span>
        <span className="flex items-center gap-2">
          <button type="button" aria-label="Cooler" onClick={() => setMinF(Math.max(50, minF - 5))} className="h-8 w-8 rounded-full border border-fm-line">&minus;</button>
          <span className="w-10 text-center font-fm-serif text-[19px]">{minF}&deg;</span>
          <button type="button" aria-label="Warmer" onClick={() => setMinF(Math.min(100, minF + 5))} className="h-8 w-8 rounded-full border border-fm-line">+</button>
        </span>
      </div>
      <label className="flex items-center justify-between font-semibold text-fm-ink-2">No rain
        <input type="checkbox" checked={noRain} onChange={(e) => setNoRain(e.target.checked)} className="h-5 w-5 accent-[var(--color-fm-accent)]" />
      </label>
      <div className="flex gap-1">
        {WEEK.map((d, i) => {
          const on = days.includes(i);
          return (
            <button key={i} type="button" aria-label={WEEK_NAMES[i]} aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i])}
              className={`h-9 flex-1 rounded-lg border text-xs font-semibold ${on ? "border-fm-accent bg-fm-accent text-fm-canvas" : "border-fm-line text-fm-ink-2"}`}>{d}</button>
          );
        })}
      </div>
      <div className="flex gap-2">
        {[{ t: "14:00", l: "Afternoon" }, { t: "18:00", l: "Evening" }].map((o) => (
          <button key={o.t} type="button" aria-pressed={time === o.t} onClick={() => setTime(o.t)}
            className={`h-8 flex-1 rounded-full border text-xs font-semibold ${time === o.t ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line text-fm-ink-2"}`}>{o.l}</button>
        ))}
      </div>
      <p className="m-0 text-xs text-fm-muted">Leaf watches the 10-day forecast here. When a day looks good, the crew gets a heads-up, then a &ldquo;who&rsquo;s in?&rdquo; 3 days before.</p>
      <div className="flex flex-wrap gap-2">
        <Button small disabled={days.length === 0} onClick={() => void save({ kind: "weather", minF, noRain, days, time })}>{s.triggerLabel ? "Save" : "Turn on"}</Button>
        {s.triggerLabel && <Button small kind="ghost" onClick={() => void save(null)}>Turn off</Button>}
        <Button small kind="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function PlaceForPlan({ s, act, auth }: { s: BookSpot; act: (key: string, fn: () => Promise<unknown>) => Promise<void>; auth: CrewAuth }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 flex h-9 w-fit items-center gap-1.5 rounded-full border border-fm-line px-3 text-xs font-semibold text-fm-ink hover:bg-fm-card">
        <Search size={13} aria-hidden /> Where is this? Add the place
      </button>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <VenueSearch
        value={q}
        onChange={setQ}
        onSelect={(v) => act(`place:${s.spotId}`, async () => { await run("setCrewSpotPlace", auth, { spotId: s.spotId, placeId: v.placeId, venue: v }); setOpen(false); })}
        placeholder="Search for the place"
        className="h-10 w-full rounded-xl border px-3 text-[15px] outline-none"
      />
      <span className="text-[11px] text-fm-muted">Leaf plans a night for it once it has a place.</span>
    </div>
  );
}
