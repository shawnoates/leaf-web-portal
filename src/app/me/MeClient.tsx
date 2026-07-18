"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Loader2,
  X,
  ShieldCheck,
  ArrowUpRight,
  CloudSun,
  Send,
} from "lucide-react";
import Parse from "@/lib/parse-client";

// ============================================================================
// Attendee dashboard (/me). Read-mostly. Answers one question — "where am I
// going next, and am I still going?" It is the live truth (re-fetchable), not
// a frozen digest. Built to Leaf's existing visual vocabulary: uppercase
// micro-labels, sage/cream tiles, black pill actions, hairline rules.
// ============================================================================

// ---- Types (mirror the getMeDashboard payload, spec §A8) -------------------
type HostState = "waiting_on_host" | "human_host" | "leaf_arranging" | "leaf_hosted";
type RsvpState = "going" | "not_going" | "no_response";

interface Persona {
  id: string;
  name: string;
  avatarUrl: string | null;
}
interface Weather {
  temp: string;
  icon: string;
  text: string;
}
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
  date: string | null;
  time: string | null;
  venueName: string | null;
  venueAddress: string | null;
  calendarId: string | null;
  calendarName: string;
  calendarShareId: string | null;
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

// ---- Date helpers ----------------------------------------------------------
function relativeDay(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round(
    (startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000,
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function dayNum(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function timeLabel(plan: Plan): string {
  if (plan.time) return plan.time;
  if (!plan.date) return "";
  return new Date(plan.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ============================================================================
export default function MeClient() {
  const [authState, setAuthState] = useState<AuthState>("resolving");
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string>("");
  const fetchedRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = (await Parse.Cloud.run("getMeDashboard", {})) as Dashboard;
      setData(res);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your plans.");
    }
  }, []);

  // Auth resolution order (spec §W2): token → become → strip token → else
  // existing session → else OTP.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = new URLSearchParams(window.location.search).get("t");
        const uid = new URLSearchParams(window.location.search).get("u");
        if (token && uid) {
          try {
            const result = (await Parse.Cloud.run("getDashboardSession", {
              userId: uid,
              token,
            })) as { sessionToken?: string };
            const st = result?.sessionToken;
            if (st && st.startsWith("r:")) {
              await Parse.User.become(st);
            }
          } catch {
            // fall through to existing-session / OTP resolution
          }
          // Strip the token so a refresh / shared screenshot can't replay it.
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
    return () => {
      cancelled = true;
    };
  }, [fetchDashboard]);

  const onRsvpChange = useCallback((planId: string, next: RsvpState) => {
    setData((prev) => {
      if (!prev) return prev;
      const apply = (p: Plan): Plan => (p.id === planId ? { ...p, rsvpState: next } : p);
      return {
        ...prev,
        nextPlan: prev.nextPlan ? apply(prev.nextPlan) : null,
        plans: prev.plans.map(apply),
      };
    });
  }, []);

  const onMessagePosted = useCallback((planId: string, msg: PlanMessage) => {
    setData((prev) => {
      if (!prev) return prev;
      const apply = (p: Plan): Plan =>
        p.id === planId ? { ...p, messages: [...p.messages, msg] } : p;
      return {
        ...prev,
        nextPlan: prev.nextPlan ? apply(prev.nextPlan) : null,
        plans: prev.plans.map(apply),
      };
    });
  }, []);

  if (authState === "resolving") return <FullScreen><Spinner /></FullScreen>;
  if (authState === "error")
    return (
      <FullScreen>
        <p className="text-sm text-zinc-500">Something went wrong. Tap your link again.</p>
      </FullScreen>
    );
  if (authState === "needs-otp")
    return (
      <OtpModal
        onVerified={async () => {
          fetchedRef.current = true;
          await fetchDashboard();
          setAuthState("authed");
        }}
      />
    );

  if (!data && !loadError) return <FullScreen><Spinner /></FullScreen>;
  if (loadError)
    return (
      <FullScreen>
        <p className="text-sm text-zinc-500">{loadError}</p>
      </FullScreen>
    );

  const d = data!;
  const hasPlans = d.plans.length > 0;
  const showOwnerStrip = d.person.ownsCalendars && d.person.pendingReviewCount > 0;

  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <div className="max-w-2xl mx-auto px-5 py-10">
        {/* Masthead */}
        <div className="flex items-center justify-between mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/leaf-logo-black.png" alt="Leaf" className="h-7" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            {d.person.firstName ? `${d.person.firstName}’s week` : "Your week"}
          </span>
        </div>

        {/* 1. Hero — the next plan (or an honest empty state) */}
        {d.nextPlan ? (
          <Hero plan={d.nextPlan} onRsvpChange={onRsvpChange} onMessagePosted={onMessagePosted} />
        ) : (
          <EmptyState ask={d.ask} owner={d.person.ownsCalendars} />
        )}

        {/* 2. The spine — chronology as structure (only when >1 plan) */}
        {d.plans.length > 1 && (
          <Spine
            plans={d.plans}
            unreadMessageCount={d.unreadMessageCount}
            onRsvpChange={onRsvpChange}
            onMessagePosted={onMessagePosted}
          />
        )}

        {/* 3. The ask OR the owner strip — never both, after the spine */}
        {hasPlans &&
          (showOwnerStrip ? (
            <OwnerStrip count={d.person.pendingReviewCount} />
          ) : (
            d.ask && <TheAsk ask={d.ask} plans={d.plans} />
          ))}

        {/* 4. Footer — the SMS contract */}
        <MeFooter userId={Parse.User.current()?.id ?? null} />
      </div>
    </div>
  );
}

// ---- Hero ------------------------------------------------------------------
function Hero({
  plan,
  onRsvpChange,
  onMessagePosted,
}: {
  plan: Plan;
  onRsvpChange: (id: string, s: RsvpState) => void;
  onMessagePosted: (id: string, m: PlanMessage) => void;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50/60 to-white p-6 mb-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest font-bold text-emerald-700">
          {relativeDay(plan.date)}
          {timeLabel(plan) ? ` · ${timeLabel(plan)}` : ""}
        </span>
        {plan.weather && <WeatherChip weather={plan.weather} />}
      </div>
      <h1 className="text-2xl font-light tracking-tight text-zinc-900 mb-1">{plan.title}</h1>
      <VenueLine plan={plan} />
      <div className="mt-3">
        <HostStateBadge plan={plan} />
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4">
        <span className="text-xs text-zinc-500">
          {plan.attendeeCount > 0
            ? `${plan.attendeeCount} going`
            : "Be the first to RSVP"}
        </span>
        <RsvpToggle plan={plan} onRsvpChange={onRsvpChange} />
      </div>
      {plan.hostState === "waiting_on_host" && <HostThis plan={plan} />}
      <MessageThread plan={plan} onMessagePosted={onMessagePosted} />
    </section>
  );
}

// ---- Spine -----------------------------------------------------------------
function Spine({
  plans,
  unreadMessageCount,
  onRsvpChange,
  onMessagePosted,
}: {
  plans: Plan[];
  unreadMessageCount: number;
  onRsvpChange: (id: string, s: RsvpState) => void;
  onMessagePosted: (id: string, m: PlanMessage) => void;
}) {
  // Skip the hero plan (index 0) — it's rendered above.
  const rest = plans.slice(1);
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Coming up</h2>
        {unreadMessageCount > 0 && (
          <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-700 font-bold">
            {unreadMessageCount} new message{unreadMessageCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div>
        {rest.map((plan, i) => (
          <SpineStop
            key={plan.id}
            plan={plan}
            last={i === rest.length - 1}
            onRsvpChange={onRsvpChange}
            onMessagePosted={onMessagePosted}
          />
        ))}
      </div>
    </section>
  );
}

function SpineStop({
  plan,
  last,
  onRsvpChange,
  onMessagePosted,
}: {
  plan: Plan;
  last: boolean;
  onRsvpChange: (id: string, s: RsvpState) => void;
  onMessagePosted: (id: string, m: PlanMessage) => void;
}) {
  const going = plan.rsvpState === "going";
  return (
    <div className="flex gap-4">
      {/* Left rail: date + dot encoding RSVP state */}
      <div className="flex flex-col items-center w-14 shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 text-center leading-tight pt-1">
          {dayNum(plan.date)}
        </span>
        <span
          className={
            "mt-2 w-3 h-3 rounded-full " +
            (going ? "bg-emerald-600" : "border-2 border-zinc-300 bg-white")
          }
          aria-label={going ? "Going" : "No response yet"}
        />
        {!last && <span className="flex-1 w-px bg-zinc-100 mt-1" />}
      </div>
      {/* Card */}
      <div className={"flex-1 pb-8 " + (last ? "" : "")}>
        <span className="text-xs uppercase tracking-widest font-bold text-emerald-700">
          {relativeDay(plan.date)}
          {timeLabel(plan) ? ` · ${timeLabel(plan)}` : ""}
        </span>
        <div className="flex items-start justify-between gap-3 mt-1">
          <div className="min-w-0">
            <h3 className="text-lg font-normal text-zinc-900">{plan.title}</h3>
            <VenueLine plan={plan} />
            <div className="mt-2">
              <HostStateBadge plan={plan} />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {going
                ? `You're going${plan.attendeeCount > 1 ? ` · ${plan.attendeeCount - 1} others` : ""}`
                : `${plan.attendeeCount} going`}
            </p>
          </div>
          <RsvpToggle plan={plan} onRsvpChange={onRsvpChange} />
        </div>
        {plan.hostState === "waiting_on_host" && <HostThis plan={plan} />}
        <MessageThread plan={plan} onMessagePosted={onMessagePosted} />
      </div>
    </div>
  );
}

// ---- Shared plan pieces ----------------------------------------------------
function VenueLine({ plan }: { plan: Plan }) {
  if (!plan.venueName && !plan.venueAddress) {
    return <p className="text-sm text-zinc-400 mt-0.5">Venue shared once you RSVP</p>;
  }
  return (
    <p className="text-sm text-zinc-600 mt-0.5 flex items-center gap-1.5">
      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
      <span className="truncate">
        {plan.venueName}
        {plan.venueAddress ? ` · ${plan.venueAddress}` : ""}
      </span>
    </p>
  );
}

function HostStateBadge({ plan }: { plan: Plan }) {
  // Persona leak guard: name/avatar ONLY on leaf_hosted. Never trust
  // hostPersona presence alone — gate on hostState here.
  if (plan.hostState === "leaf_hosted" && plan.hostPersona) {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
        {plan.hostPersona.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={plan.hostPersona.avatarUrl}
            alt=""
            className="w-4 h-4 rounded-full object-cover"
          />
        ) : (
          <span className="w-4 h-4 rounded-full bg-emerald-100" />
        )}
        Hosted by Leaf · {plan.hostPersona.name}
      </span>
    );
  }
  if (plan.hostState === "leaf_hosted") {
    return (
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">Hosted by Leaf</span>
    );
  }
  if (plan.hostState === "waiting_on_host") {
    return (
      <span className="text-[11px] uppercase tracking-wider text-amber-600">Waiting on host</span>
    );
  }
  return null; // human_host / leaf_arranging → no badge
}

function WeatherChip({ weather }: { weather: Weather }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-500 bg-white/70 border border-zinc-200 rounded-full px-2 py-0.5">
      <CloudSun className="w-3.5 h-3.5 text-amber-500" />
      {weather.temp ? `${weather.temp}°` : ""}
      {weather.text ? ` ${weather.text}` : ""}
    </span>
  );
}

