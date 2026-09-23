"use client";

/**
 * "I've got one" — a member proposes their own place and 1–3 dates.
 * One date locks straight away; 2–3 become a normal poll.
 */

import { useState } from "react";
import VenueSearch from "@/components/VenueSearch";
import { Button, Card, Eyebrow } from "@/components/crew/CrewShell";
import { run, type CrewAuth } from "@/lib/crew";

type Venue = { name: string; address: string; placeId: string };

export default function ProposeNight({ auth, onDone, onCancel }: { auth: CrewAuth; onDone: () => Promise<void>; onCancel: () => void }) {
  const [query, setQuery] = useState("");
  const [venue, setVenue] = useState<Venue | null>(null);
  const [dates, setDates] = useState<string[]>([""]);
  const [time, setTime] = useState("19:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const clean = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const submit = async () => {
    if (!venue) { setError("Pick a place."); return; }
    if (!clean.length) { setError("Pick at least one date."); return; }
    setBusy(true);
    setError("");
    try {
      const r = await run<{ started: boolean; reason?: string }>("proposeCrewNight", auth, {
        placeId: venue.placeId,
        venue: { name: venue.name, address: venue.address, placeId: venue.placeId },
        options: clean.map((date) => ({ date, time })),
      });
      if (!r.started) {
        setError(r.reason === "member_limit" ? "You already have a night being planned." : "There's already a night being planned. Jump in on that one.");
        return;
      }
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't propose that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6 border-leaf-200">
      <Eyebrow>I&rsquo;ve got one</Eyebrow>
      <p className="mt-1 text-sm text-zinc-600">Pick a place and up to 3 dates. One date goes straight to IN/OUT; more become a vote.</p>
      <div className="mt-3">
        <VenueSearch
          value={query}
          onChange={(v) => { setQuery(v); if (venue && v !== venue.name) setVenue(null); }}
          onSelect={(v) => { setVenue(v); setQuery(v.name); }}
          placeholder="Where?"
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px]"
        />
        {venue && <p className="mt-1 text-xs text-zinc-500">{venue.address}</p>}
      </div>
      <div className="mt-3 space-y-2">
        {dates.map((d, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="date"
              value={d}
              onChange={(e) => setDates(dates.map((x, j) => (j === i ? e.target.value : x)))}
              className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-[15px]"
            />
            {dates.length > 1 && (
              <button type="button" className="text-sm text-zinc-500" onClick={() => setDates(dates.filter((_, j) => j !== i))}>Remove</button>
            )}
          </div>
        ))}
        {dates.length < 3 && (
          <button type="button" className="text-sm text-leaf-700 hover:underline" onClick={() => setDates([...dates, ""])}>+ another date</button>
        )}
        <div className="flex items-center gap-2 text-sm text-zinc-700">
          <label htmlFor="propose-time">Time</label>
          <input id="propose-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-xl border border-zinc-300 px-3 py-1.5" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={busy}>{busy ? "Sending…" : clean.length > 1 ? "Ask everyone" : "Propose it"}</Button>
        <Button kind="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </Card>
  );
}
