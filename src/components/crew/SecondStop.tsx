"use client";

/**
 * A stop after the night's place (getCrewStops). Leaf suggests up to three
 * places a short walk away that go with it (dinner, then drinks, dessert or
 * a walk). Members upvote suggestions; the night's host (or the organizer)
 * adds one in a tap and it goes on the plan as its second stop. Once added
 * it's just part of the plan: no votes, and the other suggestions fold into
 * "Other stops nearby" (only the host can swap).
 */

import { useCallback, useEffect, useState } from "react";
import { run, type CrewAuth } from "@/lib/crew";

type Suggestion = {
  key: string; name: string; address: string | null; kind: string; kindLabel: string; walkMin: number;
  fromBook: boolean; votes: number; myVote: boolean; locationId: string | null; placeId: string | null;
};
type Added = { locationId: string; name: string; address: string | null; kindLabel: string | null; walkMin: number; addedByName: string | null };
type Stops = { canAdd: boolean; hostName?: string | null; venueName?: string | null; added: Added | null; suggestions: Suggestion[] };

function placeHref(p: { locationId: string | null; placeId?: string | null; name: string; address: string | null }, inApp: boolean) {
  if (inApp && p.locationId) return `leaf://location/${p.locationId}`;
  if (p.placeId) return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.placeId)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.address].filter(Boolean).join(" "))}`;
}

export default function SecondStop({ auth, cycleId, inApp, onChanged }: { auth: CrewAuth; cycleId: string; inApp: boolean; onChanged?: () => void }) {
  const [stops, setStops] = useState<Stops | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showOthers, setShowOthers] = useState(false);

  const load = useCallback(async () => {
    try {
      setStops(await run<Stops>("getCrewStops", auth, { cycleId }));
    } catch {
      setStops({ canAdd: false, added: null, suggestions: [] });
    }
  }, [auth, cycleId]);
  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, name: string, params: Record<string, unknown>) => {
    setBusy(key);
    setError("");
    try {
      await run(name, auth, { cycleId, ...params });
      await load();
      setShowOthers(false);
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  if (!stops || (!stops.added && stops.suggestions.length === 0)) return null;
  const { canAdd, added, suggestions } = stops;
  const pillInfo = (s: Suggestion) => [s.kindLabel, `${s.walkMin} min walk`, s.fromBook ? "from the book" : null].filter(Boolean).join(" · ");

  const hostPill = (s: Suggestion) => (
    <button
      key={s.key}
      type="button"
      disabled={busy !== null}
      onClick={() => void act(`add-${s.key}`, "addCrewStop", { key: s.key })}
      className="flex min-h-11 items-center gap-2.5 rounded-full border border-fm-line bg-fm-card px-4 text-left disabled:opacity-60"
    >
      <span className="text-base font-bold text-fm-accent" aria-hidden>+</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-fm-ink">{busy === `add-${s.key}` ? "Adding…" : s.name}</span>
        <span className="truncate text-xs text-fm-muted">{pillInfo(s)}{s.votes > 0 ? ` · ▲ ${s.votes}` : ""}</span>
      </span>
    </button>
  );
  const memberPill = (s: Suggestion, votable: boolean) => (
    <div key={s.key} className="flex min-h-11 items-center gap-2.5 rounded-full border border-fm-line bg-fm-card py-1 pl-4 pr-1.5">
      <a href={placeHref(s, inApp)} target={inApp ? undefined : "_blank"} rel="noreferrer" className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-fm-ink">{s.name}</span>
        <span className="truncate text-xs text-fm-muted">{pillInfo(s)}</span>
      </a>
      {votable && (
        <button
          type="button"
          aria-pressed={s.myVote}
          aria-label={s.myVote ? `Take back your upvote for ${s.name}` : `Upvote ${s.name}`}
          disabled={busy !== null}
          onClick={() => void act(`vote-${s.key}`, "voteCrewStop", { key: s.key, on: !s.myVote })}
          className={`h-9 shrink-0 rounded-full px-3 text-xs font-bold disabled:opacity-60 ${s.myVote ? "bg-fm-accent text-fm-canvas" : "border border-fm-line text-fm-ink"}`}
        >
          ▲ {s.votes}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5 border-t border-fm-line-dim pt-4">
      {added ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-fm-mono text-[11px] uppercase tracking-[0.08em] text-fm-muted">Then</span>
            <a href={placeHref(added, inApp)} target={inApp ? undefined : "_blank"} rel="noreferrer" className="font-fm-serif text-[24px] leading-tight text-fm-ink underline decoration-fm-line decoration-1 underline-offset-[5px]">
              {added.name}
            </a>
          </div>
          <p className="m-0 text-sm text-fm-muted">
            {[added.kindLabel ? `${added.kindLabel} after` : null, `${added.walkMin} min walk`, added.addedByName ? `added by ${added.addedByName}` : null].filter(Boolean).join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {suggestions.length > 0 && (
              <button type="button" aria-expanded={showOthers} onClick={() => setShowOthers((v) => !v)} className="min-h-11 text-sm text-fm-muted underline underline-offset-4 hover:text-fm-ink">
                Other stops nearby · {suggestions.length}
              </button>
            )}
            {canAdd && (
              <button type="button" disabled={busy !== null} onClick={() => void act("remove", "removeCrewStop", {})} className="min-h-11 text-sm text-fm-muted underline underline-offset-4 hover:text-fm-danger">
                {busy === "remove" ? "Removing…" : "Remove this stop"}
              </button>
            )}
          </div>
          {showOthers && (
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (canAdd ? hostPill(s) : memberPill(s, false)))}
              {canAdd && <p className="m-0 px-1 text-xs text-fm-muted">Tap one to swap it in.</p>}
            </div>
          )}
        </>
      ) : (
        <>
          <span className="font-fm-mono text-[11px] uppercase tracking-[0.08em] text-fm-muted">
            {canAdd ? `Add a stop · near ${stops.venueName || "the place"}` : `A stop after? · ${stops.hostName || "The host"} decides`}
          </span>
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => (canAdd ? hostPill(s) : memberPill(s, true)))}
          </div>
        </>
      )}
      {error && <p className="m-0 text-sm text-fm-danger">{error}</p>}
    </div>
  );
}
