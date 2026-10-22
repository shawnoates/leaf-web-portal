"use client";

/**
 * Friend Mode on /me is participation only: the card under the hero shows
 * what a crew needs from you, or the next night when nothing does. Friend
 * Mode is turned on from a calendar you own, in the dashboard — never here.
 * Styled with the same .leafme classes as the rest of the page.
 */

import { useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { FriendModeMark } from "@/components/crew/FriendModeGlyphs";
import { dayLabel, optionLabel, type DateOption, type Venue } from "@/lib/crew";

export type CrewAction =
  | { kind: "invite"; crewId: string; crewName: string; inviterName: string;
      /** Who's in already (first names), and how many. */
      inNames?: string[]; inCount?: number;
      /** A crew started from "Do this again": the plan it came from. */
      fromPlan?: string | null }
  | { kind: "poll"; crewId: string; crewName: string; cycleId: string; venue: Venue | null; dateOptions: DateOption[]; votes: Record<string, number[]> | null;
      /** Dates their calendar says they're free for: pre-selected, never auto-voted. */
      myFree?: number[] | null; fit?: { free: number; known: number }[] | null }
  | { kind: "rsvp"; crewId: string; crewName: string; cycleId: string; venue: Venue | null; chosenOption: DateOption | null; going: number }
  | { kind: "book"; crewId: string; crewName: string; cycleId: string; venue: Venue | null; chosenOption: DateOption | null; going: number; bookingUrl: string | null }
  /** A one-time crew's night is over (organizer, for two weeks): run it again? */
  | { kind: "again"; crewId: string; crewName: string; happened: boolean; venue: string | null };

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
  /** The crew's claymation icon (from its name), when it has no photo. */
  iconUrl?: string | null;
};


