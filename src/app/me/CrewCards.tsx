"use client";

/**
 * Friend Mode on /me: the one thing a crew needs from you (under the hero),
 * the "Your crews" rail, the start-a-crew nudge, and the intro popup.
 * Styled with the same .leafme classes as the rest of the page.
 */

import { useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import EnableFriendModeFlow from "@/components/crew/EnableFriendModeFlow";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";
import { dayLabel, optionLabel, type DateOption, type Venue } from "@/lib/crew";

export type CrewAction =
  | { kind: "invite"; crewId: string; crewName: string; inviterName: string }
  | { kind: "poll"; crewId: string; crewName: string; cycleId: string; venue: Venue | null; dateOptions: DateOption[]; votes: Record<string, number[]> | null }
  | { kind: "rsvp"; crewId: string; crewName: string; cycleId: string; venue: Venue | null; chosenOption: DateOption | null; going: number }
  | { kind: "book"; crewId: string; crewName: string; cycleId: string; venue: Venue | null; chosenOption: DateOption | null; going: number; bookingUrl: string | null };

export type CrewRow = {
  crewId: string;
  name: string;
  memberAvatars: string[];
  status: "active" | "paused" | "invited" | "off";
  statusLine: string;
  nextPlanId: string | null;
  isOwner?: boolean;
  /** The calendar's photo, like the "Calendars you follow" rows. */
  image?: string | null;
};

export type CrewSuggestion = { names: string[]; count: number } | null;
export type FriendModeIntro = { eligible: boolean; suggestions: { userId: string; name: string }[] };

export function CrewActionCard({ actions, onAnswered }: { actions: CrewAction[]; onAnswered: () => Promise<void> }) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const a = actions[index];
  if (!a) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await onAnswered();
      setPicked(new Set());
      if (index < actions.length - 1) setIndex(index + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  const call = (name: string, params: Record<string, unknown>) => Parse.Cloud.run(name, { crewId: a.crewId, ...params });

  return (
    <section className="sinv fm-dark" role="region" aria-label="Your crew needs an answer">
      <div className="sinv-head">
        <div className="eyebrow sinv-eyebrow">
          <FriendModeIcon size={20} />
          {a.crewName}
        </div>
        {actions.length > 1 && <div className="eyebrow sinv-count">{index + 1} of {actions.length}</div>}
      </div>
      <div className="sinv-text">
        {a.kind === "invite" && (
          <>
            <h2 className="sinv-title">Plan with {a.inviterName}</h2>
            <div className="sinv-meta">{a.crewName} · Leaf finds a night that works for the group and plans it.</div>
            <div className="sinv-act">
              <button className="sinv-btn primary" disabled={busy} onClick={() => run(() => call("respondToCrewInvite", { accept: true }))}>Join</button>
              <button className="sinv-btn ghost" disabled={busy} onClick={() => run(() => call("respondToCrewInvite", { accept: false }))}>No thanks</button>
            </div>
          </>
        )}
        {a.kind === "poll" && (
          <>
            <h2 className="sinv-title">Next night at {a.venue?.name || "a new place"}. Which work?</h2>
            <div className="sinv-act" style={{ flexWrap: "wrap" }}>
              {a.dateOptions.map((o, i) => {
                const on = picked.has(i);
                const count = a.votes ? Object.values(a.votes).filter((v) => v.includes(i)).length : 0;
                return (
                  <button key={i} type="button" className={`sinv-btn ${on ? "primary" : "ghost"}`} onClick={() => { const n = new Set(picked); if (on) n.delete(i); else n.add(i); setPicked(n); }}>
                    {optionLabel(o)}{count ? ` · ${count}` : ""}
                  </button>
                );
              })}
            </div>
            <div className="sinv-act">
              <button className="sinv-btn primary" disabled={busy} onClick={() => run(() => call("crewVote", { cycleId: a.cycleId, options: [...picked] }))}>
                {picked.size ? "Save my picks" : "None work for me"}
              </button>
              <Link className="sinv-btn ghost" href={`/crew/${a.crewId}`}>Open crew</Link>
            </div>
          </>
        )}
        {a.kind === "rsvp" && (
          <>
            <h2 className="sinv-title">{a.chosenOption ? dayLabel(a.chosenOption.date) : "Locked"} at {a.venue?.name}</h2>
            <div className="sinv-meta">{a.going} going so far. You in?</div>
            <div className="sinv-act">
              <button className="sinv-btn primary" disabled={busy} onClick={() => run(() => call("crewRsvp", { cycleId: a.cycleId, going: true }))}>I&rsquo;m in</button>
              <button className="sinv-btn ghost" disabled={busy} onClick={() => run(() => call("crewRsvp", { cycleId: a.cycleId, going: false }))}>Can&rsquo;t make it</button>
            </div>
          </>
        )}
        {a.kind === "book" && (
          <>
            <h2 className="sinv-title">Book {a.venue?.name} for {a.chosenOption ? dayLabel(a.chosenOption.date) : "the night"}</h2>
            <div className="sinv-meta">{a.going} people. You&rsquo;re booking this one.</div>
            <div className="sinv-act">
              {a.bookingUrl && <a className="sinv-btn ghost" href={a.bookingUrl} target="_blank" rel="noreferrer">Booking link ↗</a>}
              <button className="sinv-btn primary" disabled={busy} onClick={() => run(() => call("markCrewBooked", { cycleId: a.cycleId }))}>Booked ✓</button>
            </div>
          </>
        )}
        {error && <div className="sinv-meta" style={{ color: "#b42318" }}>{error}</div>}
      </div>
    </section>
  );
}

/**
 * The quiet state of the crew card: shown when you're in a crew and nothing
 * needs you. The next night (or what Leaf is doing) and a way into the crew.
 * Pages through crews like the action card. Crews that are off aren't shown;
 * owners manage those from the dashboard.
 */
export function CrewQuietCard({ rows }: { rows: CrewRow[] }) {
  const [index, setIndex] = useState(0);
  const c = rows[index];
  if (!c) return null;
  return (
    <section className="sinv fm-dark" role="region" aria-label="Your crew">
      <div className="sinv-head">
        <div className="eyebrow sinv-eyebrow">
          <FriendModeIcon size={20} />
          {c.name}
        </div>
        {rows.length > 1 && (
          <button className="eyebrow sinv-count" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={() => setIndex((index + 1) % rows.length)} aria-label="Next crew">
            {index + 1} of {rows.length} ›
          </button>
        )}
      </div>
      <div className="sinv-text">
        <h2 className="sinv-title">{c.statusLine || "Nothing planned yet"}</h2>
        <div className="sinv-act">
          <Link className="sinv-btn ghost" href={`/crew/${c.crewId}`}>Open crew</Link>
        </div>
      </div>
    </section>
  );
}

export function CrewSuggestionBox({ suggestion, onEnable }: { suggestion: NonNullable<CrewSuggestion>; onEnable: () => void }) {
  const names = suggestion.names.slice(0, 2).join(", ");
  const rest = suggestion.count - Math.min(2, suggestion.names.length);
  return (
    <div className="prompt-box fm-dark" style={{ borderStyle: "solid" }}>
      <div className="prompt-body">
        <div className="prompt-h">You and {names}{rest > 0 ? ` and ${rest} other${rest === 1 ? "" : "s"}` : ""} keep ending up at the same things.</div>
        <p className="prompt-p">Recurring plans with your crew, on your schedule. Leaf finds a night that works for all of you, then plans it.</p>
      </div>
      <button className="sinv-btn primary" onClick={onEnable}>Enable Friend Mode</button>
    </div>
  );
}

/** "Enable Friend Mode" in a modal: creates a private calendar with Friend Mode on. */
export function FriendModeIntroModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-body">
          <EnableFriendModeFlow onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
