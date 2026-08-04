"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import Parse from "@/lib/parse-client";
import HostIdeaModal from "@/components/HostIdeaModal";

// ============================================================================
// Attendee dashboard (/me). Read-mostly. Answers one question — "where am I
// going next, and am I still going?" It is the live truth (re-fetchable), not
// a frozen digest. Built to the leaf-attendee-dashboard mockup: Newsreader
// serif headings, sage/cream tiles, ink rectangular buttons, hairline rules.
// ============================================================================

// ---- Types (mirror the getMeDashboard payload) -----------------------------
type HostState = "waiting_on_host" | "human_host" | "leaf_arranging" | "leaf_hosted" | "virtual_host";
type RsvpState = "going" | "not_going" | "no_response";

interface Persona { id: string; name: string; avatarUrl: string | null }
interface Weather { temp: string; icon: string; text: string }
interface PlanMessage {
  id: string | null;
  authorName: string;
  authorRole: string;
  body: string;
  sentAt: string | null;
  unread: boolean;
}
interface Plan {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  date: string | null;
  time: string | null;
  venueName: string | null;
  venueAddress: string | null;
  calendarId: string | null;
  calendarName: string;
  calendarShareId: string | null;
  image: string | null;
  hostState: HostState;
  hostPersona: Persona | null;
  viewerIsHost: boolean;
  rsvpState: RsvpState;
  attendeeCount: number;
  weather: Weather | null;
  messages: PlanMessage[];
}
interface HostPlan {
  ideaId: string;
  title: string;
  category: string | null;
  image: string | null;
  date: string | null;
  time: string | null;
  venueName: string | null;
  venueAddress: string | null;
  calendarId: string | null;
  calendarName: string;
  calendarShareId: string | null;
  addMode: "owner" | "propose";
  hostDeadline: string;
  daysToDeadline: number;
  decayLevel: "soon" | "warn";
  interestedCount: number;
}
interface HostCalRow {
  calendarId: string;
  calendarName: string;
  calendarShareId: string | null;
  calendarPhoto: string | null;
  count: number;
  soonestDeadline: string;
  soonestIsUrgent: boolean;
}
interface NeedsHost {
  tier1: HostPlan[];
  tier2: HostCalRow[];
}
interface Dashboard {
  person: { firstName: string; ownsCalendars: boolean; pendingReviewCount: number };
  greeting?: { weather: Weather | null };
  needsHost?: NeedsHost;
  nextPlan: Plan | null;
  plans: Plan[];
  unreadMessageCount: number;
  ask: { kind: "pattern" | "generic"; copy: string; promptPrefill: string | null } | null;
}

type AuthState = "resolving" | "authed" | "needs-otp" | "error";
const PROMPT_BASE = "https://joinleaf.com/personal";

