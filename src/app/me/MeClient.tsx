"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import Parse from "@/lib/parse-client";
import HostIdeaModal from "@/components/HostIdeaModal";
import VirtualHostBadge from "@/components/VirtualHostBadge";
import { setVerifiedUserCookie } from "@/lib/verified-user";
import NewPlanModal, {
  ME_PLAN_DRAFT_KEY,
  type CreatedPlan,
  type NewPlanDraftSnapshot,
  type PostToOption,
} from "./NewPlanModal";

// ============================================================================
// Attendee dashboard (/me). The signed-in home: the next plan, everything
// upcoming across followed calendars, plans on those calendars still needing a
// host, places worth marking interest in, and — new — a way to make a plan of
// your own without leaving the page.
//
// Built to the /me handoff spec: desktop is the 1180px split view (1a, plans
// left / rail right); mobile is the single scroll with a sticky "+ New plan"
// (4a). Newsreader for headings and titles, IBM Plex Sans for UI, IBM Plex
// Mono for the small caps labels.
// ============================================================================

// ---- Types (mirror the getMeDashboard payload) -----------------------------
type HostState = "waiting_on_host" | "human_host" | "leaf_arranging" | "leaf_hosted" | "virtual_host";
type RsvpState = "going" | "not_going" | "no_response" | "pending" | "waitlisted";

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
  requireApproval?: boolean;
  capacity?: number | null;
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
// Spot interest probe (To Plan v2 §C4). Venue-framed by design: the payload
// carries no owner identity and the card must never imply "someone you know".
interface SpotProbe {
  probeId: string;
  venueSnapshot: {
    name: string;
    category: string | null;
    neighborhood: string | null;
    imageURL: string | null;
  } | null;
  window: { startIso: string; endIso: string; label: string } | null;
  status: string; // pending | interested | passed | expired
  // Calendar-framed probes (v2): the followed calendar collecting interest on
  // this venue. Null on legacy bookmark-sourced probes, which stay anonymous.
  calendarId?: string | null;
  calendarName?: string | null;
  // Stamped after the one-tap popup has shown this probe — the popup never
  // re-fires for a seen probe, answered or not.
  seenAt?: string | null;
}
interface Dashboard {
  person: { firstName: string; ownsCalendars: boolean; pendingReviewCount: number };
  greeting?: { weather: Weather | null };
  needsHost?: NeedsHost;
  spotProbes?: SpotProbe[]; // may be absent while the server side ships
  nextPlan: Plan | null;
  plans: Plan[];
  unreadMessageCount: number;
  ask: { kind: "pattern" | "generic"; copy: string; promptPrefill: string | null } | null;
}

type AuthState = "resolving" | "authed" | "needs-otp" | "error";

