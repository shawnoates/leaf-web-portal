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
import { Check, ChevronLeft, ChevronUp, Lock, Plus, Search } from "lucide-react";
import VenueSearch from "@/components/VenueSearch";
import { useCrewAuth } from "@/components/crew/useCrewAuth";
import { Button, CrewShell, CrewTopBar, DeadState, DisplayTitle, Eyebrow, Spinner } from "@/components/crew/CrewShell";
import { crewHref, run, toDate, type BookSpot, type CrewAuth, type SavedPlace } from "@/lib/crew";

type Book = { crew: { id: string; name: string }; shared: BookSpot[]; mine: SavedPlace[] };

export default function CrewBookClient({ token }: { token: string }) {
  const load = useCrewAuth(token);
  if (load.status === "loading") return <Spinner label="Opening the book…" />;
  if (load.status === "expired") return <DeadState title="This link has expired." body="Text PLAN to the number Leaf wrote from and you'll get a fresh one." />;
  if (load.status === "error") return <DeadState title="Couldn't open the book." body={load.message} />;
  return <BookView auth={load.auth} crewName={load.data.crew.name} canAdd={load.data.me.status === "in"} />;
}

function BookView({ auth, crewName, canAdd }: { auth: CrewAuth; crewName: string; canAdd: boolean }) {
  const [book, setBook] = useState<Book | null>(null);
  const [sort, setSort] = useState<"wanted" | "new">("wanted");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  return (
    <CrewShell wide topBar={<CrewTopBar auth={auth} active="book" />}>
      <Link href={crewHref(auth)} className="-ml-2 mb-2 flex min-h-11 w-fit items-center gap-0.5 px-2 text-sm font-semibold text-fm-ink-2 hover:text-fm-ink lg:hidden">
        <ChevronLeft size={20} aria-hidden /> {crewName}
      </Link>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <div className="flex flex-col gap-2.5 lg:gap-3">
          <span className="hidden text-sm text-fm-muted lg:block">{crewName}</span>
          <DisplayTitle italic="book">The</DisplayTitle>
          <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">Places the crew wants to go. Leaf plans nights from here first.</p>
        </div>
        {canAdd && (
          <div className="lg:w-[480px]">
            <label className="relative block">
              <span className="sr-only">Add a place</span>
              <Search size={18} aria-hidden className="pointer-events-none absolute left-[18px] top-1/2 z-10 -translate-y-1/2 text-fm-muted" />
              <VenueSearch
                value={query}
                onChange={setQuery}
                onSelect={(v) => act("search", async () => { await run("addToCrewBook", auth, { placeId: v.placeId, venue: v }); setQuery(""); })}
                placeholder="Add a restaurant, bar, anything"
                className="h-14 w-full rounded-full border pl-12 pr-5 text-[15px] outline-none"
              />
            </label>
            <p className="mb-0 ml-5 mt-2 text-xs text-fm-muted">Goes into the book and your own saves.</p>
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-2xl bg-[#3A2321] px-4 py-3 text-sm text-fm-danger">{error}</p>}

      <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12">
        <section>
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
              {shared.map((s) => <SpotItem key={s.spotId} s={s} busy={busy} act={act} auth={auth} />)}
            </ul>
          )}
        </section>

        {/* On desktop the saves stick beside the book and scroll inside their own panel, however many there are. */}
        <aside className="rounded-[28px] border border-fm-line-dim bg-fm-surface px-5 pb-2 pt-5 lg:sticky lg:top-6 lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto lg:px-6 lg:pt-6">
          <div className="flex items-center justify-between">
            <h2 className="m-0 font-fm-serif text-[28px] font-normal lg:text-[30px]">Your saves</h2>
            <span className="flex items-center gap-1.5 text-xs text-fm-muted"><Lock size={13} aria-hidden /> Only you see this</span>
          </div>
          {mine.length === 0 ? (
            <p className="mb-4 mt-2 text-[15px] text-fm-ink-2">Nothing saved yet. Places you save on Leaf show up here, ready to add in one tap.</p>
          ) : (
            <ul className="divide-y divide-fm-line-dim">
              {mine.map((p) => (
                <li key={p.bookmarkId} className="flex items-center gap-3 py-4">
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
        </aside>
      </div>
    </CrewShell>
  );
}

function SpotItem({ s, busy, act, auth }: {
  s: BookSpot; busy: string | null; act: (key: string, fn: () => Promise<unknown>) => Promise<void>; auth: CrewAuth;
}) {
  const tried = toDate(s.triedAt);
  const triedLabel = tried ? `Tried ${tried.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : null;
  const on = s.upvotedByMe;
  return (
    <li className="flex items-center gap-3.5 py-3.5 lg:flex-col lg:items-stretch lg:gap-3.5 lg:rounded-3xl lg:border lg:border-fm-line-dim lg:bg-fm-surface lg:p-3 lg:pb-4">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-fm-line bg-fm-card lg:h-[180px] lg:w-full lg:border-0">
        {s.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.photo} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center font-fm-serif text-[28px] text-fm-knob lg:inset-auto lg:bottom-3 lg:left-3 lg:text-[64px] lg:leading-[0.8] lg:text-fm-line">
            {s.name.charAt(0)}
          </span>
        )}
        {triedLabel && (
          <span className="absolute bottom-3 right-3 hidden h-[26px] items-center gap-1 rounded-full bg-fm-canvas px-2.5 text-xs text-fm-ink-2 lg:flex">
            <Check size={12} strokeWidth={2.6} aria-hidden /> {triedLabel}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-3 lg:px-1">
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <div className="truncate text-base font-semibold lg:text-[17px]">{s.name}</div>
          <div className="truncate text-[13px] text-fm-muted">
            {[s.neighborhood, s.category].filter(Boolean).join(" · ")}
            <span className="lg:hidden">{s.addedBy && ` · added by ${s.addedByMe ? "you" : s.addedBy}`}</span>
          </div>
          {s.addedBy && <div className="hidden truncate text-xs text-fm-muted lg:block">Added by {s.addedByMe ? "you" : s.addedBy}</div>}
          {triedLabel && (
            <span className="mt-0.5 flex h-[22px] w-fit items-center gap-1 rounded-full border border-fm-line px-2 text-[11px] text-fm-ink-2 lg:hidden">
              <Check size={12} strokeWidth={2.6} aria-hidden /> {triedLabel}
            </span>
          )}
          {s.addedByMe && (
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