/** "Sat, Oct 18" for when the plan was. */
function wentDay(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Sort key for a crew ask: its soonest date (ms), undated asks after, run-it-again last. */
function actionUrgency(a: CrewAction): number {
  const at = (d: string | null | undefined) => (d ? Date.parse(`${d}T12:00:00`) : NaN);
  let t = NaN;
  if (a.kind === "rsvp" || a.kind === "book") t = at(a.chosenOption?.date);
  else if (a.kind === "poll") t = Math.min(...a.dateOptions.map((o) => at(o.date)).filter((n) => !Number.isNaN(n)));
  if (Number.isFinite(t)) return t;
  return a.kind === "again" ? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER - 1;
}

/** One page of the crew card's pager (CrewCardStack), when it shows more than one thing. */
type StackPage = { index: number; count: number; next: () => void } | null;

function PagerButton({ page }: { page: NonNullable<StackPage> }) {
  return (
    <button type="button" className="eyebrow sinv-count" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={page.next} aria-label="Next">
      {page.index + 1} of {page.count} ›
    </button>
  );
}

export function CrewActionCard({ actions, onAnswered, page = null }: { actions: CrewAction[]; onAnswered: () => Promise<void>; page?: StackPage }) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const a = actions[index];
  // Each poll starts from the dates their calendar says they're free.
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (a && a.kind === "poll" && prefilledFor !== a.cycleId) {
    setPrefilledFor(a.cycleId);
    setPicked(new Set(a.myFree || []));
  }
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
  // Join with texts on, like the crew page's invite screen. With no phone on
  // file the server can't turn texts on, so they join without them.
  const joinWithTexts = async () => {
    try {
      await call("respondToCrewInvite", { accept: true, sms: true });
    } catch (err) {
      if (err instanceof Error && /mobile number/i.test(err.message)) await call("respondToCrewInvite", { accept: true, sms: false });
      else throw err;
    }
  };

  return (
    <section className="sinv fm-dark" role="region" aria-label="Your crew needs an answer">
      <div className="sinv-head">
        <div className="eyebrow sinv-eyebrow">
          <FriendModeMark width={32} />
          {a.crewName}
        </div>
        {page ? <PagerButton page={page} /> : actions.length > 1 && <div className="eyebrow sinv-count">{index + 1} of {actions.length}</div>}
      </div>
      <div className="sinv-text">
        {a.kind === "invite" && (
          <>
            {a.fromPlan ? (
              <>
                <h2 className="sinv-title">Hop in: {a.crewName}</h2>
                <div className="sinv-meta">
                  {a.inNames && a.inNames.length
                    ? `${a.inNames.join(", ").replace(/, ([^,]*)$/, " and $1")}${(a.inCount ?? 0) > a.inNames.length ? ` and ${(a.inCount ?? 0) - a.inNames.length} more` : ""} made it after ${a.fromPlan}.`
                    : `Started after ${a.fromPlan}.`}{" "}Leaf finds the next spot and a night that works.
                </div>
              </>
            ) : (
              <>
                <h2 className="sinv-title">Plan with {a.inviterName}</h2>
                <div className="sinv-meta">{a.crewName} · Leaf finds a night that works for the group and plans it.</div>
              </>
            )}
            <div className="sinv-act">
              <button className="sinv-btn primary" disabled={busy} onClick={() => run(() => joinWithTexts())}>Join</button>
              <button className="sinv-btn ghost" disabled={busy} onClick={() => run(() => call("respondToCrewInvite", { accept: false }))}>No thanks</button>
            </div>
            {/* Same terms as the crew page's invite screen: joining turns on
                texts about this crew, and the tap is the consent. */}
            <div className="sinv-meta" style={{ fontSize: 11, lineHeight: 1.4, marginTop: 8 }}>
              By joining, you agree to get texts about this crew&rsquo;s plans (date polls and the night&rsquo;s details). Up to 5 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.
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
                    {optionLabel(o)}{count ? ` · ${count}` : ""}{a.fit?.[i] && a.fit[i].known > 0 ? ` · ${a.fit[i].free}/${a.fit[i].known} free` : ""}
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
            <div className="sinv-meta">{a.going > 1 ? `${a.going} people going.` : "Just you so far."} You&rsquo;re booking this one.</div>
            <div className="sinv-act">
              {a.bookingUrl && <a className="sinv-btn ghost" href={a.bookingUrl} target="_blank" rel="noreferrer">Booking link ↗</a>}
              <button className="sinv-btn primary" disabled={busy} onClick={() => run(() => call("markCrewBooked", { cycleId: a.cycleId }))}>Booked ✓</button>
            </div>
          </>
        )}
        {a.kind === "again" && (
          <>
            <h2 className="sinv-title">Do {a.crewName} again?</h2>
            <div className="sinv-meta">{a.happened ? `One night out${a.venue ? ` at ${a.venue}` : ""}, done.` : "The night didn't come together."} Same people, a new date.</div>
            <div className="sinv-act">
              <button className="sinv-btn primary" disabled={busy} onClick={() => run(() => Parse.Cloud.run("runCrewAgain", { calendarId: a.crewId, oneTime: true }))}>Another night</button>
              <button className="sinv-btn ghost" disabled={busy} onClick={() => run(() => Parse.Cloud.run("runCrewAgain", { calendarId: a.crewId, oneTime: false, rhythmDays: 28 }))}>Make it monthly</button>
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
          <FriendModeMark width={32} />
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


// The card's own styles, on top of /me's dark Friend Mode card (.sinv.fm-dark).
const GO_AGAIN_CSS = `
.leafme .fm-dark .ga-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.leafme .fm-dark .ga-chip { display: inline-flex; align-items: center; min-height: 36px; padding: 0 14px; border-radius: 999px; font-size: 14px; background: #1B2B25; color: #F2F1EC; border: 1px solid #3B5449; }
.leafme .fm-dark .ga-chip.in { background: #3B5449; border-color: #3B5449; }
.leafme .fm-dark .ga-chip.in.me { background: #C8F25A; border-color: #C8F25A; color: #101A16; font-weight: 600; }
.leafme .fm-dark .ga-chip.add { background: transparent; border-style: dashed; color: #C9D1CB; cursor: pointer; }
.leafme .fm-dark button.ga-chip { cursor: pointer; font-family: inherit; }
.leafme .fm-dark .ga-chip:disabled { opacity: .6; cursor: default; }
.leafme .fm-dark .ga-ask { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-radius: 12px; background: #1B2B25; }
.leafme .fm-dark .ga-ask-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; color: #F2F1EC; }
.leafme .fm-dark .ga-ask-row .sinv-btn { flex: none; padding: 6px 12px; font-size: 13px; }
.leafme .fm-dark .sinv-btn.ga-start { background: #C8F25A; border-color: #C8F25A; color: #101A16; font-weight: 600; flex: 1; text-align: center; text-decoration: none; }
.leafme .fm-dark .sinv-btn.ga-start:disabled { background: #3B5449; border-color: #3B5449; color: #8A928C; opacity: 1; }
.leafme .fm-dark .ga-hide { background: none; border: 0; padding: 6px 0; font-size: 12px; color: #8A928C; cursor: pointer; font-family: inherit; }
.leafme .fm-dark .ga-hide:hover { color: #F2F1EC; }
.leafme .fm-dark .ga-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 4px 0 2px; }
.leafme .fm-dark .ga-faces { display: flex; align-items: center; gap: 8px; }
.leafme .fm-dark .ga-face { width: 40px; height: 40px; border-radius: 999px; border: 2px solid #253A33; background: #1B2B25; color: #C9D1CB; font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; flex: none; }
.leafme .fm-dark .ga-face img { width: 100%; height: 100%; object-fit: cover; }
.leafme .fm-dark .ga-face.in { border-color: #C8F25A; }
.leafme .fm-dark .ga-face.open { background: transparent; border: 2px dashed #3B5449; }
.leafme .fm-dark .ga-face.ask { color: #8A928C; font-size: 18px; cursor: pointer; font-family: inherit; }
.leafme .fm-dark .ga-face.ask:hover { border-color: #C8F25A; color: #F2F1EC; }
.leafme .fm-dark .ga-head-right { display: flex; align-items: center; gap: 14px; }
`;

/** "Do this again with the people you went with": a plan you went to (getMeDashboard.goAgain). */
export type GoAgain = {
  planId: string;
  title: string;
  place: string | null;
  image: string | null;
  endedAt: string | null;
  went: number;
  need: number;
  inCount: number;
  meIn: boolean;
  people: { userId: string; name: string; photo: string | null; in: boolean; me: boolean }[];
  nudged: string[];
};

/**
 * After a plan: everyone who went taps themselves in, and once enough are in
 * (3) any of them starts the crew. The others who tapped in are in it right
 * away; everyone else who went gets an invite to hop in.
 */
/**
 * The one green card on /me: what your crews need from you (join, vote,
 * IN/OUT, book), then "Do this again" for plans you went to, paged with
 * "1 of 3 ›" so they never stack up.
 */
export function CrewCardStack({ actions, goAgain, onRefresh }: { actions: CrewAction[]; goAgain: GoAgain[]; onRefresh: () => Promise<void> }) {
  const [hidden, setHidden] = useState<string[]>([]);
  // A "Do this again" whose crew just started stays to say so; the refreshed page no longer lists it.
  const [started, setStarted] = useState<GoAgain[]>([]);
  const [at, setAt] = useState(0);
  const again = [...goAgain, ...started.filter((k) => !goAgain.some((c) => c.planId === k.planId))]
    .filter((c) => !hidden.includes(c.planId));
  // Answers people are waiting on first: an RSVP or a vote (soonest date
  // first), then invites and "Do it again?", then Do this again (someone
  // already in first). Booking is the host's own to-do, so it goes last.
  const sorted = [...actions].sort((x, y) => actionUrgency(x) - actionUrgency(y));
  const items: ({ kind: "action"; a: CrewAction } | { kind: "again"; g: GoAgain })[] = [
    ...sorted.filter((a) => a.kind !== "book").map((a) => ({ kind: "action" as const, a })),
    ...[...again].sort((x, y) => y.inCount - x.inCount || (Date.parse(y.endedAt || "") || 0) - (Date.parse(x.endedAt || "") || 0))
      .map((g) => ({ kind: "again" as const, g })),
    ...sorted.filter((a) => a.kind === "book").map((a) => ({ kind: "action" as const, a })),
  ];
  if (!items.length) return null;
  const i = Math.min(at, items.length - 1);
  const item = items[i];
  const page = items.length > 1 ? { index: i, count: items.length, next: () => setAt((i + 1) % items.length) } : null;
  return (
    <>
      <style>{GO_AGAIN_CSS}</style>
      {item.kind === "action" ? (
        <CrewActionCard key={`a-${i}`} actions={[item.a]} page={page} onAnswered={onRefresh} />
      ) : (
        <GoAgainCard
          key={item.g.planId}
          card={item.g}
          page={page}
          onGone={() => setHidden((h) => [...h, item.g.planId])}
          onStarted={() => setStarted((k) => [...k, item.g])}
          onChanged={onRefresh}
        />
      )}
    </>
  );
}

function GoAgainCard({ card: initial, page, onGone, onStarted, onChanged }: {
  card: GoAgain;
  page: StackPage;
  onGone: () => void;
  onStarted: () => void;
  onChanged: () => Promise<void>;
}) {
  const [card, setCard] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  const [started, setStarted] = useState<{ link: string | null; invited: number } | null>(null);
  const me = card.people.find((p) => p.me);
  const inPeople = card.people.filter((p) => p.in && !p.me);
  const notIn = card.people.filter((p) => !p.in && !p.me);
  const left = Math.max(0, card.need - card.inCount);

  const act = async (key: string, name: string, params: Record<string, unknown> = {}) => {
    setBusy(key);
    setError("");
    try {
      const r = (await Parse.Cloud.run(name, { planId: card.planId, ...params })) as { card?: GoAgain | null; link?: string | null; invited?: number };
      if (r?.card) setCard(r.card);
      return r;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    const r = (await act("me", "setGoAgain", { in: true })) as { crewMade?: boolean; link?: string | null; invited?: number } | null;
    if (!r?.crewMade) return;
    // That tap made it 3: the crew is on.
    setStarted({ link: r.link ?? null, invited: r.invited ?? 0 });
    onStarted();
    // The new crew shows up in Your crews.
    void onChanged();
  };

  if (started) {
    return (
      <section className="sinv fm-dark" role="region" aria-label="Crew started">
        <div className="sinv-text">
          <h2 className="sinv-title">Your crew is on</h2>
          <div className="sinv-meta">
            {inPeople.length ? `${inPeople.map((p) => p.name.split(" ")[0]).join(", ")} ${inPeople.length === 1 ? "is" : "are"} in with you.` : "You're in."}
            {started.invited > 0 ? ` Leaf invited the other ${started.invited} who went.` : ""}
          </div>
          {started.link && (
            <div className="sinv-act"><a className="sinv-btn primary ga-start" href={started.link}>Open the crew</a></div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="sinv fm-dark" role="region" aria-label={`Do ${card.title} again`}>
      <div className="sinv-head">
        <div className="eyebrow sinv-eyebrow">
          <FriendModeMark width={32} />
          Do this again
        </div>
        <div className="ga-head-right">
          {page && <PagerButton page={page} />}
          <button type="button" className="ga-hide" disabled={busy !== null} onClick={async () => { if (await act("hide", "dismissGoAgain")) onGone(); }}>
            Not this one
          </button>
        </div>
      </div>
      <div className="sinv-text">
        {/* Forward-looking: what it could be, with the night it came from as the small print. */}
        <h2 className="sinv-title">Get this group together again</h2>
        {inPeople.length > 0 && (
          <div className="sinv-meta">{inPeople.map((p) => p.name.split(" ")[0]).join(" and ").replace(/ and (?=.* and )/g, ", ")} {inPeople.length === 1 ? "is" : "are"} in</div>
        )}
        <div className="sinv-meta">
          {(() => {
            const names = notIn.map((p) => p.name.split(" ")[0]);
            const shownNames = names.slice(0, 3);
            const more = card.went - 1 - inPeople.length - shownNames.length;
            const who = shownNames.length ? `With ${shownNames.join(", ")}${more > 0 ? ` and ${more} more` : ""}` : null;
            const day = wentDay(card.endedAt);
            const where = card.place || card.title;
            const from = [where, day].filter(Boolean).join(", ");
            return [who, from ? `from ${from}` : null].filter(Boolean).join(" · ") || `${card.went} went`;
          })()}
        </div>
        <div className="sinv-meta" style={{ fontSize: 13 }}>Leaf finds the next spot and a night that works for everyone.</div>
        <div className="ga-row">
          {/* Who's in, one circle each; empty dashed circles for the spots still open. */}
          <div className="ga-faces" role="img" aria-label={`${Math.min(card.inCount, card.need)} of ${card.need} in`}>
            {card.people.filter((p) => p.in).slice(0, 8).map((p) => (
              <span key={p.userId} className="ga-face in" title={p.me ? "You" : p.name}>
                {p.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.photo} alt="" />
                    : (p.me ? "You" : p.name.trim().charAt(0).toUpperCase())}
              </span>
            ))}
            {Array.from({ length: Math.max(0, card.need - card.inCount) }, (_, i) => (
              card.meIn && notIn.length > 0
                ? <button key={`open-${i}`} type="button" className="ga-face open ask" aria-label="Ask someone who went" onClick={() => setAsking(true)}>+</button>
                : <span key={`open-${i}`} className="ga-face open" aria-hidden />
            ))}
          </div>
        </div>
        {asking && (
          <div className="ga-ask">
            {notIn.map((p) => {
              const asked = card.nudged.includes(p.userId);
              return (
                <div key={p.userId} className="ga-ask-row">
                  <span>{p.name}</span>
                  <button type="button" className="sinv-btn ghost" disabled={asked || busy !== null} onClick={() => act(`ask-${p.userId}`, "nudgeGoAgain", { userId: p.userId })}>
                    {asked ? "Asked" : busy === `ask-${p.userId}` ? "Asking…" : "Ask"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="sinv-meta">
          {card.meIn
            ? `You're in. ${left > 0 ? `${left} more and Leaf starts the crew.` : "Starting it now."}`
            : `${card.inCount} of ${card.need} in. ${left === 1 ? "Your tap starts the crew." : `${left} more and Leaf starts the crew.`}`}
        </div>
        {/* The one button: I'm In. The tap that makes it 3 starts the crew. */}
        <div className="sinv-act">
          {me && (
            <button
              type="button"
              className={`sinv-btn ${card.meIn ? "ghost" : "primary ga-start"}`}
              style={{ flex: 1 }}
              aria-pressed={card.meIn}
              disabled={busy !== null}
              onClick={() => (card.meIn ? act("me", "setGoAgain", { in: false }) : join())}
            >
              {busy === "me" ? "One sec…" : card.meIn ? "You're In ✓" : left === 1 ? "Start Crew" : "I'm In"}
            </button>
          )}
        </div>
        {error && <div className="sinv-meta" style={{ color: "#F2A39A" }}>{error}</div>}
      </div>
    </section>
  );
}
