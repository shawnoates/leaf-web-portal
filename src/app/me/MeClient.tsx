"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";

// ============================================================================
// Attendee dashboard (/me). Read-mostly. Answers one question — "where am I
// going next, and am I still going?" It is the live truth (re-fetchable), not
// a frozen digest. Built to the leaf-attendee-dashboard mockup: Newsreader
// serif headings, sage/cream tiles, ink rectangular buttons, hairline rules.
// ============================================================================

// ---- Types (mirror the getMeDashboard payload) -----------------------------
type HostState = "waiting_on_host" | "human_host" | "leaf_arranging" | "leaf_hosted";
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
  rsvpState: RsvpState;
  attendeeCount: number;
  weather: Weather | null;
  messages: PlanMessage[];
}
interface Dashboard {
  person: { firstName: string; ownsCalendars: boolean; pendingReviewCount: number };
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
function PlanTile({ plan, index, sm }: { plan: Plan; index: number; sm?: boolean }) {
  if (plan.image) {
    return (
      <div className={`tile photo ${sm ? "sm" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={plan.image} alt="" />
      </div>
    );
  }
  const t = tileFor(plan, index);
  return <div className={`tile ${t.tone} ${sm ? "sm" : ""}`}>{t.word}</div>;
}

function statusFor(plan: Plan): { cls: string; text: string } | null {
  if (plan.hostState === "leaf_hosted" && plan.hostPersona) {
    return { cls: "host", text: `Hosted by Leaf · ${plan.hostPersona.name}` };
  }
  if (plan.hostState === "leaf_hosted") return { cls: "host", text: "Hosted by Leaf" };
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

  const onMessage = useCallback((planId: string, m: PlanMessage) => {
    patchPlan(planId, (p) => ({ ...p, messages: [...p.messages, m] }));
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
    body = <DashboardView data={data} onRsvp={onRsvp} onMessage={onMessage} />;
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
  data, onRsvp, onMessage,
}: {
  data: Dashboard;
  onRsvp: (id: string, s: RsvpState) => void;
  onMessage: (id: string, m: PlanMessage) => void;
}) {
  const hero = data.nextPlan;
  const spine = data.plans.slice(1); // hero is plans[0]
  const calCount = new Set(data.plans.map((p) => p.calendarId).filter(Boolean)).size;

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
        {hero ? (
          <Hero plan={hero} onRsvp={onRsvp} onMessage={onMessage} />
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
                <Stop key={plan.id} plan={plan} index={i + 1} onRsvp={onRsvp} onMessage={onMessage} />
              ))}
            </div>
          </section>
        )}

        {/* Ask XOR owner strip — never both */}
        {data.person.ownsCalendars ? (
          <OwnerStrip count={data.person.pendingReviewCount} />
        ) : (
          data.ask && <Ask ask={data.ask} />
        )}

        <footer className="wrap foot">
          <p>
            One text a week, Sunday morning, with everything on this page. No text for every
            plan added to a calendar you follow.{" "}
            <Link href="/unsubscribe">Change how often</Link> · <Link href="/unsubscribe">Stop texts</Link>
          </p>
        </footer>
      </main>
    </>
  );
}

// ---- Hero ------------------------------------------------------------------
function Hero({
  plan, onRsvp, onMessage,
}: {
  plan: Plan;
  onRsvp: (id: string, s: RsvpState) => void;
  onMessage: (id: string, m: PlanMessage) => void;
}) {
  const addr = [plan.venueName, plan.venueAddress].filter(Boolean).join(" · ");
  return (
    <section className="wrap hero">
      <div className="eyebrow">Next up</div>
      <div className="hero-grid">
        <div>
          <div className="when">{heroWhen(plan)}</div>
          <div className="cal">{plan.calendarName}</div>
          <h1>{plan.title}</h1>
          {addr && <p className="addr">{addr}</p>}
          {plan.description && <p className="blurb">{plan.description}</p>}
          <div className="row">
            <AttendButtons plan={plan} onRsvp={onRsvp} />
            {plan.weather && (
              <span className="wx">🌤 <b>{plan.weather.temp}°</b> {plan.weather.text}</span>
            )}
          </div>
          <p className="note">Weather shows only when it might change your mind — outdoor plans, inside the forecast window.</p>
          <Thread plan={plan} onMessage={onMessage} hero />
        </div>
        <PlanTile plan={plan} index={0} />
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
  plan, index, onRsvp, onMessage,
}: {
  plan: Plan;
  index: number;
  onRsvp: (id: string, s: RsvpState) => void;
  onMessage: (id: string, m: PlanMessage) => void;
}) {
  const tile = tileFor(plan, index);
  const status = statusFor(plan);
  const going = plan.rsvpState === "going";
  const meta = [weekday(plan.date), timeLabel(plan), plan.venueName || plan.venueAddress].filter(Boolean).join(" · ");
  const hostHref = plan.calendarShareId ? `/org/${plan.calendarShareId}?host=${encodeURIComponent(plan.id)}` : `/p/${plan.id}`;
  return (
    <article className="stop">
      <div className="date"><div className="d">{dayNum(plan.date)}</div><div className="m">{monthAbbr(plan.date)}</div></div>
      <span className={`dot ${going ? "on" : ""}`} />
      <div className="stop-card">
        <div className={`tile sm ${tile.tone}`}>{tile.word}</div>
        <div>
          <div className="cal">{plan.calendarName}</div>
          <h3>{plan.title}</h3>
          <p className="meta">{meta}</p>
          {status && <span className={`status ${status.cls}`}>{status.text}</span>}
          {plan.hostState === "waiting_on_host" && (
            <div style={{ marginTop: 9 }}><Link className="btn ghost" href={hostHref}>Host this ↗</Link></div>
          )}
          {plan.rsvpState !== "going" && plan.hostState !== "waiting_on_host" && (
            <div style={{ marginTop: 9 }}><AttendButtons plan={plan} onRsvp={onRsvp} compact /></div>
          )}
          <Thread plan={plan} onMessage={onMessage} />
        </div>
      </div>
    </article>
  );
}

// ---- Attend buttons --------------------------------------------------------
function AttendButtons({
  plan, onRsvp, compact,
}: {
  plan: Plan;
  onRsvp: (id: string, s: RsvpState) => void;
  compact?: boolean;
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

  return (
    <span className="attend">
      <button
        className={`btn ${going ? "" : ""}`}
        aria-pressed={going}
        disabled={busy}
        onClick={() => set("going")}
      >
        {going ? "✓ Going" : compact ? "I'm going" : "I'm going"}
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
function Thread({
  plan, onMessage, hero,
}: {
  plan: Plan;
  onMessage: (id: string, m: PlanMessage) => void;
  hero?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const canReply = plan.rsvpState === "going";

  if (plan.messages.length === 0 && !canReply) return null;

  async function send() {
    const b = text.trim();
    if (!b || busy) return;
    setBusy(true);
    try {
      await Parse.Cloud.run("postPlanMessage", { eventGroupId: plan.id, body: b });
      onMessage(plan.id, {
        id: null, authorName: "You", authorRole: "self", body: b,
        sentAt: new Date().toISOString(), unread: false,
      });
      setText(""); setOpen(false);
    } catch { /* keep draft */ } finally { setBusy(false); }
  }

  return (
    <div className={`thread ${hero ? "hero-thread" : ""}`}>
      {plan.messages.map((m, i) => (
        <div className="msg" key={m.id || i}>
          <div className={`mava ${m.unread ? "unread" : ""}`}>{initial(m.authorName)}</div>
          <div className="msg-b">
            <div className="t">{m.authorName}{m.authorRole === "leaf" ? " · Leaf concierge" : plan.calendarName ? ` · ${plan.calendarName}` : ""}</div>
            <p className="p">{m.body}</p>
            {m.sentAt && <div className="ago">{ago(m.sentAt)}</div>}
          </div>
        </div>
      ))}
      {canReply && !open && (
        <button className="reply" onClick={() => setOpen(true)}>Reply</button>
      )}
      {canReply && open && (
        <div className="composer">
          <input
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Reply to the plan…"
          />
          <button className="btn" disabled={busy || !text.trim()} onClick={send}>Send</button>
        </div>
      )}
    </div>
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
    <section className="wrap sect">
      <div className="eyebrow" style={{ marginBottom: 18 }}>Start your own</div>
      {inner}
    </section>
  );
}

// ---- Owner strip -----------------------------------------------------------
function OwnerStrip({ count }: { count: number }) {
  return (
    <section className="wrap sect">
      <div className="eyebrow" style={{ marginBottom: 18 }}>You also run a calendar</div>
      <div className="owner">
        <p>
          {count > 0 ? (
            <><b>{count} plan{count === 1 ? "" : "s"} need your review</b></>
          ) : (
            <><b>Manage your calendars</b> — review plans, RSVPs, and hosting.</>
          )}
        </p>
        <Link className="btn ghost" href="/dashboard">Open manage ↗</Link>
      </div>
    </section>
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
  --sans:var(--font-me-sans),-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --serif:var(--font-me-serif),Georgia,serif;
  background:var(--paper); color:var(--ink); font-family:var(--sans);
  -webkit-font-smoothing:antialiased; line-height:1.5; min-height:100vh;
}
.leafme *{box-sizing:border-box}
.leafme .wrap{max-width:940px;margin:0 auto;padding:0 28px}
.leafme .eyebrow{font-size:10px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-3)}
.leafme .bar{border-bottom:1px solid var(--rule)}
.leafme .bar-in{display:flex;align-items:center;justify-content:space-between;height:64px}
.leafme .leaflogo{height:24px;width:auto;display:block}
.leafme .who{display:flex;align-items:center;gap:9px}
.leafme .who span{font-size:12px;color:var(--ink-2)}
.leafme .ava{width:28px;height:28px;border-radius:50%;background:#d8d4cc;display:grid;place-items:center;font-size:11px;font-weight:600;color:var(--ink-2)}
.leafme .hero{padding:56px 0 44px;border-bottom:1px solid var(--rule)}
.leafme .hero .eyebrow{margin-bottom:18px}
.leafme .hero-grid{display:grid;grid-template-columns:1fr 300px;gap:44px;align-items:start}
.leafme .when{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--ink-2);margin-bottom:6px}
.leafme .hero h1{font-family:var(--serif);font-size:40px;line-height:1.08;font-weight:500;letter-spacing:-.02em;margin-bottom:12px}
.leafme .addr{font-size:13px;color:var(--ink-2);margin-bottom:4px}
.leafme .blurb{font-size:13px;color:var(--ink-3);max-width:44ch;margin-bottom:22px}
.leafme .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.leafme .attend{display:inline-flex;gap:10px}
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
.leafme .sect{padding:44px 0;border-bottom:1px solid var(--rule)}
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
.leafme .status{display:inline-flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2)}
.leafme .status::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--ink-3)}
.leafme .status.host::before{background:var(--green)}
.leafme .status.wait::before{background:#d9a441}
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
.leafme .composer{display:flex;gap:8px;margin-top:10px}
.leafme .composer input{flex:1;border:1px solid var(--rule);border-radius:3px;padding:9px 12px;font-family:var(--sans);font-size:13px;color:var(--ink)}
.leafme .composer input:focus{outline:2px solid var(--green);outline-offset:1px}
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
.leafme .foot{padding:36px 0 56px}
.leafme .foot p{font-size:12px;color:var(--ink-3);max-width:52ch}
.leafme .foot a{color:var(--ink-2)}
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
@media(max-width:760px){
  .leafme .wrap{padding:0 20px}
  .leafme .hero-grid{grid-template-columns:1fr;gap:24px}
  .leafme .hero{padding:36px 0 32px}
  .leafme .hero h1{font-size:30px}
  .leafme .hero-grid .tile{max-width:280px}
  .leafme .spine{padding-left:0}
  .leafme .spine::before{display:none}
  .leafme .date{position:static;width:auto;text-align:left;display:flex;align-items:baseline;gap:7px;margin-bottom:8px}
  .leafme .date .m{margin-top:0}
  .leafme .dot{display:none}
  .leafme .stop-card{grid-template-columns:88px 1fr;gap:14px}
  .leafme .owner{flex-direction:column;align-items:flex-start}
}
@media(prefers-reduced-motion:reduce){.leafme *{transition:none!important;animation:none!important}}
`;