// ---- Date / string helpers -------------------------------------------------
function parse(iso: string | null) { return iso ? new Date(iso) : null; }
function weekday(iso: string | null) {
  const d = parse(iso); if (!d) return "";
  return d.toLocaleDateString("en-US", { weekday: "long" });
}
// Normalize any stored time ("19:00", "7:00 PM", "7 PM") to "H:MM AM/PM".
function fmtTime(raw: string | null, dateIso: string | null) {
  if (raw) {
    const m24 = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
      let h = +m24[1]; const min = m24[2]; const ap = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12; return `${h}:${min} ${ap}`;
    }
    const m12 = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (m12) return `${+m12[1]}:${m12[2] || "00"} ${m12[3].toUpperCase()}`;
    return raw;
  }
  const d = parse(dateIso); if (!d) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function timeLabel(plan: Plan) {
  return fmtTime(plan.time, plan.date);
}
function relPhrase(iso: string | null) {
  const d = parse(iso); if (!d) return "";
  const s = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((s(d).getTime() - s(new Date()).getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff < 7) return `in ${diff} days`;
  if (diff < 14) return "next week";
  return `in ${Math.round(diff / 7)} weeks`;
}
function heroWhen(plan: Plan) {
  const wd = weekday(plan.date); const rel = relPhrase(plan.date); const t = timeLabel(plan);
  return [wd, rel && `— ${rel}`, t && `, ${t}`].filter(Boolean).join(" ").replace(" ,", ",");
}
function dayNum(iso: string | null) { const d = parse(iso); return d ? String(d.getDate()) : ""; }
function monthAbbr(iso: string | null) {
  const d = parse(iso); return d ? d.toLocaleDateString("en-US", { month: "short" }) : "";
}
function ago(iso: string | null) {
  const d = parse(iso); if (!d) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function initial(name: string) { return (name || "?").trim().charAt(0).toUpperCase() || "?"; }
function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// Tile — Leaf's signature artifact: a colored square with a serif word.
function tileFor(plan: Plan, i: number): { tone: "sage" | "cream"; word: string } {
  const tone: "sage" | "cream" = i % 2 === 0 ? "sage" : "cream";
  const s = `${plan.category || ""} ${plan.title} ${plan.venueName || ""}`.toLowerCase();
  let word = "plans";
  if (/happy hour|beer|brew|pub|tavern|ale/.test(s)) word = "beer";
  else if (/cocktail|lounge|speakeasy|wine|oyster|bar/.test(s)) word = "cocktails";
  else if (/dinner|supper|kitchen|bistro|table|trattoria|osteria/.test(s)) word = "supper";
  else if (/coffee|cafe|brunch|breakfast|espresso/.test(s)) word = "coffee";
  else if (/sauna|steam|soak|spa|bath|pool/.test(s)) word = "soak";
  else if (/show|music|concert|gig|dj|dance/.test(s)) word = "music";
  else if (/park|walk|hike|garden|outdoor|picnic/.test(s)) word = "outside";
  return { tone, word };
}
// Plan visual: real photo when the plan has one, else the sage/cream tile.
function PlanTile({
  plan, index, sm, onOpen, weather,
}: {
  plan: Plan;
  index: number;
  sm?: boolean;
  onOpen?: () => void;
  weather?: Weather | null;
}) {
  const tileEl = plan.image ? (
    <div className={`tile photo ${sm ? "sm" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plan.image} alt="" />
    </div>
  ) : (() => {
    const t = tileFor(plan, index);
    return <div className={`tile ${t.tone} ${sm ? "sm" : ""}`}>{t.word}</div>;
  })();
  const content = (
    <div className="tile-wrap">
      {tileEl}
      {weather && (weather.temp || weather.text) && (
        <span className="wx wx-over">🌤 <b>{weather.temp}°</b> {weather.text}</span>
      )}
    </div>
  );
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className="tile-link" aria-label={`Open ${plan.title}`}>
        {content}
      </button>
    );
  }
  return content;
}

function statusFor(plan: Plan): { cls: string; text: string } | null {
  if (plan.hostState === "leaf_hosted" && plan.hostPersona) {
    return { cls: "host", text: `Hosted by Leaf · ${plan.hostPersona.name}` };
  }
  if (plan.hostState === "leaf_hosted") return { cls: "host", text: "Hosted by Leaf" };
  // A virtual/Leaf host is the public face of the plan even though the owner
  // technically owns the EventGroup — read like "Hosted by {persona}", not
  // "You're hosting" (mirrors org/[shareId]'s viewerHostsPlan exclusion).
  if (plan.hostState === "virtual_host") {
    return plan.hostPersona
      ? { cls: "host", text: `Hosted by ${plan.hostPersona.name}` }
      : { cls: "host", text: "Hosted by Leaf" };
  }
  if (plan.viewerIsHost) {
    return { cls: "host", text: plan.attendeeCount > 0 ? `You're hosting · ${plan.attendeeCount} going` : "You're hosting" };
  }
  if (plan.hostState === "waiting_on_host") return { cls: "wait", text: "Waiting on host" };
  if (plan.rsvpState === "going") {
    const others = Math.max(0, plan.attendeeCount - 1);
    return { cls: "", text: others > 0 ? `You're going · ${others} others` : "You're going" };
  }
  return { cls: "", text: `${plan.attendeeCount} going` };
}

// ============================================================================
export default function MeClient() {
  const [authState, setAuthState] = useState<AuthState>("resolving");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState("");
  const fetchedRef = useRef(false);
  const trackedRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = (await Parse.Cloud.run("getMeDashboard", {})) as Dashboard;
      setData(res);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your plans.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = new URLSearchParams(window.location.search).get("t");
        const uid = new URLSearchParams(window.location.search).get("u");
        // Analytics: count the view. `fromLink` = arrived via the digest SMS
        // link (has both u+t), which is the /me CTR numerator. Fire-and-forget.
        if (!trackedRef.current) {
          trackedRef.current = true;
          Parse.Cloud.run("recordMeDashboardView", {
            userId: uid || undefined,
            fromLink: !!(token && uid),
          }).catch(() => {});
        }
        if (token && uid) {
          try {
            const r = (await Parse.Cloud.run("getDashboardSession", { userId: uid, token })) as {
              sessionToken?: string;
            };
            if (r?.sessionToken?.startsWith("r:")) await Parse.User.become(r.sessionToken);
          } catch { /* fall through */ }
          window.history.replaceState(null, "", window.location.pathname);
        }
        const current = Parse.User.current();
        if (cancelled) return;
        if (current) {
          fetchedRef.current = true;
          await fetchDashboard();
          if (!cancelled) setAuthState("authed");
        } else {
          setAuthState("needs-otp");
        }
      } catch {
        if (!cancelled) setAuthState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [fetchDashboard]);

  const patchPlan = useCallback((planId: string, patch: (p: Plan) => Plan) => {
    setData((prev) => {
      if (!prev) return prev;
      const apply = (p: Plan) => (p.id === planId ? patch(p) : p);
      return { ...prev, nextPlan: prev.nextPlan ? apply(prev.nextPlan) : null, plans: prev.plans.map(apply) };
    });
  }, []);

  const onRsvp = useCallback((planId: string, next: RsvpState) => {
    patchPlan(planId, (p) => ({ ...p, rsvpState: next }));
  }, [patchPlan]);

  let body: React.ReactNode = null;
  if (authState === "resolving" || (!data && !loadError && authState === "authed")) {
    body = <div className="lm-center"><Spinner /></div>;
  } else if (authState === "error") {
    body = <div className="lm-center"><p className="lm-muted">Something went wrong. Tap your link again.</p></div>;
  } else if (authState === "needs-otp") {
    body = <OtpModal onVerified={async () => { fetchedRef.current = true; await fetchDashboard(); setAuthState("authed"); }} />;
  } else if (loadError) {
    body = <div className="lm-center"><p className="lm-muted">{loadError}</p></div>;
  } else if (data) {
    body = <DashboardView data={data} onRsvp={onRsvp} />;
  }

  return (
    <div className="leafme">
      <style>{CSS}</style>
      {body}
    </div>
  );
}

// ---- Dashboard view --------------------------------------------------------
function DashboardView({
  data, onRsvp,
}: {
  data: Dashboard;
  onRsvp: (id: string, s: RsvpState) => void;
}) {
  const hero = data.nextPlan;
  const spine = data.plans.slice(1); // hero is plans[0]
  const calCount = new Set(data.plans.map((p) => p.calendarId).filter(Boolean)).size;
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  // Read the live plan object so RSVP changes reflect inside the modal.
  const openPlan =
    (data.nextPlan && data.nextPlan.id === openPlanId ? data.nextPlan : null) ||
    data.plans.find((p) => p.id === openPlanId) ||
    null;

  return (
    <>
      <header className="bar">
        <div className="wrap bar-in">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/leaf-logo-black.png" alt="Leaf" className="leaflogo" />
          </div>
          <div className="who">
            <span>{data.person.firstName || "You"}</span>
            <div className="ava">{initial(data.person.firstName || "Y")}</div>
          </div>
        </div>
      </header>

      <main>
        <section className="wrap greet">
          {data.greeting?.weather && (data.greeting.weather.temp || data.greeting.weather.text) && (
            <span className="greet-wx">🌤 <b>{data.greeting.weather.temp}°</b> {data.greeting.weather.text}</span>
          )}
          <div className="greet-line">
            {greetingWord()}{data.person.firstName ? `, ${data.person.firstName.trim().split(/\s+/)[0]}` : ""}
          </div>
        </section>

        {hero ? (
          <Hero plan={hero} onRsvp={onRsvp} onOpen={() => setOpenPlanId(hero.id)} />
        ) : (
          <EmptyHero ask={data.ask} owner={data.person.ownsCalendars} />
        )}

        {spine.length > 0 && (
          <section className="wrap sect">
            <div className="sect-head">
              <div className="eyebrow">Your plans</div>
              <div className="count">
                {data.plans.length} upcoming · {calCount} calendar{calCount === 1 ? "" : "s"}
                {data.unreadMessageCount > 0 && (
                  <> · <span className="new">{data.unreadMessageCount} new message{data.unreadMessageCount === 1 ? "" : "s"}</span></>
                )}
              </div>
            </div>
            <div className="spine">
              {spine.map((plan, i) => (
                <Stop key={plan.id} plan={plan} index={i + 1} onRsvp={onRsvp} onOpen={() => setOpenPlanId(plan.id)} />
              ))}
            </div>
          </section>
        )}

        {data.needsHost && (data.needsHost.tier1.length > 0 || data.needsHost.tier2.length > 0) && (
          <NeedsHostSection data={data.needsHost} />
        )}

        {/* Ask XOR owner strip — never both */}
        {data.person.ownsCalendars ? (
          <OwnerStrip count={data.person.pendingReviewCount} />
        ) : (
          data.ask && <Ask ask={data.ask} />
        )}

        <footer className="wrap foot">
          <p>One text a week, Sunday morning — everything on this page in one link. Plus a heads-up if something lands on your calendars too late to make it. Never a text for every plan on a calendar you follow.</p>
          <p className="foot-links">
            <Link href="/unsubscribe">Change how often</Link>
            <span aria-hidden> · </span>
            <Link href="/unsubscribe">Stop texts</Link>
          </p>
        </footer>
      </main>

      {openPlan && (
        <PlanModal plan={openPlan} onClose={() => setOpenPlanId(null)} onRsvp={onRsvp} />
      )}
    </>
  );
}

// ---- Hero ------------------------------------------------------------------
function Hero({
  plan, onRsvp, onOpen,
}: {
  plan: Plan;
  onRsvp: (id: string, s: RsvpState) => void;
  onOpen: () => void;
}) {
  const addr = [plan.venueName, plan.venueAddress].filter(Boolean).join(" · ");
  return (
    <section className="wrap hero">
      <div className="eyebrow">Next up</div>
      <div className="hero-grid">
        <div>
          <div className="when">{heroWhen(plan)}</div>
          <div className="cal">{plan.calendarName}</div>
          <h1><button className="plan-link" onClick={onOpen}>{plan.title}</button></h1>
          {addr && <p className="addr">{addr}</p>}
          {plan.description && <p className="blurb">{plan.description}</p>}
          <div className="row">
            <AttendButtons plan={plan} onRsvp={onRsvp} />
          </div>
          <Thread plan={plan} hero />
        </div>
        <PlanTile plan={plan} index={0} onOpen={onOpen} weather={plan.weather} />
      </div>
    </section>
  );
}

function EmptyHero({ ask, owner }: { ask: Dashboard["ask"]; owner: boolean }) {
  return (
    <section className="wrap hero">
      <div className="eyebrow">Nothing coming up</div>
      <div className="hero-grid">
        <div>
          <h1 style={{ marginTop: 8 }}>No plans yet</h1>
          <p className="blurb">Nothing on your calendars in the next while. We&rsquo;ll text you the moment there is.</p>
          {owner ? (
            <div className="row"><Link className="btn ghost" href="/dashboard">Manage your calendars ↗</Link></div>
          ) : (
            ask && <div style={{ marginTop: 8 }}><Ask ask={ask} bare /></div>
          )}
        </div>
        <div className="tile sage">plans</div>
      </div>
    </section>
  );
}

// ---- Spine stop ------------------------------------------------------------
function Stop({
  plan, index, onRsvp, onOpen,
}: {
  plan: Plan;
  index: number;
  onRsvp: (id: string, s: RsvpState) => void;
  onOpen: () => void;
}) {
  const status = statusFor(plan);
  const going = plan.rsvpState === "going";
  const meta = [weekday(plan.date), timeLabel(plan), plan.venueName || plan.venueAddress].filter(Boolean).join(" · ");
  const hostHref = plan.calendarShareId ? `/org/${plan.calendarShareId}?host=${encodeURIComponent(plan.id)}` : `/p/${plan.id}`;
  // Plans you're neither attending nor hosting (and not Leaf-hosted / waiting on
  // a host) get a quick "I'm attending" CTA on the right instead of a count.
  // A virtual host fronts the hosting, so the real owner counts as "not
  // hosting" here too and still gets the CTA (mirrors AttendButtons/canChat).
  const canAttend = (!plan.viewerIsHost || plan.hostState === "virtual_host") && plan.rsvpState !== "going"
    && plan.hostState !== "waiting_on_host" && plan.hostState !== "leaf_hosted";
  return (
    <article className="stop">
      <div className="date"><div className="d">{dayNum(plan.date)}</div><div className="m">{monthAbbr(plan.date)}</div></div>
      <span className={`dot ${going ? "on" : ""}`} />
      <div className="stop-card">
        <PlanTile plan={plan} index={index} sm onOpen={onOpen} />
        <div>
          <div className="cal-row">
            <div className="cal">{plan.calendarName}</div>
            {canAttend
              ? <AttendCta plan={plan} onRsvp={onRsvp} />
              : (status && <span className={`status ${status.cls}`}>{status.text}</span>)}
          </div>
          <h3><button className="plan-link" onClick={onOpen}>{plan.title}</button></h3>
          <p className="meta">{meta}</p>
          {plan.hostState === "waiting_on_host" && (
            <div style={{ marginTop: 9 }}><Link className="btn ghost" href={hostHref}>Host this ↗</Link></div>
          )}
          <Thread plan={plan} />
        </div>
      </div>
    </article>
  );
}

// White-bg "I'm attending" quick CTA for the spine's not-attending plans.
// One tap RSVPs going (optimistic); full controls live in the plan modal.
function AttendCta({ plan, onRsvp }: { plan: Plan; onRsvp: (id: string, s: RsvpState) => void }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true);
    const prev = plan.rsvpState;
    onRsvp(plan.id, "going");
    try {
      await Parse.Cloud.run("setMyRsvp", { eventGroupId: plan.id, rsvpState: "going" });
    } catch {
      onRsvp(plan.id, prev);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="attend-cta-wrap">
      <div className="going-count">{plan.attendeeCount} going</div>
      <button className="attend-cta" disabled={busy} onClick={go}>
        {busy ? "…" : "I'm attending"}
      </button>
    </div>
  );
}

// ---- Attend buttons --------------------------------------------------------
function AttendButtons({
  plan, onRsvp,
}: {
  plan: Plan;
  onRsvp: (id: string, s: RsvpState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const going = plan.rsvpState === "going";

  async function set(next: RsvpState) {
    if (busy || plan.rsvpState === next) return;
    const prev = plan.rsvpState;
    setBusy(true);
    onRsvp(plan.id, next);
    try {
      await Parse.Cloud.run("setMyRsvp", { eventGroupId: plan.id, rsvpState: next });
    } catch {
      onRsvp(plan.id, prev);
    } finally {
      setBusy(false);
    }
  }

  // Hosts don't RSVP to their own plan — they host it. A virtual host fronts
  // the plan instead, so the real owner is just another potential attendee
  // and gets the normal RSVP buttons, same as anyone else.
  if (plan.viewerIsHost && plan.hostState !== "virtual_host") {
    return (
      <span className="attend">
        <button className="btn" disabled aria-pressed>✓ Hosting</button>
      </span>
    );
  }

  return (
    <span className="attend">
      <button className="btn" aria-pressed={going} disabled={busy} onClick={() => set("going")}>
        {going ? "✓ Going" : "I'm going"}
      </button>
      <button
        className="btn ghost"
        aria-pressed={plan.rsvpState === "not_going"}
        disabled={busy}
        onClick={() => set("not_going")}
      >
        Can&rsquo;t make it
      </button>
    </span>
  );
}

// ---- Thread (messages colocated with their plan) ---------------------------
function Thread({ plan, hero }: { plan: Plan; hero?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  // A virtual host fronts the plan's chat — the real owner isn't the one
  // hosting it there, so viewerIsHost alone shouldn't grant chat access;
  // only an actual "going" RSVP should (mirrors AttendButtons).
  const canChat = plan.rsvpState === "going" || (plan.viewerIsHost && plan.hostState !== "virtual_host");

  // Message previews (and the join link) are only for people who can actually
  // open the chat — not going/not hosting shouldn't see chat content.
  if (!canChat) return null;

  // Lead with what needs attention: show all UNREAD messages; if everything's
  // read, fall back to just the latest one for context. Rest collapse behind
  // an expander so the spine stays scannable.
  const unread = plan.messages.filter((m) => m.unread);
  const base = unread.length > 0 ? unread : plan.messages.slice(-1);
  const shown = expanded ? plan.messages : base;
  const hidden = expanded ? 0 : plan.messages.length - base.length;

  return (
    <div className={`thread ${hero ? "hero-thread" : ""}`}>
      {!expanded && hidden > 0 && (
        <button className="reply earlier" onClick={() => setExpanded(true)}>
          Show {hidden} earlier message{hidden === 1 ? "" : "s"}
        </button>
      )}
      {shown.map((m, i) => (
        <div className="msg" key={m.id || i}>
          <div className={`mava ${m.unread ? "unread" : ""}`}>{initial(m.authorName)}</div>
          <div className="msg-b">
            <div className="t">
              <span style={{ color: m.authorRole === "virtual_host" ? "var(--ink)" : "inherit" }}>{m.authorName}</span>
              {m.authorRole === "virtual_host"
                ? " · AI-assisted host"
                : m.authorRole === "leaf"
                  ? " · Leaf concierge"
                  : plan.calendarName ? ` · ${plan.calendarName}` : ""}
            </div>
            <p className="p">{m.body}</p>
            {m.sentAt && <div className="ago">{ago(m.sentAt)}</div>}
          </div>
        </div>
      ))}
      {canChat && (
        <Link href={`/chat/${plan.id}?from=me`} className="btn ghost chat-btn">Join Plan Chat ↗</Link>
      )}
    </div>
  );
}

// ---- Plans that need a host (leaf-needs-a-host-cta spec) --------------------
function monthDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function decayText(p: HostPlan): string {
  const wd = weekday(p.hostDeadline);
  if (p.decayLevel === "soon") {
    if (p.daysToDeadline <= 0) return "Loses its slot today";
    return `Loses its slot ${wd} — ${p.daysToDeadline} day${p.daysToDeadline === 1 ? "" : "s"} left`;
  }
  return `Needs a host by ${wd}`;
}

// Same cookie/localStorage pattern org/[shareId] uses for expressInterestOnPlanIdea
// (same cookie key, so a browser's interest is deduped server-side across both
// surfaces) — kept as a light local copy rather than a shared import to avoid
// touching that page's code for this one card.
const INTEREST_COOKIE_KEY = "leaf_interest_cookie";
const PLAN_IDEA_INTEREST_LOCAL_KEY = "leaf_plan_idea_interests";

function getOrCreateInterestCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`${INTEREST_COOKIE_KEY}=([^;]+)`));
  if (match) return match[1];
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  document.cookie = `${INTEREST_COOKIE_KEY}=${random}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
  return random;
}
function isPlanIdeaLocallyInterested(ideaId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(PLAN_IDEA_INTEREST_LOCAL_KEY);
    if (!raw) return false;
    const set: Record<string, boolean> = JSON.parse(raw);
    return !!set[ideaId];
  } catch {
    return false;
  }
}
function markPlanIdeaLocallyInterested(ideaId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PLAN_IDEA_INTEREST_LOCAL_KEY);
    const set: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    set[ideaId] = true;
    localStorage.setItem(PLAN_IDEA_INTEREST_LOCAL_KEY, JSON.stringify(set));
  } catch {
    /* quota / storage disabled */
  }
}

function NeedsHostSection({ data }: { data: NeedsHost }) {
  // Local copy so a hosted card can leave the section immediately on success.
  const [tier1, setTier1] = useState<HostPlan[]>(data.tier1);
  const [hostingIdea, setHostingIdea] = useState<HostPlan | null>(null);
  const tier2 = data.tier2;

  const [interested, setInterested] = useState<Set<string>>(new Set());
  const [interestPending, setInterestPending] = useState<Set<string>>(new Set());
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});

  // Hydrate "already interested" from localStorage (same key expressInterestOnPlanIdea's
  // org/[shareId] caller uses), so the heart renders filled across reloads.
  useEffect(() => {
    const seen = new Set<string>();
    for (const p of data.tier1) {
      if (isPlanIdeaLocallyInterested(p.ideaId)) seen.add(p.ideaId);
    }
    if (seen.size > 0) setInterested(seen);
  }, [data.tier1]);

  async function markInterested(p: HostPlan) {
    if (interested.has(p.ideaId) || interestPending.has(p.ideaId)) return;
    const priorCount = interestCounts[p.ideaId] ?? p.interestedCount;

    setInterestPending((s) => new Set(s).add(p.ideaId));
    setInterested((s) => new Set(s).add(p.ideaId));
    setInterestCounts((c) => ({ ...c, [p.ideaId]: priorCount + 1 }));
    markPlanIdeaLocallyInterested(p.ideaId);

    try {
      const cookie = getOrCreateInterestCookie();
      const result = (await Parse.Cloud.run("expressInterestOnPlanIdea", {
        ideaId: p.ideaId,
        cookie,
      })) as { count?: number };
      if (typeof result?.count === "number") {
        setInterestCounts((c) => ({ ...c, [p.ideaId]: result.count! }));
      }
    } catch {
      setInterested((s) => {
        const next = new Set(s);
        next.delete(p.ideaId);
        return next;
      });
      setInterestCounts((c) => ({ ...c, [p.ideaId]: priorCount }));
    } finally {
      setInterestPending((s) => {
        const next = new Set(s);
        next.delete(p.ideaId);
        return next;
      });
    }
  }

  if (tier1.length === 0 && tier2.length === 0) return null;

  return (
    <section className="wrap nhs">
      <div className="head">
        <div className="eyebrow">On calendars you follow</div>
        <h1>Plans that <span className="k">need a host</span>.</h1>
      </div>

      {tier1.length > 0 && (
        <>
          <div className="tierlab">Claim these soon</div>
          {tier1.map((p) => (
            <div className="hcard" key={p.ideaId}>
              <div className="date"><div className="d">{dayNum(p.date)}</div><div className="mo">{monthAbbr(p.date)}</div></div>
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="thumb" src={p.image} alt="" />
              ) : (
                <div className="thumb ph" />
              )}
              <div className="hb">
                <div className="cal">{p.calendarName}</div>
                <h3>
                  {p.title}
                  <button
                    type="button"
                    className={`heart-btn ${interested.has(p.ideaId) ? "on" : ""}`}
                    aria-label={interested.has(p.ideaId) ? "You're interested" : "I'm interested"}
                    disabled={interested.has(p.ideaId) || interestPending.has(p.ideaId)}
                    onClick={() => markInterested(p)}
                  >
                    <Heart className="w-4 h-4" fill={interested.has(p.ideaId) ? "currentColor" : "none"} />
                  </button>
                </h3>
                <div className="hmeta">{[weekday(p.date), fmtTime(p.time, p.date), p.venueName || p.venueAddress].filter(Boolean).join(" · ")}</div>
                <div className={`decay ${p.decayLevel}`}>{decayText(p)}</div>
              </div>
              <div className="hact">
                {(interestCounts[p.ideaId] ?? p.interestedCount) > 0 && (
                  <div className="interested">{interestCounts[p.ideaId] ?? p.interestedCount} interested</div>
                )}
                <button className="hostbtn" onClick={() => setHostingIdea(p)}>
                  Host this
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {hostingIdea && (
        <HostIdeaModal
          idea={{
            objectId: hostingIdea.ideaId,
            title: hostingIdea.title,
            image: hostingIdea.image,
            category: hostingIdea.category,
            centroid: hostingIdea.venueAddress,
            location: hostingIdea.venueName && hostingIdea.venueAddress
              ? { name: hostingIdea.venueName, address: hostingIdea.venueAddress }
              : null,
            preferredTime: hostingIdea.time,
          }}
          prefillDate={parse(hostingIdea.date)}
          hostName={Parse.User.current()?.get("full_name") || null}
          hostPhone={Parse.User.current()?.get("phone") || null}
          onClose={() => setHostingIdea(null)}
          onHosted={() => {
            setTier1((list) => list.filter((x) => x.ideaId !== hostingIdea.ideaId));
          }}
        />
      )}

      {tier2.length > 0 && (
        <div className="tier2">
          <div className="tierlab">More on your calendars</div>
          {tier2.map((c) => (
            <Link
              key={c.calendarId}
              className="crow"
              href={c.calendarShareId ? `/org/${c.calendarShareId}` : "#"}
            >
              {c.calendarPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="gmark" src={c.calendarPhoto} alt="" />
              ) : (
                <span className="gmark ph">{initial(c.calendarName)}</span>
              )}
              <div className="cbody">
                <div className="n">{c.calendarName}</div>
                <div className="c">
                  <b className={c.soonestIsUrgent ? "soon" : ""}>
                    {c.count} plan{c.count === 1 ? "" : "s"} need a host
                  </b>
                  {c.soonestIsUrgent
                    ? ` · one this ${weekday(c.soonestDeadline)}`
                    : ` · soonest ${monthDay(c.soonestDeadline)}`}
                </div>
              </div>
              <span className="cta">View calendar →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- The ask ---------------------------------------------------------------
function Ask({
  ask, bare,
}: {
  ask: NonNullable<Dashboard["ask"]>;
  bare?: boolean;
}) {
  const href = ask.promptPrefill ? `${PROMPT_BASE}?q=${encodeURIComponent(ask.promptPrefill)}` : PROMPT_BASE;
  const inner = (
    <div className="start">
      <p className="lede">{ask.copy}</p>
      <p className="sub">Real places, real dates, in seconds. Your friends RSVP by text.</p>
      <a className="prompt" href={href}>
        <span className="typed">{ask.promptPrefill ? `"${ask.promptPrefill}"` : "Start a calendar"}</span>
        <span className="btn">Start this ↗</span>
      </a>
      <p className="handoff">Opens the prompt on joinleaf.com with this already typed in — still signed in as you, nothing to sign up for.</p>
    </div>
  );
  if (bare) return inner;
  return (
    <section className="wrap sect tail">
      <div className="eyebrow" style={{ marginBottom: 18 }}>Start your own</div>
      {inner}
    </section>
  );
}

// ---- Owner strip -----------------------------------------------------------
function OwnerStrip({ count }: { count: number }) {
  return (
    <section className="wrap sect tail">
      <div className="eyebrow" style={{ marginBottom: 18 }}>You also run a calendar</div>
      <div className="owner">
        <p>
          {count > 0 ? (
            <><b>{count} plan{count === 1 ? "" : "s"} need your review</b></>
          ) : (
            <><b>Manage your calendars</b> — review plans, RSVPs, and hosting.</>
          )}
        </p>
        <Link className="btn ghost" href="/dashboard">Manage ↗</Link>
      </div>
    </section>
  );
}

// ---- Plan detail modal (opens over /me, no navigation) ---------------------
function PlanModal({
  plan, onClose, onRsvp,
}: {
  plan: Plan;
  onClose: () => void;
  onRsvp: (id: string, s: RsvpState) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = statusFor(plan);
  // A virtual host fronts the plan's chat — the real owner isn't the one
  // hosting it there, so viewerIsHost alone shouldn't grant chat access;
  // only an actual "going" RSVP should (mirrors AttendButtons).
  const canChat = plan.rsvpState === "going" || (plan.viewerIsHost && plan.hostState !== "virtual_host");
  const addr = [plan.venueName, plan.venueAddress].filter(Boolean).join(" · ");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        {plan.image && (
          <div className="modal-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={plan.image} alt="" />
          </div>
        )}
        <div className="modal-body">
          <div className="cal">{plan.calendarName}</div>
          <h2 className="modal-title">{plan.title}</h2>
          <div className="when">{heroWhen(plan)}</div>
          {addr && <p className="addr" style={{ marginTop: 6 }}>{addr}</p>}
          {plan.description && <p className="blurb" style={{ marginTop: 8 }}>{plan.description}</p>}
          {status && (
            <div style={{ marginTop: 8 }}><span className={`status ${status.cls}`}>{status.text}</span></div>
          )}
          <div className="row" style={{ marginTop: 18 }}>
            <AttendButtons plan={plan} onRsvp={onRsvp} />
          </div>
          {canChat && (
            <div style={{ marginTop: 12 }}>
              <Link href={`/chat/${plan.id}?from=me`} className="btn ghost">Join Plan Chat ↗</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Chrome ----------------------------------------------------------------
function Spinner() {
  return <span className="lm-spin" aria-label="Loading" />;
}

// ---- OTP fallback ----------------------------------------------------------
function OtpModal({ onVerified }: { onVerified: () => void | Promise<void> }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function fmt(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  async function sendCode() {
    const d = phone.replace(/\D/g, "");
    if (d.length < 10) { setErr("Enter a valid 10-digit phone number."); return; }
    setBusy(true); setErr("");
    try { await Parse.Cloud.run("requestOTP", { phone: `+1${d}` }); setStep("code"); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Couldn't send code."); }
    finally { setBusy(false); }
  }
  async function submit() {
    const d = phone.replace(/\D/g, "");
    if (code.length < 4) { setErr("Enter the full code."); return; }
    setBusy(true); setErr("");
    try {
      const r = (await Parse.Cloud.run("verifyOTP", { phone: `+1${d}`, code })) as { sessionToken?: string } | string;
      const st = typeof r === "string" ? r : r?.sessionToken;
      if (!st || !st.startsWith("r:")) throw new Error("Verification failed. Try again.");
      await Parse.User.become(st);
      await onVerified();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Verification failed."); }
    finally { setBusy(false); }
  }
  return (
    <div className="otp">
      <div className="otp-card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Your plans · Leaf</div>
        <p className="lede" style={{ fontFamily: "var(--serif)", fontSize: 22, marginBottom: 4 }}>See your week</p>
        <p className="sub" style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 18 }}>
          {step === "phone" ? "Enter the phone on your Leaf account." : `Code sent to +1 ${phone}`}
        </p>
        {step === "phone" ? (
          <>
            <input className="otp-in" type="tel" value={phone} autoFocus placeholder="(555) 123-4567" onChange={(e) => setPhone(fmt(e.target.value))} />
            {err && <p className="otp-err">{err}</p>}
            <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={busy} onClick={sendCode}>{busy ? "Sending…" : "Send code"}</button>
          </>
        ) : (
          <>
            <input className="otp-in" inputMode="numeric" value={code} autoFocus placeholder="Code" onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            {err && <p className="otp-err">{err}</p>}
            <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={busy} onClick={submit}>{busy ? "Verifying…" : "See my plans"}</button>
            <button className="reply" style={{ marginTop: 10 }} onClick={() => setStep("phone")}>Use a different number</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Scoped CSS (ported from the leaf-attendee-dashboard mockup) ------------
const CSS = `
.leafme{
  --ink:#111111; --ink-2:#5c5c5c; --ink-3:#9a9a9a; --rule:#e8e8e6; --paper:#ffffff;
  --sage:#dce5dc; --sage-deep:#2f5d43; --cream:#f5e6c8; --cream-deep:#8a6a2f; --green:#16a34a;
  --amber:#b06f22; --danger:#a8401f;
  --sans:var(--font-me-sans),-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --serif:var(--font-me-serif),Georgia,serif;
  background:var(--paper); color:var(--ink); font-family:var(--sans);
  -webkit-font-smoothing:antialiased; line-height:1.5; min-height:100vh;
  overflow-x:hidden;
}
.leafme *{box-sizing:border-box}
.leafme h1,.leafme .stop h3,.leafme .addr,.leafme .blurb,.leafme .meta,.leafme .cal,.leafme .msg-b .p,.leafme .owner p,.leafme .foot p,.leafme .typed{overflow-wrap:anywhere}
.leafme .wrap{max-width:940px;margin:0 auto;padding:0 28px}
.leafme .eyebrow{font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.leafme .bar{border-bottom:1px solid var(--rule)}
.leafme .bar-in{display:flex;align-items:center;justify-content:space-between;height:64px}
.leafme .leaflogo{height:24px;width:auto;display:block}
.leafme .who{display:flex;align-items:center;gap:9px}
.leafme .who span{font-size:12px;color:var(--ink-2)}
.leafme .ava{width:28px;height:28px;border-radius:50%;background:#d8d4cc;display:grid;place-items:center;font-size:11px;font-weight:600;color:var(--ink-2)}
.leafme .greet{padding-top:36px;padding-bottom:4px}
.leafme .greet-wx{display:inline-flex;align-items:center;gap:6px;margin-bottom:12px;font-size:13px;color:var(--ink-2)}
.leafme .greet-wx b{color:var(--ink);font-weight:600}
.leafme .greet-line{font-family:var(--serif);font-size:32px;font-weight:500;letter-spacing:-.01em;color:var(--ink)}
.leafme .hero{padding-top:56px;padding-bottom:44px;border-bottom:1px solid var(--rule)}
.leafme .hero .eyebrow{margin-bottom:18px}
.leafme .hero-grid{display:grid;grid-template-columns:1fr 420px;gap:40px;align-items:start}
.leafme .when{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--ink-2);margin-bottom:6px}
.leafme .hero h1{font-family:var(--serif);font-size:40px;line-height:1.08;font-weight:500;letter-spacing:-.02em;margin-bottom:12px}
.leafme .addr{font-size:13px;color:var(--ink-2);margin-bottom:4px}
.leafme .blurb{font-size:13px;color:var(--ink-3);max-width:44ch;margin-bottom:22px}
.leafme .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.leafme .attend{display:inline-flex;gap:10px;flex-wrap:wrap}
.leafme .btn{display:inline-flex;align-items:center;gap:8px;background:var(--ink);color:#fff;border:0;cursor:pointer;font-family:var(--sans);font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;padding:11px 16px;border-radius:3px;text-decoration:none}
.leafme .btn:hover{background:#000}
.leafme .btn:disabled{opacity:.5;cursor:default}
.leafme .btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--rule)}
.leafme .btn.ghost:hover{border-color:var(--ink-3);background:transparent}
.leafme .btn:focus-visible{outline:2px solid var(--green);outline-offset:2px}
.leafme .wx{display:inline-flex;align-items:center;gap:6px;background:#f6f6f4;border-radius:999px;padding:5px 11px;font-size:12px;color:var(--ink-2)}
.leafme .wx b{font-weight:600;color:var(--ink)}
.leafme .tile{aspect-ratio:4/3;border-radius:3px;display:grid;place-items:center;font-family:var(--serif);font-size:30px}
.leafme .tile.sage{background:var(--sage);color:var(--sage-deep)}
.leafme .tile.cream{background:var(--cream);color:var(--cream-deep)}
.leafme .tile.sm{aspect-ratio:16/10;font-size:19px}
.leafme .tile.photo{padding:0;overflow:hidden;background:#f2f2f0}
.leafme .tile.photo img{width:100%;height:100%;object-fit:cover;display:block}
.leafme .tile-wrap{position:relative;display:block}
.leafme .tile-link{display:block;width:100%;padding:0;margin:0;border:0;background:none;cursor:pointer;text-decoration:none}
.leafme .plan-link{display:inline;padding:0;margin:0;border:0;background:none;font:inherit;color:inherit;letter-spacing:inherit;cursor:pointer;text-align:left}
.leafme .plan-link:hover{color:var(--ink-2)}
.leafme .chat-btn{margin-top:12px}
.leafme .wx-over{position:absolute;top:10px;right:10px;margin:0;z-index:2;background:rgba(255,255,255,.92);box-shadow:0 1px 3px rgba(0,0,0,.14)}
.leafme .sect{padding-top:44px;padding-bottom:44px;border-bottom:1px solid var(--rule)}
.leafme .sect.tail{border-bottom:none;padding-bottom:32px}
.leafme .sect-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:26px}
.leafme .count{font-size:11px;color:var(--ink-3)}
.leafme .count .new{color:var(--green)}
.leafme .spine{position:relative;padding-left:96px}
.leafme .spine::before{content:"";position:absolute;left:71px;top:8px;bottom:8px;width:1px;background:var(--rule)}
.leafme .stop{position:relative;padding-bottom:30px}
.leafme .stop:last-child{padding-bottom:0}
.leafme .date{position:absolute;left:-96px;top:0;width:56px;text-align:right}
.leafme .date .d{font-family:var(--serif);font-size:22px;line-height:1;color:var(--ink)}
.leafme .date .m{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-3);margin-top:4px}
.leafme .dot{position:absolute;left:-30px;top:7px;width:7px;height:7px;border-radius:50%;background:var(--paper);border:1.5px solid var(--ink-3)}
.leafme .dot.on{background:var(--green);border-color:var(--green)}
.leafme .stop-card{display:grid;grid-template-columns:120px 1fr;gap:18px;align-items:start}
.leafme .stop h3{font-family:var(--serif);font-size:17px;font-weight:500;letter-spacing:-.01em;margin-bottom:3px}
.leafme .meta{font-size:12px;color:var(--ink-3);margin-bottom:9px}
.leafme .cal{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-bottom:5px}
.leafme .status{display:inline-flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2);background:none;border:0;padding:0;border-radius:0;box-shadow:none}
.leafme .status::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--ink-3)}
.leafme .status.host::before{background:var(--green)}
.leafme .status.wait::before{background:#d9a441}
.leafme .cal-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.leafme .cal-row .cal{margin-bottom:0}
.leafme .cal-row .status{flex-shrink:0}
.leafme .attend-cta-wrap{flex-shrink:0;text-align:right}
.leafme .going-count{font-size:11px;color:var(--ink-3);margin-bottom:6px;white-space:nowrap}
.leafme .attend-cta{background:#18181b;border:0;border-radius:6px;color:#fff;font-family:var(--sans);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:9px 16px;cursor:pointer;white-space:nowrap}
.leafme .attend-cta:hover{opacity:.9}
.leafme .attend-cta:disabled{opacity:.5;cursor:default}
.leafme .thread{margin-top:14px;padding-top:13px;border-top:1px solid var(--rule)}
.leafme .thread.hero-thread{max-width:44ch}
.leafme .msg{display:flex;gap:11px;padding:9px 0}
.leafme .msg:first-child{padding-top:0}
.leafme .mava{width:26px;height:26px;border-radius:50%;flex-shrink:0;background:var(--sage);display:grid;place-items:center;font-family:var(--serif);font-size:12px;color:var(--sage-deep);position:relative}
.leafme .mava.unread::after{content:"";position:absolute;top:-1px;right:-1px;width:7px;height:7px;border-radius:50%;background:var(--green);border:1.5px solid var(--paper)}
.leafme .msg-b .t{font-size:11px;font-weight:500;color:var(--ink-2);margin-bottom:3px}
.leafme .msg-b .p{font-size:13px;color:var(--ink);line-height:1.45}
.leafme .msg-b .ago{font-size:11px;color:var(--ink-3);margin-top:3px}
.leafme .reply{background:none;border:0;padding:0;margin-top:7px;cursor:pointer;font-family:var(--sans);font-size:11px;color:var(--ink-2);border-bottom:1px solid var(--rule)}
.leafme .reply:hover{color:var(--ink);border-color:var(--ink-3)}
.leafme .reply.earlier{margin-top:0;margin-bottom:12px;display:inline-block}
.leafme .composer{display:flex;gap:8px;margin-top:10px}
.leafme .composer input{flex:1;border:1px solid var(--rule);border-radius:3px;padding:9px 12px;font-family:var(--sans);font-size:13px;color:var(--ink)}
.leafme .composer input:focus{outline:2px solid var(--green);outline-offset:1px}
/* Plans that need a host (leaf-needs-a-host-cta) */
.leafme .nhs{padding-top:8px;padding-bottom:8px}
.leafme .nhs .head{padding-bottom:20px}
.leafme .nhs .head h1{font-family:var(--serif);font-size:24px;font-weight:500;letter-spacing:-.01em;margin-top:6px}
.leafme .nhs .head h1 .k{color:var(--danger)}
.leafme .tierlab{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);margin:0 0 12px}
.leafme .hcard{display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid var(--rule)}
.leafme .hcard .date{width:46px;flex-shrink:0;text-align:left}
.leafme .hcard .date .d{font-family:var(--serif);font-size:28px;line-height:.85;color:var(--ink)}
.leafme .hcard .date .mo{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3);margin-top:5px}
.leafme .hcard .thumb{width:82px;height:60px;flex-shrink:0;border-radius:4px;object-fit:cover;display:block}
.leafme .hcard .thumb.ph{background:var(--sage)}
.leafme .hcard .hb{flex:1;min-width:0}
.leafme .hcard .hb h3{font-family:var(--serif);font-size:18px;font-weight:500;letter-spacing:-.01em;line-height:1.2;display:flex;align-items:center;gap:8px}
.leafme .heart-btn{background:none;border:0;padding:0;cursor:pointer;display:inline-flex;color:var(--ink-3);flex-shrink:0}
.leafme .heart-btn:hover{color:var(--ink-2)}
.leafme .heart-btn.on{color:var(--sage-deep)}
.leafme .heart-btn:disabled{cursor:default}
.leafme .hcard .hmeta{font-size:12.5px;color:var(--ink-3);margin-top:3px}
.leafme .decay{display:inline-flex;align-items:center;gap:6px;margin-top:7px;font-size:12px;font-weight:500}
.leafme .decay.soon{color:var(--danger)}
.leafme .decay.warn{color:var(--amber)}
.leafme .decay::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.leafme .hact{flex-shrink:0;text-align:right}
.leafme .interested{font-size:11px;color:var(--ink-3);margin-bottom:6px}
.leafme .hostbtn{background:var(--sage-deep);color:#fff;border:0;border-radius:6px;cursor:pointer;font-family:var(--sans);font-size:13px;font-weight:600;padding:11px 17px;white-space:nowrap}
.leafme .hostbtn:hover{background:#264c37}
.leafme .hostbtn:disabled{opacity:.6;cursor:default}
.leafme .tier2{margin-top:36px;padding-top:26px}
.leafme .crow{display:flex;align-items:center;gap:14px;text-decoration:none;color:inherit;border:1px solid var(--rule);border-radius:8px;padding:15px 16px;margin-bottom:10px;background:#fff}
.leafme .crow:hover{border-color:var(--ink-3);background:#faf9f6}
.leafme .crow .gmark{width:34px;height:34px;border-radius:7px;flex-shrink:0;object-fit:cover;display:block}
.leafme .crow .gmark.ph{background:#d8d4cc;display:grid;place-items:center;font-family:var(--serif);font-size:14px;font-weight:600;color:var(--ink-2)}
.leafme .crow .cbody{flex:1;min-width:0}
.leafme .crow .cbody .n{font-size:15px;font-weight:600;letter-spacing:-.01em}
.leafme .crow .cbody .c{font-size:13px;color:var(--ink-3);margin-top:2px}
.leafme .crow .cbody .c b{color:var(--amber);font-weight:600}
.leafme .crow .cbody .c b.soon{color:var(--danger)}
.leafme .crow .cta{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--sage-deep);white-space:nowrap}
@media(max-width:600px){
  .leafme .hcard{flex-wrap:wrap;gap:12px}
  .leafme .hcard .thumb{display:none}
  .leafme .hcard .hact{flex-basis:100%;text-align:right;margin-top:2px}
  .leafme .crow .cta span{display:none}
}
.leafme .start{border:1px solid var(--rule);border-radius:3px;padding:26px 24px}
.leafme .start .lede{font-family:var(--serif);font-size:20px;line-height:1.3;margin-bottom:5px}
.leafme .start .sub{font-size:13px;color:var(--ink-3);margin-bottom:18px}
.leafme .prompt{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--rule);border-radius:3px;padding:5px 5px 5px 15px;background:#fbfbfa;text-decoration:none}
.leafme .prompt:hover{border-color:var(--ink-3)}
.leafme .typed{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--ink-2);padding:9px 0}
.leafme .handoff{font-size:11px;color:var(--ink-3);margin-top:12px}
.leafme .owner{display:flex;align-items:center;justify-content:space-between;gap:18px;border:1px solid var(--rule);border-radius:3px;padding:16px 18px}
.leafme .owner p{font-size:13px;color:var(--ink-2)}
.leafme .owner p b{color:var(--ink);font-weight:500}
.leafme .foot{border-top:1px solid var(--rule);margin-top:20px;padding-top:44px;padding-bottom:80px}
.leafme .foot p{font-size:12px;color:var(--ink-3);max-width:52ch;line-height:1.6}
.leafme .foot a{color:var(--ink-2)}
.leafme .foot-links{margin-top:12px;font-size:11px;letter-spacing:.04em}
.leafme .foot-links a{text-decoration:none}
.leafme .foot-links a:hover{color:var(--ink)}
.leafme .note{font-family:var(--serif);font-style:italic;font-size:13px;color:var(--ink-3);margin-top:10px;margin-bottom:4px}
.leafme .lm-center{min-height:100vh;display:grid;place-items:center;padding:0 28px}
.leafme .lm-muted{font-size:13px;color:var(--ink-3)}
.leafme .lm-spin{width:22px;height:22px;border-radius:50%;border:2px solid var(--rule);border-top-color:var(--ink-3);animation:lmspin .8s linear infinite;display:inline-block}
@keyframes lmspin{to{transform:rotate(360deg)}}
.leafme .otp{min-height:100vh;display:grid;place-items:center;padding:0 24px}
.leafme .otp-card{width:100%;max-width:360px}
.leafme .otp-in{width:100%;border:1px solid var(--rule);border-radius:3px;padding:10px 12px;font-family:var(--sans);font-size:14px;margin-bottom:12px}
.leafme .otp-in:focus{outline:2px solid var(--green);outline-offset:1px}
.leafme .otp-err{font-size:12px;color:#c0392b;margin-bottom:10px}
.leafme .modal-overlay{position:fixed;inset:0;z-index:60;background:rgba(17,17,17,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.leafme .modal-card{position:relative;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;background:var(--paper);border-radius:14px;animation:lmmodal .2s ease}
@keyframes lmmodal{from{transform:translateY(16px);opacity:.5}to{transform:translateY(0);opacity:1}}
.leafme .modal-x{position:absolute;top:12px;right:12px;z-index:2;width:32px;height:32px;border:0;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(0,0,0,.14);font-size:20px;line-height:1;cursor:pointer;color:var(--ink)}
.leafme .modal-img{width:100%;aspect-ratio:16/9;overflow:hidden;background:#f2f2f0;border-radius:14px 14px 0 0}
.leafme .modal-img img{width:100%;height:100%;object-fit:cover;display:block}
.leafme .modal-body{padding:22px 22px 28px}
.leafme .modal-title{font-family:var(--serif);font-size:26px;font-weight:500;letter-spacing:-.01em;margin:4px 0 8px}
@media(max-width:760px){
  .leafme .wrap{padding:0 20px}
  .leafme .modal-overlay{align-items:flex-end;padding:0}
  .leafme .modal-card{max-width:none;border-radius:16px 16px 0 0;max-height:88vh}
  .leafme .modal-img{border-radius:16px 16px 0 0}
  .leafme .hero-grid{grid-template-columns:1fr;gap:24px}
  .leafme .greet{padding-top:24px}
  .leafme .greet-line{font-size:26px}
  .leafme .hero{padding-top:32px;padding-bottom:32px}
  .leafme .hero h1{font-size:30px}
  .leafme .hero-grid > .tile-link,.leafme .hero-grid > .tile-wrap{order:-1;margin-bottom:6px}
  .leafme .hero-grid .tile{max-width:100%}
  .leafme .sect-head{flex-direction:column;align-items:flex-start;gap:6px}
  .leafme .spine{padding-left:0}
  .leafme .spine::before{display:none}
  .leafme .date{position:static;width:auto;text-align:left;display:flex;align-items:baseline;gap:7px;margin-bottom:8px}
  .leafme .date .m{margin-top:0}
  .leafme .dot{display:none}
  .leafme .stop-card{grid-template-columns:88px 1fr;gap:14px}
  .leafme .owner{flex-direction:column;align-items:stretch;gap:14px;padding:18px}
  .leafme .owner .btn{width:100%;justify-content:center}
  .leafme .sect{padding-top:32px;padding-bottom:32px}
  .leafme .sect.tail{padding-top:32px;padding-bottom:28px}
  .leafme .foot{margin-top:16px;padding-top:36px;padding-bottom:110px}
}
@media(prefers-reduced-motion:reduce){.leafme *{transition:none!important;animation:none!important}}
`;