function RsvpToggle({
  plan,
  onRsvpChange,
}: {
  plan: Plan;
  onRsvpChange: (id: string, s: RsvpState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const going = plan.rsvpState === "going";

  async function toggle() {
    if (busy) return;
    const next: RsvpState = going ? "not_going" : "going";
    const prev = plan.rsvpState;
    setBusy(true);
    onRsvpChange(plan.id, next); // optimistic
    try {
      await Parse.Cloud.run("setMyRsvp", { eventGroupId: plan.id, rsvpState: next });
    } catch {
      onRsvpChange(plan.id, prev); // rollback
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={going}
      className="flex items-center gap-2 shrink-0 disabled:opacity-50"
    >
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">
        {going ? "Going" : "RSVP"}
      </span>
      <span
        className={
          "relative w-10 h-5 rounded-full transition-colors " +
          (going ? "bg-emerald-600" : "bg-zinc-200")
        }
      >
        <span
          className={
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform " +
            (going ? "translate-x-5" : "")
          }
        />
      </span>
    </button>
  );
}

// Low rung of the ask — HOST THIS on waiting_on_host plans. Uses the same copy
// and destination as the calendar page (the org page owns the host action).
function HostThis({ plan }: { plan: Plan }) {
  const href = plan.calendarShareId
    ? `/org/${plan.calendarShareId}?host=${encodeURIComponent(plan.id)}`
    : `/p/${plan.id}`;
  return (
    <Link
      href={href}
      className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-zinc-900 hover:text-emerald-700"
    >
      Host this <ArrowUpRight className="w-3.5 h-3.5" />
    </Link>
  );
}

// ---- Messages, colocated under their plan -----------------------------------
function MessageThread({
  plan,
  onMessagePosted,
}: {
  plan: Plan;
  onMessagePosted: (id: string, m: PlanMessage) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const hasMessages = plan.messages.length > 0;

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await Parse.Cloud.run("postPlanMessage", { eventGroupId: plan.id, body });
      onMessagePosted(plan.id, {
        id: null,
        authorName: "You",
        authorRole: "self",
        body,
        sentAt: new Date().toISOString(),
        unread: false,
      });
      setText("");
    } catch {
      // keep the draft so the user can retry
    } finally {
      setBusy(false);
    }
  }

  // No messages and going/RSVP'd → still allow a reply affordance, but no
  // empty-state chrome (spec §A9).
  if (!hasMessages && plan.rsvpState !== "going") return null;

  return (
    <div className="mt-4 border-t border-zinc-100 pt-3">
      {plan.messages.map((m, i) => (
        <div key={m.id || i} className="flex items-start gap-2 mb-2">
          <span
            className={
              "mt-1 w-1.5 h-1.5 rounded-full shrink-0 " +
              (m.unread ? "bg-emerald-600" : "bg-transparent")
            }
          />
          <p className="text-sm text-zinc-700 leading-snug">
            <span className="font-medium text-zinc-900">{m.authorName}:</span> {m.body}
          </p>
        </div>
      ))}
      {plan.rsvpState === "going" && (
        <div className="flex items-center gap-2 mt-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Reply to the plan…"
            className="flex-1 px-3 py-1.5 text-sm border border-zinc-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-200"
          />
          <button
            onClick={send}
            disabled={busy || !text.trim()}
            className="p-2 rounded-full bg-zinc-900 text-white disabled:opacity-40"
            aria-label="Send reply"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Empty state — no upcoming plans (never render a blank page) -----------
function EmptyState({
  ask,
  owner,
}: {
  ask: Dashboard["ask"];
  owner: boolean;
}) {
  // Non-owner with a real pattern/generic ask → lead with the ask (spec §A9).
  if (ask) return <TheAsk ask={ask} plans={[]} lead />;
  // Owner (ask suppressed) or no ask → an honest "nothing coming up" card.
  return (
    <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50/60 to-white p-6 mb-10">
      <span className="text-xs uppercase tracking-widest font-bold text-emerald-700">
        Nothing coming up
      </span>
      <p className="mt-2 text-lg font-light text-zinc-900">
        No plans on your calendars in the next 7 days. We&rsquo;ll text you when there are.
      </p>
      {owner && (
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold text-zinc-900 hover:text-emerald-700"
        >
          Manage your calendars <ArrowUpRight className="w-4 h-4" />
        </Link>
      )}
    </section>
  );
}

// ---- The ask (converting attendees into owners) ----------------------------
function TheAsk({
  ask,
  lead,
}: {
  ask: { kind: "pattern" | "generic"; copy: string; promptPrefill: string | null };
  plans: Plan[];
  lead?: boolean;
}) {
  const href = ask.promptPrefill
    ? `${PROMPT_BASE}?q=${encodeURIComponent(ask.promptPrefill)}`
    : PROMPT_BASE;
  return (
    <section
      className={
        "rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50/60 to-white p-6 " +
        (lead ? "mt-2" : "mt-2")
      }
    >
      <span className="text-xs uppercase tracking-widest font-bold text-emerald-700">
        {lead ? "Nothing on the calendar yet" : "Start something"}
      </span>
      <p className="mt-2 text-lg font-light text-zinc-900">{ask.copy}</p>
      {/* Rendered as a quoted phrase LINK, not an input — it navigates. */}
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-zinc-900 hover:text-emerald-700"
      >
        {ask.promptPrefill ? (
          <span className="italic">“{ask.promptPrefill}”</span>
        ) : (
          <span className="font-bold uppercase tracking-widest text-[11px]">Start a calendar</span>
        )}
        <ArrowUpRight className="w-4 h-4 shrink-0" />
      </Link>
    </section>
  );
}

// ---- Owner strip (mutually exclusive with the ask) -------------------------
function OwnerStrip({ count }: { count: number }) {
  return (
    <Link
      href="/dashboard"
      className="flex items-center justify-between rounded-xl border border-zinc-200 px-5 py-4 hover:border-zinc-300 mt-2"
    >
      <span className="text-sm text-zinc-700">
        {count} plan{count === 1 ? "" : "s"} need your review
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold text-zinc-900">
        Open manage <ArrowUpRight className="w-3.5 h-3.5" />
      </span>
    </Link>
  );
}

// ---- Footer — the SMS contract ---------------------------------------------
function MeFooter({ userId }: { userId: string | null }) {
  const prefBase = userId ? `/unsubscribe?u=${encodeURIComponent(userId)}` : "/unsubscribe";
  return (
    <footer className="mt-12 pt-6 border-t border-zinc-100 text-center">
      <p className="text-xs text-zinc-400 leading-relaxed">
        We text you once a week — one link to this page — only when you have plans coming up.
      </p>
      <div className="mt-3 flex items-center justify-center gap-4 text-[11px] uppercase tracking-wider text-zinc-400">
        <Link href={prefBase} className="hover:text-zinc-600">
          Change frequency
        </Link>
        <span className="text-zinc-200">·</span>
        <Link href={prefBase} className="hover:text-zinc-600">
          Stop texts
        </Link>
      </div>
    </footer>
  );
}

// ---- Chrome ----------------------------------------------------------------
function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">{children}</div>
  );
}
function Spinner() {
  return <Loader2 className="w-6 h-6 text-zinc-300 animate-spin" />;
}

// ---- OTP fallback (for arrivals without a token) ---------------------------
function OtpModal({ onVerified }: { onVerified: () => void | Promise<void> }) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  async function sendCode() {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setErr("Enter a valid 10-digit phone number.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setStep("code");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Couldn't send code.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    const digits = phone.replace(/\D/g, "");
    if (code.length < 4) {
      setErr("Enter the full code.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const result = (await Parse.Cloud.run("verifyOTP", {
        phone: `+1${digits}`,
        code,
      })) as { sessionToken?: string } | string;
      const st = typeof result === "string" ? result : result?.sessionToken;
      if (!st || !st.startsWith("r:")) throw new Error("Verification failed. Try again.");
      await Parse.User.become(st);
      await onVerified();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">See your plans</h3>
            <p className="text-xs text-zinc-500">
              {step === "phone" ? "Enter your phone to continue." : `Sent to +1 ${phone}`}
            </p>
          </div>
        </div>

        {step === "phone" ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-zinc-400">+1</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(555) 123-4567"
                className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
                autoFocus
              />
            </div>
            {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
            <button
              onClick={sendCode}
              disabled={busy}
              className="w-full py-2.5 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Code"
              className="w-full px-3 py-2 mb-3 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-200"
              autoFocus
            />
            {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
            <button
              onClick={submitCode}
              disabled={busy}
              className="w-full py-2.5 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "See my plans"}
            </button>
            <button
              onClick={() => setStep("phone")}
              className="w-full mt-2 text-xs text-zinc-400 hover:text-zinc-600 flex items-center justify-center gap-1"
            >
              <X className="w-3 h-3" /> Use a different number
            </button>
          </>
        )}
      </div>
    </div>
  );
}
