"use client";

/**
 * The tap-to-add step a new member sees once, just after joining.
 *
 * Optional on purpose. Joining is what gets someone to quorum, so nothing here
 * blocks it — Skip is a real button and the step never comes back. What it's
 * for is ranking signal: the server picks venues by untried-places-by-👍, and
 * a book nobody has voted in gives that nothing to sort on.
 *
 * Two groups, in this order. "Already in the book" first, because tapping one
 * is a second vote for somewhere the crew already likes — cheaper than adding
 * and more useful. Then popular places nearby for a crew whose book is empty.
 */

import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { Button, Eyebrow, SectionTitle, Spinner } from "@/components/crew/CrewShell";
import { run, type CrewAuth } from "@/lib/crew";

type SeedPlace = {
  spotId?: string;
  placeId?: string;
  locationId?: string;
  name: string;
  address?: string | null;
  shortAddress?: string | null;
  category?: string | null;
  upvotes?: number;
  picked?: boolean;
  lat?: number | null;
  lng?: number | null;
  source: "book" | "popular";
};
type SeedData = { crew: { id: string; name: string }; seeded: boolean; book: SeedPlace[]; popular: SeedPlace[] };

const keyOf = (p: SeedPlace) => p.spotId || p.placeId || p.locationId || p.name;

export default function SeedPlaces({
  auth,
  crewName,
  onDone,
  heading = "What do you like?",
}: {
  auth: CrewAuth;
  crewName: string;
  onDone: (result: { added: number; upvoted: number; skipped: boolean }) => void;
  heading?: string;
}) {
  const [data, setData] = useState<SeedData | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  // What was ticked when the step loaded: the person's existing votes. The
  // button counts only what's new since then.
  const [initial, setInitial] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const r = await run<SeedData>("getCrewSeedPlaces", auth);
        if (!live) return;
        setData(r);
        // Places they already voted for start ticked, so the step reads as
        // "here's where you're at" rather than starting from nothing.
        const already = new Set(r.book.filter((p) => p.picked).map(keyOf));
        setChosen(already);
        setInitial(already);
      } catch (err) {
        if (live) setError(err instanceof Error ? err.message : "Couldn't load places.");
      }
    })();
    return () => { live = false; };
  }, [auth]);

  const toggle = (p: SeedPlace) => {
    setChosen((prev) => {
      const next = new Set(prev);
      const k = keyOf(p);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const submit = async (skipped: boolean) => {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const all = [...data.book, ...data.popular];
      // Anything already ticked when the step loaded is an existing vote, so
      // re-sending it would be a no-op — send it anyway and let the server
      // dedupe, rather than tracking two kinds of tick here.
      const picks = skipped ? [] : all.filter((p) => chosen.has(keyOf(p))).map((p) => (
        p.spotId
          ? { spotId: p.spotId }
          // lat/lng ride along so a place the server has to create lands with
          // coordinates — findOrCreateLocationForVenue has nothing else to go on.
          : { placeId: p.placeId, locationId: p.locationId, venue: { name: p.name, address: p.address ?? null, placeId: p.placeId, lat: p.lat ?? null, lng: p.lng ?? null } }
      ));
      const r = await run<{ added: number; upvoted: number }>("seedCrewBook", auth, { picks, skipped });
      onDone({ ...r, skipped });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save those.");
      setBusy(false);
    }
  };

  if (error && !data) return <p className="m-0 text-sm text-fm-muted">{error}</p>;
  if (!data) return <Spinner label="Finding places…" />;

  // Existing votes start ticked and aren't news; "Add 3" for two old votes and
  // one new pick read as three new places.
  const count = [...chosen].filter((k) => !initial.has(k)).length;
  const nothing = data.book.length === 0 && data.popular.length === 0;
  if (nothing) {
    // No book and no nearby places: say so and get out of the way rather than
    // showing an empty step.
    return (
      <div className="flex flex-col gap-4">
        <SectionTitle>{heading}</SectionTitle>
        <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">
          Nothing to show yet. You can add places to {crewName}&rsquo;s book any time.
        </p>
        <Button onClick={() => submit(true)} disabled={busy}>Continue</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <SectionTitle>{heading}</SectionTitle>
        <p className="m-0 text-[15px] leading-relaxed text-fm-ink-2">
          Tap anywhere you&rsquo;d go. Leaf picks {crewName}&rsquo;s nights from these — the more it knows, the better the first one lands.
        </p>
      </div>

      {data.book.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <Eyebrow>Already in the book</Eyebrow>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.book.map((p) => (
              <PlaceRow key={keyOf(p)} place={p} on={chosen.has(keyOf(p))} onTap={() => toggle(p)} />
            ))}
          </ul>
        </section>
      )}

      {data.popular.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <Eyebrow>Popular nearby</Eyebrow>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {data.popular.map((p) => (
              <PlaceRow key={keyOf(p)} place={p} on={chosen.has(keyOf(p))} onTap={() => toggle(p)} />
            ))}
          </ul>
        </section>
      )}

      {error && <p className="m-0 text-sm text-red-400">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={() => submit(false)} disabled={busy || (count === 0 && initial.size === 0)}>
          {busy ? "Saving…" : count > 0 ? `Add ${count}` : initial.size > 0 ? "Done" : "Pick a few"}
        </Button>
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={busy}
          className="border-0 !bg-transparent text-[15px] text-fm-muted underline underline-offset-4 disabled:opacity-40"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function PlaceRow({ place, on, onTap }: { place: SeedPlace; on: boolean; onTap: () => void }) {
  const sub = [place.category, place.shortAddress || place.address].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={onTap}
        aria-pressed={on}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
          on ? "border-fm-ink bg-fm-ink/10" : "border-fm-line bg-fm-surface"
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{place.name}</span>
          {sub && <span className="block truncate text-[13px] text-fm-muted">{sub}</span>}
        </span>
        {typeof place.upvotes === "number" && place.upvotes > 0 && (
          <span className="shrink-0 text-[13px] text-fm-muted">{place.upvotes} 👍</span>
        )}
        <span
          aria-hidden
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
            on ? "border-fm-ink bg-fm-ink text-fm-canvas" : "border-fm-line text-fm-muted"
          }`}
        >
          {on ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2.2} />}
        </span>
      </button>
    </li>
  );
}