/** Rows shown in "Your plans" before the expander. */
const PLAN_PAGE = 5;

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
/** Hero eyebrow — "Next up · tomorrow 7:00 PM". */
function heroWhen(plan: Plan) {
  return ["Next up", [relPhrase(plan.date), timeLabel(plan)].filter(Boolean).join(" ")]
    .filter(Boolean).join(" · ");
}
/** Long form for the plan modal — "Thursday, tomorrow, 7:00 PM". */
function fullWhen(plan: Plan) {
  return [weekday(plan.date), relPhrase(plan.date), timeLabel(plan)].filter(Boolean).join(" · ");
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
/** Maps deep link for the hero's "Getting there". Null when there's no place. */
function directionsUrl(plan: Plan): string | null {
  const q = [plan.venueName, plan.venueAddress].filter(Boolean).join(", ");
  if (!q) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

// Tile — Leaf's signature artifact: a colored square with a serif word. Stands
// in for the spec's hatch placeholder, and carries more meaning than one.
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
  plan, index, variant, onOpen,
}: {
  plan: Plan;
  index: number;
  variant: "hero" | "row" | "card";
  onOpen?: () => void;
}) {
  const tileEl = plan.image ? (
    <div className={`tile photo t-${variant}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plan.image} alt="" />
    </div>
  ) : (() => {
    const t = tileFor(plan, index);
    return <div className={`tile ${t.tone} t-${variant}`}>{t.word}</div>;
  })();
  const content = <div className={`tile-wrap t-${variant}`}>{tileEl}</div>;
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={`tile-link t-${variant}`} aria-label={`Open ${plan.title}`}>
        {content}
      </button>
    );
  }
  return content;
}

// Speech bubble — the one inline icon the spec keeps.
function ChatIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden style={{ flex: "none" }}>
      <path
        d="M3 5.6c0-1 .8-1.8 1.8-1.8h10.4c1 0 1.8.8 1.8 1.8v6.1c0 1-.8 1.8-1.8 1.8H8.3L4.6 16.6a.5.5 0 0 1-.8-.4v-2.7H4.8c-1 0-1.8-.8-1.8-1.8z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
      />
    </svg>
  );
}

function statusFor(plan: Plan): { cls: string; text: string } | null {
  if (plan.hostState === "leaf_hosted" && plan.hostPersona) {
    return { cls: "host", text: `Hosted by Leaf · ${plan.hostPersona.name}` };
  }
  if (plan.hostState === "leaf_hosted") return { cls: "host", text: "Hosted by Leaf" };
  // The viewer's own queued state outranks host-context pills — it's the
  // state they act on ("did my request go through?").
  if (plan.rsvpState === "pending") return { cls: "wait", text: "Requested · waiting on host" };
  if (plan.rsvpState === "waitlisted") return { cls: "wait", text: "On the waitlist" };
  // A virtual/Leaf host is the public face of the plan even though the owner
  // technically owns the EventGroup — read like "Organized by {persona}", not
  // "You're hosting" (mirrors org/[shareId]'s viewerHostsPlan exclusion).
  if (plan.hostState === "virtual_host") {
    const by = plan.hostPersona ? `Organized by ${plan.hostPersona.name}` : "Organized by Leaf";
    return { cls: "host", text: plan.attendeeCount > 0 ? `${by} · ${plan.attendeeCount} going` : by };
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

// Capacity reached — no new RSVPs or requests (server enforces this too).
function planIsFull(plan: Plan) {
  return plan.capacity != null && plan.attendeeCount >= plan.capacity;
}
/** Hosting marker belongs to the actual host; a virtual host fronts the plan. */
function viewerHosts(plan: Plan) {
  return plan.viewerIsHost && plan.hostState !== "virtual_host";
}
/** Chat is for people in the room: attendees and real hosts. */
function canChat(plan: Plan) {
  return plan.rsvpState === "going" || viewerHosts(plan);
}
function unreadCount(plan: Plan) {
  return plan.messages.filter((m) => m.unread).length;
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
          // Strip the magic-link credentials but keep any other params (the
          // Google-Calendar return flag rides on this same URL).
          const url = new URL(window.location.href);
          url.searchParams.delete("t");
          url.searchParams.delete("u");
          window.history.replaceState(null, "", url.pathname + url.search);
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
    body = <DashboardView data={data} onRsvp={onRsvp} onRefresh={fetchDashboard} />;
  }

  return (
    <div className="leafme">
      <style>{CSS}</style>
      {body}
    </div>
  );
}

/** True when this load is the hop back from the Google Calendar consent screen. */
function isGoogleCalendarReturn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("openNewPlan") === "1";
}
/** The composer draft parked before that redirect, if it survived. */
function readParkedDraft(): NewPlanDraftSnapshot | null {
  try {
    const raw = sessionStorage.getItem(ME_PLAN_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as NewPlanDraftSnapshot) : null;
  } catch {
    return null;
  }
}
/** Newest pending probe this reader hasn't been shown yet — the popup fires
 *  once per probe, and dismissing without answering still counts as shown. */
function firstUnseenProbe(probes: SpotProbe[] | undefined): SpotProbe | null {
  return (probes || []).find((p) => p && p.probeId && p.status === "pending" && !p.seenAt) || null;
}

// ---- Dashboard view --------------------------------------------------------
function DashboardView({
  data, onRsvp, onRefresh,
}: {
  data: Dashboard;
  onRsvp: (id: string, s: RsvpState) => void;
  onRefresh: () => Promise<void>;
}) {
  const hero = data.nextPlan;
  const spine = data.plans.slice(1); // hero is plans[0]
  const calCount = new Set(data.plans.map((p) => p.calendarId).filter(Boolean)).size;
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // ---- New plan ----------------------------------------------------------
  // Returning from the Google Calendar OAuth redirect reopens the composer with
  // everything that was typed before the hop — resolved at mount rather than in
  // an effect so the sheet doesn't flash closed first.
  const [createOpen, setCreateOpen] = useState(() => isGoogleCalendarReturn());
  const [restore, setRestore] = useState<NewPlanDraftSnapshot | null>(() =>
    isGoogleCalendarReturn() ? readParkedDraft() : null,
  );
  const [justCreated, setJustCreated] = useState<CreatedPlan | null>(null);
  // Calendars this person owns — chips in the composer's POST TO row, and the
  // only ones that can carry a repeating series.
  const [ownedCalendars, setOwnedCalendars] = useState<PostToOption[]>([]);
  useEffect(() => {
    if (!data.person.ownsCalendars) return;
    let cancelled = false;
    Parse.Cloud.run("getMyOrganizations")
      .then((r: { organizations?: { objectId: string; name: string }[] }) => {
        if (cancelled) return;
        setOwnedCalendars(
          (r?.organizations || []).map((o) => ({ id: o.objectId, name: o.name, owned: true })),
        );
      })
      .catch(() => { /* chips just fall back to followed calendars */ });
    return () => { cancelled = true; };
  }, [data.person.ownsCalendars]);

  // Clear the OAuth-return breadcrumbs so a refresh doesn't reopen the sheet.
  useEffect(() => {
    if (!isGoogleCalendarReturn()) return;
    try { sessionStorage.removeItem(ME_PLAN_DRAFT_KEY); } catch { /* ignore */ }
    const url = new URL(window.location.href);
    url.searchParams.delete("openNewPlan");
    url.searchParams.delete("google_calendar");
    window.history.replaceState(null, "", url.pathname + url.search);
  }, []);

  const postToOptions = useMemo<PostToOption[]>(() => {
    const byId = new Map<string, PostToOption>();
    for (const o of ownedCalendars) byId.set(o.id, o);
    const addFollowed = (id: string | null, name: string) => {
      if (!id || byId.has(id)) return;
      byId.set(id, { id, name, owned: false });
    };
    for (const p of data.plans) addFollowed(p.calendarId, p.calendarName);
    for (const c of data.needsHost?.tier2 || []) addFollowed(c.calendarId, c.calendarName);
    return [...byId.values()].slice(0, 8);
  }, [ownedCalendars, data.plans, data.needsHost]);

  function openCreate() { setRestore(null); setCreateOpen(true); }

  // One-tap probe popup: fires once per unseen pending probe, newest first.
  // Seen is stamped server-side the moment it shows — dismissing without
  // answering still means it never pops again; the inline section remains.
  const [popupProbe, setPopupProbe] = useState<SpotProbe | null>(
    () => firstUnseenProbe(data.spotProbes),
  );
  const [popupAnsweredId, setPopupAnsweredId] = useState<string | null>(null);
  useEffect(() => {
    if (!popupProbe) return;
    Parse.Cloud.run("markSpotProbesSeen", { probeIds: [popupProbe.probeId] }).catch(() => {});
    // Stamped once, on the probe this mount chose to show — a later refetch
    // must not re-fire it, so this deliberately doesn't track popupProbe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const places = (data.spotProbes || []).filter(
    (p) => p && p.probeId && p.probeId !== popupAnsweredId && p.status === "pending",
  );

  // Read the live plan object so RSVP changes reflect inside the modal.
  const openPlan =
    (data.nextPlan && data.nextPlan.id === openPlanId ? data.nextPlan : null) ||
    data.plans.find((p) => p.id === openPlanId) ||
    null;

  const shown = showAll ? spine : spine.slice(0, PLAN_PAGE);
  const moreCount = spine.length - shown.length;
  const firstName = (data.person.firstName || "").trim().split(/\s+/)[0] || "";
  const rail = data.needsHost;
  const hasRail =
    (rail && (rail.tier1.length > 0 || rail.tier2.length > 0)) || places.length > 0;

  return (
    <>
      <header className="topbar">
        <div className="page topbar-in">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/leaf-logo-black.png" alt="Leaf" />
          </div>
          <div className="topbar-r">
            <button className="pill" onClick={openCreate}>+ New plan</button>
            <div className="who">
              <span>{data.person.firstName || "You"}</span>
              <div className="ava">{initial(data.person.firstName || "Y")}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="page cols">
        <div className={`colL ${hasRail ? "" : "solo"}`}>
          <div className="greet">
            {data.greeting?.weather && (data.greeting.weather.temp || data.greeting.weather.text) && (
              <div className="greet-wx">
                {data.greeting.weather.temp}° {data.greeting.weather.text}
              </div>
            )}
            <h1 className="greet-h">
              {greetingWord()}{firstName ? `, ${firstName}` : ""}
            </h1>
          </div>

          {justCreated && (
            <div className="created" role="status">
              <div>
                <b>{justCreated.title}</b> is live on your calendar.
              </div>
              {justCreated.eventGroupId && (
                <Link className="created-link" href={`/p/${justCreated.eventGroupId}`}>
                  Open it ↗
                </Link>
              )}
            </div>
          )}

          {hero ? (
            <Hero plan={hero} onRsvp={onRsvp} onOpen={() => setOpenPlanId(hero.id)} />
          ) : (
            <EmptyHero onCreate={openCreate} />
          )}

          {spine.length > 0 && (
            <section className="sect">
              <div className="sect-head">
                <div className="eyebrow">Your plans</div>
                <div className="sect-meta">
                  {data.plans.length} upcoming · {calCount} calendar{calCount === 1 ? "" : "s"}
                  {data.unreadMessageCount > 0 && (
                    <> · <span className="new">{data.unreadMessageCount} new</span></>
                  )}
                </div>
              </div>
              <div className="rows">
                {shown.map((plan, i) => (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    index={i + 1}
                    last={i === shown.length - 1}
                    onRsvp={onRsvp}
                    onOpen={() => setOpenPlanId(plan.id)}
                  />
                ))}
              </div>
              {moreCount > 0 && (
                <button className="showmore" onClick={() => setShowAll(true)}>
                  Show {moreCount} more plan{moreCount === 1 ? "" : "s"}
                </button>
              )}
            </section>
          )}

          <div className="prompt-box">
            <div className="prompt-body">
              <div className="prompt-h">Hosting an event soon?</div>
              <p className="prompt-p">
                Make an invitation and collect RSVPs for free. It can live on your own
                calendar — four fields and a link you can text. No new account needed for
                you or the guests you invite.
              </p>
            </div>
            <button className="btn primary" onClick={openCreate}>Make a plan</button>
          </div>

          {data.person.ownsCalendars && (
            <div className="prompt-box tight">
              <div className="prompt-body">
                <div className="prompt-h sm">Manage your calendars</div>
                <p className="prompt-p sm">
                  Edit plans, invite hosts, and see who&rsquo;s coming across everything you organize.
                </p>
              </div>
              <Link className="btn ghost" href="/dashboard">Manage</Link>
            </div>
          )}

          {!hasRail && <TextsCard />}
        </div>

        {hasRail && (
          <aside className="colR">
            {rail && rail.tier1.length > 0 && (
              <NeedsHostRail plans={rail.tier1} onHosted={onRefresh} />
            )}
            {places.length > 0 && (
              <PlacesRail probes={places} onAnswered={(id) => setPopupAnsweredId(id)} />
            )}
            {rail && rail.tier2.length > 0 && <CalendarsRail rows={rail.tier2} />}
            <TextsCard />
          </aside>
        )}
      </main>

      {openPlan && (
        <PlanModal plan={openPlan} onClose={() => setOpenPlanId(null)} onRsvp={onRsvp} />
      )}

      {popupProbe && (
        <ProbePopup
          probe={popupProbe}
          onClose={() => setPopupProbe(null)}
          onAnswered={(id) => setPopupAnsweredId(id)}
        />
      )}

      {createOpen && (
        <NewPlanModal
          options={postToOptions}
          firstName={firstName}
          restore={restore}
          onClose={() => { setCreateOpen(false); setRestore(null); }}
          onCreated={(plan) => {
            setJustCreated(plan);
            // The new plan belongs in the spine — pull the live payload again.
            onRefresh().catch(() => {});
          }}
        />
      )}
    </>
  );
}

// ---- Hero (next up) --------------------------------------------------------
function Hero({
  plan, onRsvp, onOpen,
}: {
  plan: Plan;
  onRsvp: (id: string, s: RsvpState) => void;
  onOpen: () => void;
}) {
  const context = [plan.calendarName, plan.venueName].filter(Boolean).join(" · ");
  const spotsLeft = plan.capacity != null ? Math.max(0, plan.capacity - plan.attendeeCount) : null;
  const wx = plan.weather;
  const statusLine = [
    plan.attendeeCount > 0 ? `${plan.attendeeCount} going` : null,
    plan.capacity != null
      ? planIsFull(plan) ? "Full — waitlist open" : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
      : null,
    // Forecast for the day of the plan — the one thing that changes whether
    // you actually go, so it sits with the rest of the decision.
    wx && (wx.temp || wx.text) ? [wx.temp && `${wx.temp}°`, wx.text].filter(Boolean).join(" ") : null,
  ].filter(Boolean).join(" · ");

  return (
    <section className="hero">
      <div className="hero-top">
        <PlanTile plan={plan} index={0} variant="hero" onOpen={onOpen} />
        <div className="hero-text">
          <div className="eyebrow">{heroWhen(plan)}</div>
          <h2 className="hero-title">
            <button className="plan-link" onClick={onOpen}>{plan.title}</button>
          </h2>
          {context && <div className="hero-ctx">{context}</div>}
          {statusLine && <div className="hero-status">{statusLine}</div>}
        </div>
      </div>
      <HeroActions plan={plan} onRsvp={onRsvp} />
    </section>
  );
}

function EmptyHero({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="hero">
      <div className="hero-top">
        <div className="tile sage t-hero">plans</div>
        <div className="hero-text">
          <div className="eyebrow">Nothing coming up</div>
          <h2 className="hero-title">No plans yet</h2>
          <div className="hero-ctx">
            Nothing on your calendars in the next while. We&rsquo;ll text you the moment there is —
            or start one of your own.
          </div>
        </div>
      </div>
      <div className="hero-actions">
        <button className="btn primary" onClick={onCreate}>Make a plan</button>
      </div>
    </section>
  );
}

// ---- Hero action bar -------------------------------------------------------
function HeroActions({ plan, onRsvp }: { plan: Plan; onRsvp: (id: string, s: RsvpState) => void }) {
  const [busy, setBusy] = useState(false);
  const going = plan.rsvpState === "going";
  const pending = plan.rsvpState === "pending";
  const waitlisted = plan.rsvpState === "waitlisted";
  const hosting = viewerHosts(plan);
  const full = planIsFull(plan) && !going && !pending && !waitlisted;
  const dir = directionsUrl(plan);
  const unread = unreadCount(plan);

  async function set(next: RsvpState) {
    if (busy || plan.rsvpState === next) return;
    const prev = plan.rsvpState;
    setBusy(true);
    // Full plans land on "waitlisted" and requireApproval plans on "pending",
    // not "going" — reconcile with whatever the server actually returns.
    const target: RsvpState = next !== "going" ? next
      : full ? "waitlisted"
      : plan.requireApproval ? "pending"
      : "going";
    onRsvp(plan.id, target);
    try {
      const res = await Parse.Cloud.run("setMyRsvp", { eventGroupId: plan.id, rsvpState: next });
      if (res?.rsvpState && res.rsvpState !== target) onRsvp(plan.id, res.rsvpState as RsvpState);
    } catch {
      onRsvp(plan.id, prev);
    } finally {
      setBusy(false);
    }
  }

  const primaryLabel = hosting ? "You're hosting"
    : going ? "Going ✓"
    : pending ? "Requested ✓"
    : waitlisted ? "On the waitlist ✓"
    : full ? "Join waitlist"
    : plan.requireApproval ? "Request to attend"
    : "Count me in";

  return (
    <div className="hero-actions">
      <button
        className="btn primary"
        disabled={busy || hosting || pending || waitlisted}
        aria-pressed={going || pending || waitlisted}
        onClick={() => set("going")}
      >
        {primaryLabel}
      </button>
      {dir && (
        <a className="btn ghost" href={dir} target="_blank" rel="noopener noreferrer">Getting there</a>
      )}
      {canChat(plan) && (
        <Link className="btn ghost chat" href={`/chat/${plan.id}?from=me`} aria-label="Plan chat">
          <ChatIcon />
          <span className="chat-label">Chat{unread > 0 ? ` · ${unread}` : ""}</span>
        </Link>
      )}
      {!hosting && plan.rsvpState !== "not_going" && (
        <button className="btn text" disabled={busy} onClick={() => set("not_going")}>
          {pending ? "Withdraw request" : waitlisted ? "Leave waitlist" : "Can't make it"}
        </button>
      )}
    </div>
  );
}

// ---- "Your plans" row ------------------------------------------------------
function PlanRow({
  plan, index, last, onRsvp, onOpen,
}: {
  plan: Plan;
  index: number;
  last: boolean;
  onRsvp: (id: string, s: RsvpState) => void;
  onOpen: () => void;
}) {
  const hosting = viewerHosts(plan);
  const meta = [
    weekday(plan.date),
    timeLabel(plan),
    plan.venueName || plan.venueAddress ||
      (plan.attendeeCount > 0 ? `${plan.attendeeCount} going` : null),
    plan.capacity != null ? `${plan.capacity} max` : null,
  ].filter(Boolean).join(" · ");
  const hostHref = plan.calendarShareId
    ? `/org/${plan.calendarShareId}?host=${encodeURIComponent(plan.id)}`
    : `/p/${plan.id}`;
  // A virtual host fronts the hosting, so the real owner counts as "not
  // hosting" here too and still gets the RSVP CTA.
  const canAttend = !hosting
    && plan.rsvpState !== "going" && plan.rsvpState !== "pending" && plan.rsvpState !== "waitlisted"
    && plan.hostState !== "waiting_on_host" && plan.hostState !== "leaf_hosted";
  const unread = unreadCount(plan);

  return (
    <article className={`row ${last ? "last" : ""}`}>
      <div className="row-date">
        <div className="d">{dayNum(plan.date)}</div>
        <div className="m">{monthAbbr(plan.date)}</div>
      </div>
      <PlanTile plan={plan} index={index} variant="row" onOpen={onOpen} />
      <div className="row-text">
        <div className="row-cal">
          {plan.calendarName}
          {hosting && (
            <span className="hostmark"><span className="hostdot" />You&rsquo;re hosting</span>
          )}
        </div>
        <h3 className="row-title">
          <button className="plan-link" onClick={onOpen}>{plan.title}</button>
        </h3>
        <div className="row-meta">{meta}</div>
      </div>
      <div className="row-act">
        {plan.hostState === "waiting_on_host" ? (
          <Link className="row-btn host" href={hostHref}>Host this</Link>
        ) : canAttend ? (
          <AttendCta plan={plan} onRsvp={onRsvp} />
        ) : canChat(plan) ? (
          <Link className="row-btn ghost" href={`/chat/${plan.id}?from=me`}>
            <ChatIcon />
            <span>Chat{unread > 0 ? ` · ${unread}` : ""}</span>
          </Link>
        ) : (
          (() => {
            const s = statusFor(plan);
            return s ? <span className={`status ${s.cls}`}>{s.text}</span> : null;
          })()
        )}
      </div>
    </article>
  );
}

// One tap RSVPs going (optimistic); requireApproval plans queue a request
// ("pending") and full plans join the waitlist ("waitlisted"). Full controls
// live in the plan modal.
function AttendCta({ plan, onRsvp }: { plan: Plan; onRsvp: (id: string, s: RsvpState) => void }) {
  const [busy, setBusy] = useState(false);
  const full = planIsFull(plan);
  async function go() {
    if (busy) return;
    setBusy(true);
    const prev = plan.rsvpState;
    // Optimistically land on the state the server will return; reconcile if
    // it disagrees (e.g. a stale card missing the approval flag).
    const target: RsvpState = full ? "waitlisted" : plan.requireApproval ? "pending" : "going";
    onRsvp(plan.id, target);
    try {
      const res = await Parse.Cloud.run("setMyRsvp", { eventGroupId: plan.id, rsvpState: "going" });
      if (res?.rsvpState && res.rsvpState !== target) onRsvp(plan.id, res.rsvpState as RsvpState);
    } catch {
      onRsvp(plan.id, prev);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className="row-btn primary" disabled={busy} onClick={go}>
      {busy ? "…" : full ? "Join waitlist" : plan.requireApproval ? "Request to Join" : "Count me in"}
    </button>
  );
}

// ---- Rail: plans that need a host -----------------------------------------
function monthDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function decayText(p: HostPlan): string {
  const wd = weekday(p.hostDeadline);
  if (p.decayLevel === "soon") {
    if (p.daysToDeadline <= 0) return "Loses its slot today";
    return `Loses its slot ${wd}`;
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

function NeedsHostRail({ plans, onHosted }: { plans: HostPlan[]; onHosted: () => Promise<void> }) {
  // Local copy so a hosted card can leave the rail immediately on success.
  const [list, setList] = useState<HostPlan[]>(plans);
  useEffect(() => { setList(plans); }, [plans]);
  const [hostingIdea, setHostingIdea] = useState<HostPlan | null>(null);
  const [interested, setInterested] = useState<Set<string>>(new Set());
  const [pendingInterest, setPendingInterest] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Hydrate "already interested" from localStorage (same key expressInterestOnPlanIdea's
  // org/[shareId] caller uses), so the heart renders filled across reloads.
  useEffect(() => {
    const seen = new Set<string>();
    for (const p of plans) if (isPlanIdeaLocallyInterested(p.ideaId)) seen.add(p.ideaId);
    if (seen.size > 0) setInterested(seen);
  }, [plans]);

  async function markInterested(p: HostPlan) {
    if (interested.has(p.ideaId) || pendingInterest.has(p.ideaId)) return;
    const prior = counts[p.ideaId] ?? p.interestedCount;
    setPendingInterest((s) => new Set(s).add(p.ideaId));
    setInterested((s) => new Set(s).add(p.ideaId));
    setCounts((c) => ({ ...c, [p.ideaId]: prior + 1 }));
    markPlanIdeaLocallyInterested(p.ideaId);
    try {
      const cookie = getOrCreateInterestCookie();
      const result = (await Parse.Cloud.run("expressInterestOnPlanIdea", {
        ideaId: p.ideaId, cookie,
      })) as { count?: number };
      if (typeof result?.count === "number") setCounts((c) => ({ ...c, [p.ideaId]: result.count! }));
    } catch {
      setInterested((s) => { const n = new Set(s); n.delete(p.ideaId); return n; });
      setCounts((c) => ({ ...c, [p.ideaId]: prior }));
    } finally {
      setPendingInterest((s) => { const n = new Set(s); n.delete(p.ideaId); return n; });
    }
  }

  if (list.length === 0) return null;

  return (
    <section className="rail">
      <div className="eyebrow">Plans that need a host</div>
      <div className="hostcards">
        {list.map((p) => {
          const count = counts[p.ideaId] ?? p.interestedCount;
          const on = interested.has(p.ideaId);
          return (
            <div className="hostcard" key={p.ideaId}>
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="hostthumb" src={p.image} alt="" />
              ) : (
                <div className="hostthumb ph" />
              )}
              <div className="hostbody">
                <div className="row-cal">{p.calendarName}</div>
                <h3 className="hostcard-title">{p.title}</h3>
                <div className="hostcard-when">
                  {[weekday(p.date)?.slice(0, 3), fmtTime(p.time, p.date), p.venueName || p.venueAddress]
                    .filter(Boolean).join(" · ")}
                </div>
                <div className="hostcard-meta">
                  {p.decayLevel === "soon" && <span className="urgent">{decayText(p)}</span>}
                  {count > 0 && (
                    <span className={`interest ${on ? "on" : ""}`}>{count} interested</span>
                  )}
                </div>
              </div>
              <div className="hostact">
                <button className="hostbtn" onClick={() => setHostingIdea(p)}>Host this</button>
                <button
                  type="button"
                  className={`heart-toggle ${on ? "on" : ""}`}
                  aria-label={on ? "You're interested" : "Mark interest"}
                  aria-pressed={on}
                  disabled={on || pendingInterest.has(p.ideaId)}
                  onClick={() => markInterested(p)}
                >
                  <Heart className="w-3.5 h-3.5" fill={on ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

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
            setList((l) => l.filter((x) => x.ideaId !== hostingIdea.ideaId));
            onHosted().catch(() => {});
          }}
        />
      )}
    </section>
  );
}

// ---- Rail: places · mark interest -----------------------------------------
// GUARDRAIL (To Plan v2 §7): venue-framed only. The row never names who queued
// the spot, never says "someone you know", never hints at provenance — the
// venue is the subject and the reader reacts to the place itself. One tap
// either way, no guilt copy, and an answered row is never re-shown.
function PlacesRail({
  probes, onAnswered,
}: {
  probes: SpotProbe[];
  onAnswered: (probeId: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, "interested" | "passed">>({});

  function respond(p: SpotProbe, response: "interested" | "passed") {
    if (answers[p.probeId] === response) return;
    setAnswers((a) => ({ ...a, [p.probeId]: response }));
    onAnswered(p.probeId);
    // Fire-and-forget: the answer is a soft signal, not an RSVP — never
    // re-surface the row to retry.
    Parse.Cloud.run("respondToSpotProbe", { probeId: p.probeId, response }).catch(() => {});
  }

  return (
    <section className="rail">
      <div className="rail-head">
        <div className="eyebrow">Places · mark interest</div>
      </div>
      <p className="rail-sub">
        We&rsquo;ll text you when a plan lands somewhere you&rsquo;re interested in.
      </p>
      <div className="places">
        {probes.map((p) => {
          const v = p.venueSnapshot;
          const on = answers[p.probeId] === "interested";
          const sub = [v?.neighborhood, v?.category].filter(Boolean).join(" · ");
          return (
            <div className={`place ${on ? "on" : ""}`} key={p.probeId}>
              <div className="place-text">
                <div className="place-n">{v?.name || "A spot nearby"}</div>
                <div className="place-s">{sub || p.window?.label || "Worth a look"}</div>
              </div>
              <button
                className={`heart-toggle ${on ? "on" : ""}`}
                aria-label={on ? "Interested" : "Mark interest"}
                aria-pressed={on}
                onClick={() => respond(p, on ? "passed" : "interested")}
              >
                <Heart className="w-4 h-4" fill={on ? "currentColor" : "none"} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Texts / notification card --------------------------------------------
function TextsCard() {
  return (
    <div className="texts">
      <p>One text a week, Sunday morning. Plus a heads-up when something lands late.</p>
      <Link className="btn ghost sm" href="/unsubscribe">Texts</Link>
    </div>
  );
}

// ---- Rail: calendars you follow -------------------------------------------
function CalendarsRail({ rows }: { rows: HostCalRow[] }) {
  return (
    <section className="rail">
      <div className="eyebrow">Calendars you follow</div>
      <div className="cals">
        {rows.map((c) => (
          <Link
            key={c.calendarId}
            className="cal-row"
            href={c.calendarShareId ? `/org/${c.calendarShareId}` : "#"}
          >
            {c.calendarPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="cal-ava" src={c.calendarPhoto} alt="" />
            ) : (
              <span className="cal-ava ph">{initial(c.calendarName)}</span>
            )}
            <div className="cal-body">
              <div className="cal-n">{c.calendarName}</div>
              <div className={`cal-s ${c.soonestIsUrgent ? "urgent" : ""}`}>
                {c.count} plan{c.count === 1 ? "" : "s"} need{c.count === 1 ? "s" : ""} a host
                {c.soonestIsUrgent ? "" : ` · ${monthDay(c.soonestDeadline)}`}
              </div>
            </div>
            <span className="cal-cta">View</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---- One-tap probe popup ---------------------------------------------------
// Same guardrails as PlacesRail: one tap either way, no guilt copy, and
// closing without answering is a first-class exit (the inline row stays).
function ProbePopup({
  probe, onClose, onAnswered,
}: {
  probe: SpotProbe;
  onClose: () => void;
  onAnswered: (probeId: string) => void;
}) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const v = probe.venueSnapshot;
  const catHood = [v?.category, v?.neighborhood].filter(Boolean).join(" · ");

  function respond(response: "interested" | "passed") {
    if (done) return;
    setDone(true);
    onAnswered(probe.probeId);
    Parse.Cloud.run("respondToSpotProbe", {
      probeId: probe.probeId, response, respondedVia: "me_popup",
    }).catch(() => {});
    window.setTimeout(onClose, 1100);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card probe-pop" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        {v?.imageURL && (
          <div className="modal-img">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.imageURL} alt="" />
          </div>
        )}
        <div className="modal-body">
          {done ? (
            <div className="probe-thanks">Got it</div>
          ) : (
            <>
              {probe.calendarName && <div className="row-cal">{probe.calendarName}</div>}
              <h2 className="modal-title">{v?.name || "A spot nearby"}</h2>
              {catHood && <div className="hero-ctx">{catHood}</div>}
              <p className="modal-blurb">
                {probe.window?.label
                  ? `${probe.window.label} could work — would you go?`
                  : "Would you go sometime?"}
              </p>
              <div className="hero-actions flat">
                <button className="hostbtn" onClick={() => respond("interested")}>Interested</button>
                <button className="btn ghost" onClick={() => respond("passed")}>Not for me</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Thread (messages, colocated with their plan in the modal) -------------
function Thread({ plan }: { plan: Plan }) {
  const [expanded, setExpanded] = useState(false);
  // Message previews are only for people who can actually open the chat —
  // not going / not hosting shouldn't see chat content.
  if (!canChat(plan) || plan.messages.length === 0) return null;

  // Lead with what needs attention: show all UNREAD messages; if everything's
  // read, fall back to just the latest one for context.
  const unread = plan.messages.filter((m) => m.unread);
  const base = unread.length > 0 ? unread : plan.messages.slice(-1);
  const shown = expanded ? plan.messages : base;
  const hidden = expanded ? 0 : plan.messages.length - base.length;

  return (
    <div className="thread">
      {!expanded && hidden > 0 && (
        <button className="linkbtn" onClick={() => setExpanded(true)}>
          Show {hidden} earlier message{hidden === 1 ? "" : "s"}
        </button>
      )}
      {shown.map((m, i) => (
        <div className="msg" key={m.id || i}>
          <div className={`mava ${m.unread ? "unread" : ""}`}>{initial(m.authorName)}</div>
          <div className="msg-b">
            <div className="t">
              <span>{m.authorName}</span>
              {m.authorRole === "virtual_host" ? (
                // The same tooltip the web chat bubble carries — one
                // disclosure, one wording, both places it can be read.
                <> <VirtualHostBadge persona={{ name: m.authorName }} /></>
              ) : m.authorRole === "leaf" ? (
                " · Leaf concierge"
              ) : plan.calendarName ? (
                ` · ${plan.calendarName}`
              ) : (
                ""
              )}
            </div>
            <p className="p">{m.body}</p>
            {m.sentAt && <div className="ago">{ago(m.sentAt)}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Attend buttons (plan modal) -------------------------------------------
function AttendButtons({
  plan, onRsvp,
}: {
  plan: Plan;
  onRsvp: (id: string, s: RsvpState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const going = plan.rsvpState === "going";
  const pending = plan.rsvpState === "pending";
  const waitlisted = plan.rsvpState === "waitlisted";
  const full = planIsFull(plan) && !going && !pending && !waitlisted;

  async function set(next: RsvpState) {
    if (busy || plan.rsvpState === next) return;
    const prev = plan.rsvpState;
    setBusy(true);
    const target: RsvpState = next !== "going" ? next
      : full ? "waitlisted"
      : plan.requireApproval ? "pending"
      : "going";
    onRsvp(plan.id, target);
    try {
      const res = await Parse.Cloud.run("setMyRsvp", { eventGroupId: plan.id, rsvpState: next });
      if (res?.rsvpState && res.rsvpState !== target) onRsvp(plan.id, res.rsvpState as RsvpState);
    } catch {
      onRsvp(plan.id, prev);
    } finally {
      setBusy(false);
    }
  }

  // Hosts don't RSVP to their own plan — they host it. A virtual host fronts
  // the plan instead, so the real owner is just another potential attendee.
  if (viewerHosts(plan)) {
    return <button className="btn primary" disabled>✓ Hosting</button>;
  }

  return (
    <>
      <button
        className="btn primary"
        aria-pressed={going || pending || waitlisted}
        disabled={busy || pending || waitlisted}
        onClick={() => set("going")}
      >
        {going ? "Going ✓"
          : pending ? "Requested ✓"
          : waitlisted ? "On waitlist ✓"
          : full ? "Join waitlist"
          : plan.requireApproval ? "Request to attend"
          : "Count me in"}
      </button>
      <button
        className="btn ghost"
        aria-pressed={plan.rsvpState === "not_going"}
        disabled={busy}
        onClick={() => set("not_going")}
      >
        {pending ? "Withdraw request" : waitlisted ? "Leave waitlist" : <>Can&rsquo;t make it</>}
      </button>
    </>
  );
}

// ---- Plan detail modal (opens over /me, no navigation) ---------------------
// The /org calendar page identifies visitors by phone (leaf_follower_phone /
// leaf_verified_user), not by Parse session — without this stamp a logged-in
// /me user lands there as a stranger: RSVP state missing, gated venues
// redacted, and re-RSVP'ing mints a duplicate identity.
function bridgeIdentityToOrgPage() {
  const u = Parse.User.current();
  const digits = ((u?.get("phone") as string) || "").replace(/\D/g, "");
  if (!digits) return;
  const name = (u?.get("full_name") as string) || (u?.get("first_name") as string) || "";
  try {
    setVerifiedUserCookie(name, digits);
    localStorage.setItem("leaf_follower_phone", digits);
  } catch { /* storage unavailable — org page falls back to its OTP flow */ }
}

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
  const addr = [plan.venueName, plan.venueAddress].filter(Boolean).join(" · ");
  const dir = directionsUrl(plan);
  const unread = unreadCount(plan);

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
          <div className="row-cal">{plan.calendarName}</div>
          <h2 className="modal-title">{plan.title}</h2>
          <div className="hero-ctx">{fullWhen(plan)}</div>
          {addr && <p className="modal-addr">{addr}</p>}
          {plan.description && <p className="modal-blurb">{plan.description}</p>}
          {status && (
            <div style={{ marginTop: 8 }}><span className={`status ${status.cls}`}>{status.text}</span></div>
          )}
          <div className="hero-actions flat">
            <AttendButtons plan={plan} onRsvp={onRsvp} />
            {dir && (
              <a className="btn ghost" href={dir} target="_blank" rel="noopener noreferrer">Getting there</a>
            )}
          </div>
          <Thread plan={plan} />
          <div className="modal-links">
            {canChat(plan) && (
              <Link href={`/chat/${plan.id}?from=me`} className="btn ghost chat">
                <ChatIcon />
                <span>Join plan chat{unread > 0 ? ` · ${unread}` : ""}</span>
              </Link>
            )}
            {plan.calendarShareId && (
              <Link
                href={`/org/${plan.calendarShareId}?plan=${plan.id}`}
                className="btn ghost"
                onClick={bridgeIdentityToOrgPage}
              >
                View on calendar ↗
              </Link>
            )}
          </div>
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
        <h1 className="greet-h" style={{ fontSize: 26, marginBottom: 6 }}>See your week</h1>
        <p className="otp-sub">
          {step === "phone" ? "Enter the phone on your Leaf account." : `Code sent to +1 ${phone}`}
        </p>
        {step === "phone" ? (
          <>
            <input className="otp-in" type="tel" value={phone} autoFocus placeholder="(555) 123-4567" onChange={(e) => setPhone(fmt(e.target.value))} />
            {err && <p className="otp-err">{err}</p>}
            <button className="btn primary wide" disabled={busy} onClick={sendCode}>{busy ? "Sending…" : "Send code"}</button>
          </>
        ) : (
          <>
            <input className="otp-in" inputMode="numeric" value={code} autoFocus placeholder="Code" onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            {err && <p className="otp-err">{err}</p>}
            <button className="btn primary wide" disabled={busy} onClick={submit}>{busy ? "Verifying…" : "See my plans"}</button>
            <button className="linkbtn" style={{ marginTop: 12 }} onClick={() => setStep("phone")}>Use a different number</button>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Scoped CSS (design tokens from the /me handoff spec) ------------------
const CSS = `
.leafme{
  --ink:#17150f; --body:#6f6a5f; --muted:#8b8578; --faint:#c9c4b8;
  --green:#1f6b45; --green-tint:#f4f8f4; --orange:#c2410c;
  --paper:#fff; --recessed:#faf9f7;
  --fill:#e3e0d8; --hatch:repeating-linear-gradient(135deg,#e8e4dc 0 6px,#f2efe9 6px 12px);
  --line:rgba(0,0,0,.07); --rule:rgba(0,0,0,.08); --card:rgba(0,0,0,.09);
  --edge:rgba(0,0,0,.15); --edge-2:rgba(0,0,0,.18); --dash:rgba(0,0,0,.22);
  --sans:var(--font-me-sans),-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --serif:var(--font-me-serif),Georgia,serif;
  --mono:var(--font-me-mono),ui-monospace,SFMono-Regular,monospace;
  background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.5;
  -webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden;
}
.leafme *{box-sizing:border-box}
.leafme h1,.leafme h2,.leafme h3,.leafme p{margin:0;overflow-wrap:anywhere}
.leafme button{font-family:var(--sans)}
.leafme a{color:inherit;text-decoration:none}
.leafme .page{max-width:1180px;margin:0 auto;width:100%}
.leafme .eyebrow{font-family:var(--mono);font-size:9.5px;font-weight:500;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted)}

/* ---- Top bar ---- */
.leafme .topbar{background:var(--paper);border-bottom:1px solid var(--rule)}
.leafme .topbar-in{display:flex;align-items:center;justify-content:space-between;padding:14px 22px}
.leafme .brand{display:flex;align-items:center}
.leafme .brand-logo{height:22px;width:auto;display:block}
.leafme .topbar-r{display:flex;align-items:center;gap:14px}
.leafme .pill{border:0;background:var(--ink);color:#fff;font-size:12px;font-weight:500;
  padding:9px 16px;border-radius:999px;cursor:pointer;transition:opacity 120ms ease}
.leafme .pill:hover{opacity:.92}
.leafme .who{display:flex;align-items:center;gap:8px}
.leafme .who span{font-size:12.5px;color:var(--body)}
.leafme .ava{width:26px;height:26px;border-radius:999px;background:var(--fill);
  display:grid;place-items:center;font-size:11px;font-weight:500;color:var(--body)}

/* ---- Two columns ---- */
.leafme .cols{display:flex;align-items:stretch;background:var(--paper)}
.leafme .colL{flex:1 1 0;min-width:0;padding:26px 30px 34px;border-right:1px solid var(--rule)}
.leafme .colL.solo{border-right:0}
.leafme .colR{width:440px;flex:none;padding:26px 26px 34px;background:var(--recessed)}

/* ---- Greeting ---- */
.leafme .greet-wx{font-size:11px;color:var(--muted);margin-bottom:6px}
.leafme .greet-h{font-family:var(--serif);font-size:30px;line-height:1.15;font-weight:400;color:var(--ink)}
.leafme .greet{margin-bottom:22px}

/* Post-create confirmation strip */
.leafme .created{display:flex;align-items:center;justify-content:space-between;gap:14px;
  border:1px solid rgba(31,107,69,.35);background:var(--green-tint);border-radius:10px;
  padding:12px 14px;margin-bottom:18px;font-size:12.5px;color:var(--ink)}
.leafme .created-link{font-size:12px;color:var(--green);text-decoration:underline;white-space:nowrap}

/* ---- Buttons ---- */
.leafme .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  font-size:11.5px;font-weight:500;padding:9px 14px;border-radius:8px;cursor:pointer;
  border:1px solid transparent;transition:background 120ms ease,border-color 120ms ease,opacity 120ms ease}
.leafme .btn.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
.leafme .btn.primary:hover{opacity:.92}
.leafme .btn.ghost{background:var(--paper);color:var(--ink);border-color:var(--edge)}
.leafme .btn.ghost:hover{border-color:rgba(0,0,0,.28);background:var(--recessed)}
.leafme .btn.text{background:none;border-color:transparent;color:var(--muted);
  font-weight:400;padding:9px 6px}
.leafme .btn.text:hover{color:var(--ink)}
.leafme .btn.sm{font-size:11px;padding:8px 12px;border-radius:7px}
.leafme .btn.wide{width:100%}
.leafme .btn:disabled{opacity:.55;cursor:default}
.leafme .btn:focus-visible,.leafme .pill:focus-visible,.leafme .row-btn:focus-visible,
.leafme .heart-toggle:focus-visible{outline:2px solid var(--green);outline-offset:2px}
.leafme .linkbtn{border:0;background:none;padding:0;cursor:pointer;font-size:12px;
  color:var(--body);text-decoration:underline}
.leafme .linkbtn:hover{color:var(--ink)}
.leafme .plan-link{display:inline;border:0;background:none;padding:0;margin:0;font:inherit;
  color:inherit;letter-spacing:inherit;text-align:left;cursor:pointer}
.leafme .plan-link:hover{color:var(--body)}

/* ---- Hero ---- */
.leafme .hero{border:1px solid rgba(0,0,0,.1);border-radius:14px;overflow:hidden;margin-bottom:22px}
.leafme .hero-top{display:flex;gap:14px;padding:14px;align-items:center}
.leafme .hero-text{min-width:0}
.leafme .hero-text .eyebrow{margin-bottom:5px;display:block}
.leafme .hero-title{font-family:var(--serif);font-size:21px;line-height:1.2;font-weight:400;
  color:var(--ink);margin-bottom:4px}
.leafme .hero-ctx{font-size:12.5px;color:var(--body)}
.leafme .hero-status{font-size:12px;color:var(--muted);margin-top:3px}
.leafme .hero-actions{display:flex;gap:8px;flex-wrap:wrap;padding:12px 14px;
  border-top:1px solid var(--rule);background:var(--recessed)}
.leafme .hero-actions.flat{padding:0;border-top:0;background:none;margin-top:18px}
.leafme .chat-label{white-space:nowrap}

/* ---- Tiles ---- */
.leafme .tile{border-radius:10px;display:grid;place-items:center;font-family:var(--serif);
  background:var(--hatch);color:#9a9488}
.leafme .tile.sage{background:#dce5dc;color:#2f5d43}
.leafme .tile.cream{background:#f5e6c8;color:#8a6a2f}
.leafme .tile.t-hero{width:92px;height:92px;flex:none;font-size:19px}
.leafme .tile.t-row{width:56px;height:42px;border-radius:6px;font-size:12px}
.leafme .tile.photo{overflow:hidden;background:#f2f2f0}
.leafme .tile.photo img{width:100%;height:100%;object-fit:cover;display:block}
.leafme .tile-wrap{position:relative;display:block}
.leafme .tile-wrap.t-hero,.leafme .tile-link.t-hero{flex:none}
.leafme .tile-wrap.t-row,.leafme .tile-link.t-row{flex:none}
.leafme .tile-link{display:block;padding:0;margin:0;border:0;background:none;cursor:pointer}

/* ---- Your plans ---- */
.leafme .sect{margin-bottom:22px}
.leafme .sect-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;
  margin-bottom:12px}
.leafme .sect-meta{font-size:11px;color:var(--muted)}
.leafme .sect-meta .new{color:var(--green)}
.leafme .rows{display:flex;flex-direction:column;gap:2px}
.leafme .row{display:flex;gap:14px;padding:12px 4px;border-top:1px solid var(--line)}
.leafme .row.last{border-bottom:1px solid var(--line)}
.leafme .row-date{width:38px;flex:none;text-align:center}
.leafme .row-date .d{font-family:var(--serif);font-size:18px;line-height:1;color:var(--ink)}
.leafme .row-date .m{font-family:var(--mono);font-size:8.5px;font-weight:500;letter-spacing:.09em;
  text-transform:uppercase;color:var(--muted);margin-top:3px}
.leafme .row-text{flex:1 1 auto;min-width:0}
.leafme .row-cal{font-family:var(--mono);font-size:9px;font-weight:500;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted)}
.leafme .hostmark{display:inline-flex;align-items:center;gap:5px;margin-left:8px;color:var(--green)}
.leafme .hostdot{width:5px;height:5px;border-radius:999px;background:var(--green)}
.leafme .row-title{font-family:var(--serif);font-size:15px;line-height:1.3;font-weight:400;color:var(--ink)}
.leafme .row-meta{font-size:11.5px;color:var(--muted)}
.leafme .row-act{align-self:center;flex:none}
.leafme .row-btn{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:500;
  padding:8px 13px;border-radius:7px;cursor:pointer;border:1px solid transparent;white-space:nowrap;
  transition:background 120ms ease,border-color 120ms ease,opacity 120ms ease}
.leafme .row-btn.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
.leafme .row-btn.primary:hover{opacity:.92}
.leafme .row-btn.ghost{background:var(--paper);color:var(--ink);border-color:var(--edge)}
.leafme .row-btn.ghost:hover{border-color:rgba(0,0,0,.28);background:var(--recessed)}
.leafme .row-btn.host{background:var(--green);color:#fff;border-color:var(--green)}
.leafme .row-btn.host:hover{background:#1a5a3a}
.leafme .row-btn:disabled{opacity:.55;cursor:default}
.leafme .status{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:9px;
  letter-spacing:.08em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
.leafme .status::before{content:"";width:5px;height:5px;border-radius:999px;background:var(--muted)}
.leafme .status.host::before{background:var(--green)}
.leafme .status.wait::before{background:#d9a441}
.leafme .showmore{border:0;background:none;padding:0;margin-top:14px;cursor:pointer;
  font-size:12px;color:var(--body);text-decoration:underline}
.leafme .showmore:hover{color:var(--ink)}

/* ---- Prompt boxes ---- */
.leafme .prompt-box{display:flex;align-items:center;gap:18px;border:1px dashed var(--dash);
  background:var(--recessed);border-radius:12px;padding:18px 20px;margin-top:22px}
.leafme .prompt-box.tight{margin-top:12px}
.leafme .prompt-body{flex:1 1 auto;min-width:0}
.leafme .prompt-h{font-family:var(--serif);font-size:19px;line-height:1.25;color:var(--ink)}
.leafme .prompt-h.sm{font-size:17px}
.leafme .prompt-p{font-size:12px;line-height:1.5;color:var(--body);margin-top:4px}
.leafme .prompt-box .btn{flex:none;font-size:12px;padding:11px 17px}

/* ---- Right rail ---- */
.leafme .rail{margin-bottom:24px}
.leafme .rail .eyebrow{display:block;margin-bottom:10px}
.leafme .rail-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.leafme .rail-head .eyebrow{margin-bottom:3px}
.leafme .rail-sub{font-size:10.5px;color:var(--muted);margin-bottom:9px}
.leafme .hostcards{display:flex;flex-direction:column;gap:8px}
.leafme .hostcard{display:flex;gap:11px;align-items:center;background:var(--paper);
  border:1px solid var(--card);border-radius:10px;padding:10px}
.leafme .hostthumb{width:44px;height:44px;flex:none;border-radius:7px;object-fit:cover;display:block}
.leafme .hostthumb.ph{background:var(--hatch)}
.leafme .hostbody{flex:1 1 auto;min-width:0}
.leafme .hostcard-title{font-family:var(--serif);font-size:13.5px;line-height:1.25;font-weight:400;
  color:var(--ink);margin-top:2px}
.leafme .hostcard-when{font-size:11px;color:var(--muted)}
.leafme .hostcard-meta{display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap}
.leafme .urgent{font-size:10px;font-weight:500;color:var(--orange)}
.leafme .interest{font-size:10.5px;color:var(--body)}
.leafme .interest.on{color:var(--green)}
.leafme .hostact{flex:none;display:flex;align-items:center;gap:7px}
.leafme .hostbtn{flex:none;border:0;background:var(--green);color:#fff;font-size:11px;font-weight:500;
  padding:8px 10px;border-radius:7px;cursor:pointer}
.leafme .hostbtn:hover{background:#1a5a3a}

.leafme .places{background:var(--paper);border:1px solid var(--card);border-radius:10px;overflow:hidden}
.leafme .place{display:flex;align-items:center;gap:10px;padding:9px 11px}
.leafme .place + .place{border-top:1px solid var(--line)}
.leafme .place.on{background:var(--green-tint)}
.leafme .place-text{flex:1 1 auto;min-width:0}
.leafme .place-n{font-size:12.5px;color:var(--ink)}
.leafme .place-s{font-size:10.5px;color:var(--muted)}
.leafme .place.on .place-s{color:var(--body)}
.leafme .heart-toggle{flex:none;width:28px;height:28px;display:flex;align-items:center;
  justify-content:center;border:1px solid var(--edge-2);background:var(--paper);color:var(--ink);
  border-radius:999px;cursor:pointer;padding:0;transition:background 120ms ease}
.leafme .heart-toggle.on{background:var(--green);border-color:var(--green);color:#fff}
.leafme .heart-toggle:disabled{cursor:default}

.leafme .cals{display:flex;flex-direction:column;gap:1px}
.leafme .cal-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line)}
.leafme .cal-row:last-child{border-bottom:1px solid var(--line)}
.leafme .cal-row:hover{background:rgba(0,0,0,.02)}
.leafme .cal-ava{width:24px;height:24px;flex:none;border-radius:5px;background:transparent;
  object-fit:contain;display:grid;place-items:center;font-size:11px;font-weight:600;color:var(--body)}
.leafme .cal-ava.ph{background:var(--fill)}
.leafme .cal-body{flex:1 1 auto;min-width:0}
.leafme .cal-n{font-size:12.5px;color:var(--ink)}
.leafme .cal-s{font-size:10.5px;color:var(--muted)}
.leafme .cal-s.urgent{color:var(--orange);font-size:10.5px;font-weight:400}
.leafme .cal-cta{font-size:11px;color:var(--body);white-space:nowrap}

.leafme .texts{margin-top:22px;padding:13px 14px;background:var(--paper);border:1px solid var(--card);
  border-radius:10px;display:flex;align-items:center;gap:12px}
.leafme .texts p{flex:1 1 auto;font-size:11.5px;line-height:1.45;color:var(--body)}

/* ---- Modals ---- */
.leafme .modal-overlay{position:fixed;inset:0;z-index:60;background:rgba(23,21,15,.6);
  display:flex;align-items:center;justify-content:center;padding:16px}
.leafme .modal-card{position:relative;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;
  background:var(--paper);border-radius:14px;animation:lmmodal .2s ease}
@keyframes lmmodal{from{transform:translateY(16px);opacity:.5}to{transform:none;opacity:1}}
.leafme .modal-x{position:absolute;top:12px;right:12px;z-index:2;width:32px;height:32px;border:0;
  border-radius:999px;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(0,0,0,.14);
  font-size:20px;line-height:1;cursor:pointer;color:var(--ink)}
.leafme .modal-img{width:100%;aspect-ratio:16/9;overflow:hidden;background:#f2f2f0;border-radius:14px 14px 0 0}
.leafme .modal-img img{width:100%;height:100%;object-fit:cover;display:block}
.leafme .modal-body{padding:22px 22px 28px}
.leafme .modal-title{font-family:var(--serif);font-size:26px;line-height:1.15;font-weight:400;
  color:var(--ink);margin:4px 0 6px}
.leafme .modal-addr{font-size:12.5px;color:var(--body);margin-top:6px}
.leafme .modal-blurb{font-size:13px;line-height:1.55;color:var(--body);margin-top:8px}
.leafme .modal-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.leafme .probe-pop{max-width:420px}
.leafme .probe-thanks{font-family:var(--serif);font-style:italic;font-size:18px;color:var(--green);
  padding:24px 0;text-align:center}

/* ---- Thread ---- */
.leafme .thread{margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}
.leafme .msg{display:flex;gap:11px;padding:9px 0}
.leafme .msg:first-child{padding-top:0}
.leafme .mava{width:26px;height:26px;border-radius:999px;flex-shrink:0;background:#dce5dc;
  display:grid;place-items:center;font-family:var(--serif);font-size:12px;color:#2f5d43;position:relative}
.leafme .mava.unread::after{content:"";position:absolute;top:-1px;right:-1px;width:7px;height:7px;
  border-radius:999px;background:var(--green);border:1.5px solid var(--paper)}
.leafme .msg-b .t{font-size:11px;font-weight:500;color:var(--body);margin-bottom:3px}
.leafme .msg-b .p{font-size:13px;line-height:1.45;color:var(--ink)}
.leafme .msg-b .ago{font-size:11px;color:var(--muted);margin-top:3px}

/* ---- Loading / OTP ---- */
.leafme .lm-center{min-height:100vh;display:grid;place-items:center;padding:0 28px}
.leafme .lm-muted{font-size:13px;color:var(--muted)}
.leafme .lm-spin{width:22px;height:22px;border-radius:999px;border:2px solid var(--rule);
  border-top-color:var(--muted);animation:lmspin .8s linear infinite;display:inline-block}
@keyframes lmspin{to{transform:rotate(360deg)}}
.leafme .otp{min-height:100vh;display:grid;place-items:center;padding:0 24px}
.leafme .otp-card{width:100%;max-width:360px}
.leafme .otp-sub{font-size:13px;color:var(--body);margin-bottom:18px}
.leafme .otp-in{width:100%;border:1px solid var(--edge-2);border-radius:8px;padding:12px;
  font-family:var(--sans);font-size:16px;margin-bottom:12px}
.leafme .otp-in:focus{outline:2px solid var(--green);outline-offset:1px}
.leafme .otp-err{font-size:12px;color:var(--orange);margin-bottom:10px}

/* ==========================================================================
   Mobile (4a) — one scroll, no map, actions under the text, sticky CTA.
   ========================================================================== */
@media(max-width:1023px){
  .leafme .cols{flex-direction:column}
  .leafme .colL{border-right:0;padding:18px 22px 0}
  .leafme .colR{width:100%;padding:8px 22px 32px;background:var(--paper)}
  .leafme .colL.solo{padding-bottom:32px}
}
@media(max-width:760px){
  .leafme .topbar-in{padding:8px 22px 12px}
  .leafme .brand-logo{height:20px}
  .leafme .pill{padding:9px 14px;font-size:11.5px}
  .leafme .who span{display:none}
  .leafme .ava{width:30px;height:30px;font-size:11.5px}
  .leafme .greet-wx{font-size:10.5px}
  .leafme .greet-h{font-size:24px}
  .leafme .greet{margin-bottom:18px}

  /* Hero: full-bleed photo on top, thumb-sized actions in one row */
  .leafme .hero-top{display:block;padding:0}
  .leafme .hero-top > .tile-link,.leafme .hero-top > .tile-wrap{display:block;width:100%}
  .leafme .tile.t-hero{width:100%;height:120px;border-radius:0;font-size:22px}
  .leafme .hero-text{padding:14px 14px 0}
  .leafme .hero-title{font-size:22px;line-height:1.15;margin:5px 0 4px}
  .leafme .hero-ctx{font-size:12px}
  .leafme .hero-status{font-size:11.5px}
  .leafme .hero-actions{padding:13px 14px 14px;border-top:0;background:none;gap:8px;flex-wrap:wrap}
  .leafme .hero-actions .btn{flex:1 1 0;padding:14px 0;border-radius:9px;font-size:12.5px}
  .leafme .hero-actions .btn.chat{flex:none;width:46px;padding:14px 0}
  .leafme .hero-actions .chat-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
  .leafme .hero-actions .btn.text{flex-basis:100%;padding:10px 0 0;text-align:left;justify-content:flex-start}
  .leafme .hero-actions.flat{flex-wrap:wrap}
  .leafme .hero-actions.flat .btn{flex:1 1 40%}

  /* Rows: no thumbnail at this width; the action sits under the text */
  .leafme .row{gap:12px;padding:13px 0;flex-wrap:wrap}
  .leafme .row .tile-link,.leafme .row .tile-wrap{display:none}
  .leafme .row-date{width:34px}
  .leafme .row-date .d{font-size:17px}
  .leafme .row-date .m{font-size:8px}
  .leafme .row-cal{font-size:8.5px}
  .leafme .row-title{font-size:14.5px}
  .leafme .row-meta{font-size:11px}
  .leafme .row-act{align-self:stretch;flex-basis:calc(100% - 46px);order:3;margin-left:46px;margin-top:-2px}
  .leafme .row-btn{margin-top:9px;font-size:11.5px;padding:12px 16px;border-radius:8px}
  .leafme .row-text{flex-basis:calc(100% - 46px)}

  /* Prompt boxes stack, buttons go full width */
  .leafme .prompt-box{display:block;padding:16px 16px 18px;margin-top:20px}
  .leafme .prompt-box.tight{display:flex;align-items:center;gap:12px;padding:15px 16px;margin-top:10px}
  .leafme .prompt-h{font-size:18px}
  .leafme .prompt-h.sm{font-size:16px}
  .leafme .prompt-p{font-size:11.5px}
  .leafme .prompt-p.sm{font-size:11px;line-height:1.45}
  .leafme .prompt-box > .btn{width:100%;margin-top:13px;padding:14px 0;border-radius:9px;font-size:12.5px}
  .leafme .prompt-box.tight > .btn{width:auto;margin-top:0;padding:12px 15px;border-radius:8px}

  /* Rail: full-width rows, 44px hit targets */
  .leafme .rail{margin-bottom:24px}
  .leafme .hostcard{border-radius:11px;padding:11px;gap:11px}
  .leafme .hostthumb{width:48px;height:48px;border-radius:8px}
  .leafme .hostcard-title{font-size:14px}
  .leafme .hostbtn{padding:12px;font-size:11.5px;border-radius:8px}
  .leafme .hostact{gap:8px}
  .leafme .places{border-radius:11px}
  .leafme .place{padding:11px 12px}
  .leafme .place-n{font-size:13.5px}
  .leafme .place-s{font-size:11px}
  .leafme .heart-toggle{width:44px;height:44px}
  .leafme .hostact .heart-toggle{width:40px;height:40px}
  .leafme .cal-row{padding:11px 0;gap:11px}
  .leafme .cal-ava{width:28px;height:28px;border-radius:6px}
  .leafme .cal-n{font-size:13px}
  .leafme .cal-cta{padding:12px 0 12px 12px}
  .leafme .texts{background:var(--recessed);margin-top:20px}
  .leafme .texts p{font-size:11px}
  .leafme .texts .btn{padding:12px 14px}

  /* Modals become bottom sheets */
  .leafme .modal-overlay{align-items:flex-end;padding:0}
  .leafme .modal-card{max-width:none;border-radius:16px 16px 0 0;max-height:88vh;max-height:88dvh}
  .leafme .modal-img{border-radius:16px 16px 0 0}
  .leafme .modal-body{padding:18px 20px calc(24px + env(safe-area-inset-bottom))}
  .leafme .probe-pop{border-radius:20px 20px 0 0}
  .leafme .probe-pop .modal-img{aspect-ratio:5/2;max-height:160px;border-radius:20px 20px 0 0}
  .leafme .modal-links .btn{flex:1 1 40%;padding:13px 12px}
}
@media(prefers-reduced-motion:reduce){.leafme *{transition:none!important;animation:none!important}}
`;


