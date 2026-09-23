"use client";

/**
 * Friend Mode on /me: the one thing a crew needs from you (under the hero),
 * the "Your crews" rail, the start-a-crew nudge, and the intro popup.
 * Styled with the same .leafme classes as the rest of the page.
 */

import { useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import Parse from "@/lib/parse-client";
import StartCrewFlow from "@/components/crew/StartCrewFlow";
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
  status: "active" | "paused" | "invited";
  statusLine: string;
  nextPlanId: string | null;
  isOwner?: boolean;
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
          <Users className="sinv-icon" aria-hidden />
          {a.crewName}
        </div>
        {actions.length > 1 && <div className="eyebrow sinv-count">{index + 1} of {actions.length}</div>}
      </div>
      <div className="sinv-text">
        {a.kind === "invite" && (
          <>
            <h2 className="sinv-title">{a.inviterName} added you to {a.crewName}</h2>
            <div className="sinv-meta">Leaf finds a night that works for everyone and plans it. Want in?</div>
            <div className="sinv-act">
              <button className="sinv-btn primary" disabled={busy} onClick={() => run(() => call("respondToCrewInvite", { accept: true }))}>Join</button>
              <button className="sinv-btn ghost" disabled={busy} onClick={() => run(() => call("respondToCrewInvite", { accept: false }))}>Not now</button>
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

export function CrewsRail({ rows }: { rows: CrewRow[] }) {
  return (
    <section className="rail">
      <div className="eyebrow">Your crews</div>
      <div className="cals">
        {rows.map((c) => (
          <Link key={c.crewId} className="cal-row fm-dark" href={`/crew/${c.crewId}`} style={{ borderRadius: 12, padding: "10px 12px" }}>
            <span className="cal-ava ph">{(c.name || "C").charAt(0).toUpperCase()}</span>
            <div className="cal-body">
              <div className="cal-n">{c.name}</div>
              <div className="cal-s">{c.statusLine}</div>
            </div>
            <span className="cal-cta">Open</span>
          </Link>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>
        <Link className="btn text sm" href="/crew/start">Start another crew</Link>
      </div>
    </section>
  );
}

export function CrewSuggestionBox({ suggestion }: { suggestion: NonNullable<CrewSuggestion> }) {
  const names = suggestion.names.slice(0, 2).join(", ");
  const rest = suggestion.count - Math.min(2, suggestion.names.length);
  return (
    <div className="prompt-box fm-dark" style={{ borderStyle: "solid" }}>
      <div className="prompt-body">
        <div className="prompt-h">You and {names}{rest > 0 ? ` and ${rest} other${rest === 1 ? "" : "s"}` : ""} keep ending up at the same things.</div>
        <p className="prompt-p">Start a crew and Leaf will find a night that works for all of you, then plan it. Free, and nobody needs the app.</p>
      </div>
      <Link className="sinv-btn primary" href="/crew/start?suggest=1">Start a crew</Link>
    </div>
  );
}

export function FriendModeIntroModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-body">
          <StartCrewFlow signedIn suggest onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
