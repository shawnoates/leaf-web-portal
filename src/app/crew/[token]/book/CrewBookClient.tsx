"use client";

/**
 * The Crew Book — /crew/[token]/book
 *
 * Two lists. The crew's shared book (everyone sees it: who added each place,
 * 👍, tried), and "Your saves" (only you see it) with a one-tap Add. Nothing
 * moves from your saves into the book unless you tap.
 */

import { useCallback, useEffect, useState } from "react";
import VenueSearch from "@/components/VenueSearch";
import { useCrewAuth } from "@/components/crew/useCrewAuth";
import { Button, Card, CrewHeader, CrewShell, DeadState, Eyebrow, Spinner } from "@/components/crew/CrewShell";
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

  return (
    <CrewShell>
      <CrewHeader crewName={`${crewName}'s book`} subtitle="Places the crew wants to go. Leaf plans nights from here first." backHref={crewHref(auth)} backLabel={crewName} />
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {canAdd && (
        <Card className="mb-4">
          <Eyebrow>Add a place</Eyebrow>
          <div className="mt-2">
            <VenueSearch
              value={query}
              onChange={setQuery}
              onSelect={(v) => act("search", async () => { await run("addToCrewBook", auth, { placeId: v.placeId, venue: v }); setQuery(""); })}
              placeholder="Search a restaurant, bar, anything"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px]"
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">Goes into the book and your own saves.</p>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-baseline justify-between">
          <Eyebrow>In the book · {shared.length}</Eyebrow>
          <div className="flex gap-2 text-xs">
            <button className={sort === "wanted" ? "font-medium text-leaf-900" : "text-zinc-500"} onClick={() => setSort("wanted")}>Most wanted</button>
            <button className={sort === "new" ? "font-medium text-leaf-900" : "text-zinc-500"} onClick={() => setSort("new")}>New</button>
          </div>
        </div>
        {shared.length === 0 ? (
          <p className="mt-2 text-[15px] text-zinc-700">Empty so far. Add the first place.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {shared.map((s) => {
              const tried = toDate(s.triedAt);
              return (
                <li key={s.spotId} className="flex items-center gap-3 py-3">
                  {s.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photo} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-lg bg-leaf-50" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-leaf-900">{s.name}</div>
                    <div className="truncate text-xs text-zinc-500">
                      {[s.neighborhood, s.category].filter(Boolean).join(" · ")}
                      {s.addedBy && ` · added by ${s.addedByMe ? "you" : s.addedBy}`}
                      {tried && ` · tried ✓ ${tried.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </div>
                  </div>
                  <button
                    className={`rounded-full px-2.5 py-1 text-sm ${s.upvotedByMe ? "bg-leaf-800 text-white" : "bg-zinc-100 text-zinc-700"}`}
                    disabled={busy !== null}
                    onClick={() => act(s.spotId, () => run("toggleCrewSpotUpvote", auth, { spotId: s.spotId }))}
                    aria-label="Want to go"
                  >
                    👍 {s.upvotes}
                  </button>
                  {s.addedByMe && (
                    <button className="text-xs text-zinc-400 hover:text-red-600" disabled={busy !== null} onClick={() => act(`rm-${s.spotId}`, () => run("removeFromCrewBook", auth, { spotId: s.spotId }))}>
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mb-4">
        <Eyebrow>Your saves · only you see this</Eyebrow>
        {book.mine.length === 0 ? (
          <p className="mt-2 text-[15px] text-zinc-700">Nothing saved yet. Places you save on Leaf show up here, ready to add in one tap.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-100">
            {book.mine.map((p) => (
              <li key={p.bookmarkId} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] text-leaf-900">{p.name}</div>
                  <div className="truncate text-xs text-zinc-500">{[p.neighborhood, p.category].filter(Boolean).join(" · ")}</div>
                </div>
                {p.inBook ? (
                  <span className="text-xs text-leaf-700">In the book ✓</span>
                ) : (
                  <Button small disabled={busy !== null || !canAdd} onClick={() => act(p.bookmarkId, () => run("addToCrewBook", auth, { bookmarkId: p.bookmarkId }))}>
                    Add to {crewName}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </CrewShell>
  );
}
