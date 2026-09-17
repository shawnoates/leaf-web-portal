"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Clock, Info, Loader2, Search, Send, X, Zap } from "lucide-react";
import Parse from "@/lib/parse-client";
import { track } from "@/lib/track";

// "Cross-promote" — the owner puts one plan on other calendars. (Deliberately
// not "share": that word is taken by link sharing.) The plan stays one plan
// with one guest list; followers of any calendar it lands on RSVP straight to
// the host.
//
// Direction 1a of the 2026-09-17 redesign — matched first, one screen:
//   · owned calendars the server scores as a fit (fit === 2) start checked and
//     add instantly; the rest of the owner's calendars collapse behind a
//     disclosure and the search field;
//   · three suggested non-owned communities need their owner's OK, cost one of
//     two requests per plan, and require a note; anything else is reachable
//     by name search only;
//   · at most five calendars per cross-promote; requests close 48h before
//     start while owned calendars add until the plan begins;
//   · a Review step before anything is sent.
// The server re-derives every rule (`requestPlanPromotions`); the sheet only
// keeps the user from building a selection it would reject.

type Kind = "sibling" | "owned" | "partner" | "nearby";
type Fit = 0 | 1 | 2;

interface Target {
  calendarId: string;
  name: string;
  shareId: string | null;
  photoUrl: string | null;
  followerCount: number;
  distanceMiles: number | null;
  kind: Kind;
  /** Adds instantly — a sibling, another calendar of theirs, or a partner. */
  autoAccept: boolean;
  status: "pending" | "accepted" | null;
  promotionId: string | null;
  // Present on servers that classify (the redesign); older payloads lack them.
  fit?: Fit;
  hint?: string;
  description?: string | null;
  ownerName?: string | null;
}

interface TargetsPayload {
  targets: Target[];
  /** The non-owned communities to show up front, best fit first. */
  suggested?: string[];
  communityCount?: number | null;
  maxTargets: number;
  planIsShareable: boolean;
  hoursToStart?: number;
  requestsOpen?: boolean;
  requestsUsed?: number;
  limits?: { maxSelect: number; maxRequests: number; requestWindowHours: number };
}

interface RequestResult {
  results: { calendarId: string; status: string | null; promotionId: string | null; reason: string }[];
  instantCount: number;
  pendingCount: number;
}

const DEFAULT_MAX_SELECT = 5;
const DEFAULT_MAX_REQUESTS = 2;
const DEFAULT_WINDOW_HOURS = 48;
const SUGGESTED_COUNT = 3;
// Fallback when the server sends no fit score: a far-away owned calendar
// shouldn't receive a Brooklyn plan by default.
const PRECHECK_MAX_MILES = 25;

const HINT_CHIP: Record<Fit, string> = {
  2: "bg-[#e0ebe7] text-[#325348]",
  1: "bg-zinc-100 text-zinc-600",
  0: "bg-[#fef3c7] text-[#b45309]",
};
const AMBER_CHIP = HINT_CHIP[0];

const fitOf = (t: Target): Fit => {
  if (t.fit === 0 || t.fit === 1 || t.fit === 2) return t.fit;
  if (t.distanceMiles != null && t.distanceMiles > PRECHECK_MAX_MILES) return 0;
  return t.autoAccept ? 2 : 1;
};

const hintOf = (t: Target): string => {
  if (t.hint) return t.hint;
  if (t.distanceMiles != null && t.distanceMiles > PRECHECK_MAX_MILES) {
    return `${Math.round(t.distanceMiles).toLocaleString()} mi away`;
  }
  return t.autoAccept ? "Your calendar" : "Nearby";
};

const metaOf = (t: Target): string =>
  [
    `${t.followerCount} follower${t.followerCount === 1 ? "" : "s"}`,
    t.distanceMiles != null
      ? `${t.distanceMiles >= 100 ? Math.round(t.distanceMiles).toLocaleString() : t.distanceMiles} mi`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function Avatar({ t, size, tone }: { t: Target; size: 28 | 32; tone: "owned" | "community" }) {
  const dim = size === 32 ? "w-8 h-8 rounded-lg" : "w-7 h-7 rounded-[7px]";
  const text = size === 32 ? "text-xs" : "text-[11px]";
  if (t.photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={t.photoUrl} alt="" className={`${dim} object-cover shrink-0`} />;
  }
  return (
    <span
      className={`${dim} ${text} font-semibold flex items-center justify-center shrink-0 ${
        tone === "community" ? "bg-[#e0ebe7] text-[#325348]" : "bg-zinc-100 text-zinc-500"
      }`}
    >
      {(t.name || "?").trim().charAt(0).toUpperCase()}
    </span>
  );
}

function Checkbox({ on, disabled, className = "" }: { on: boolean; disabled?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-[border-color,background-color] duration-150 ${
        on ? "bg-zinc-900 border-zinc-900" : disabled ? "border-zinc-200 bg-zinc-50" : "border-zinc-300 bg-white"
      } ${className}`}
    >
      {on && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-[9px] font-semibold tracking-[0.12em] uppercase text-zinc-400 inline-flex items-center gap-1.5">
      {children}
    </p>
  );
}

export default function SharePlanSheet({
  eventGroupId,
  planTitle,
  calendarId,
  onClose,
  onSent,
}: {
  eventGroupId: string;
  planTitle: string;
  calendarId?: string | null;
  onClose: () => void;
  /** Fires after a successful send with what happened, for a toast. */
  onSent?: (summary: { instant: number; pending: number }) => void;
}) {
  // Layout branch. The sheet only ever mounts on a click, so reading the
  // viewport in the initializer is safe (never part of the SSR pass).
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TargetsPayload | null>(null);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [othersOpen, setOthersOpen] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // "Search all communities": a name search over every public calendar.
  // Results the user checks are kept in `picked` so they stay on screen after
  // the query changes or clears.
  const [communitySearchOpen, setCommunitySearchOpen] = useState(false);
  const [communityQuery, setCommunityQuery] = useState("");
  const [communityResults, setCommunityResults] = useState<Target[]>([]);
  const [communitySearching, setCommunitySearching] = useState(false);
  const [picked, setPicked] = useState<Map<string, Target>>(new Map());
  const communityInputRef = useRef<HTMLInputElement | null>(null);

  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ instant: number; pending: number; skipped: number; closed: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await Parse.Cloud.run("listPromotionTargets", { eventGroupId })) as TargetsPayload;
        if (cancelled) return;
        setData(res);
        // Owned calendars that fit start checked; nothing else does.
        const cap = res.limits?.maxSelect ?? Math.min(res.maxTargets ?? DEFAULT_MAX_SELECT, DEFAULT_MAX_SELECT);
        const initial = new Set<string>();
        for (const t of res.targets) {
          if (initial.size >= cap) break;
          if (t.status || !t.autoAccept || fitOf(t) !== 2) continue;
          initial.add(t.calendarId);
        }
        setChecked(initial);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "";
        // A server without the feature (or with it switched off) — say so
        // plainly instead of surfacing "Invalid function".
        setError(
          /invalid function|not enabled/i.test(msg)
            ? "Cross-promotion isn't switched on for your account yet."
            : msg || "Couldn't load communities",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventGroupId]);

  // ---- Limits & window -------------------------------------------------
  // An older server advertises 10 targets; the redesign caps at 5 regardless.
  const maxSelect = data?.limits?.maxSelect ?? Math.min(data?.maxTargets ?? DEFAULT_MAX_SELECT, DEFAULT_MAX_SELECT);
  const maxRequests = data?.limits?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const windowHours = data?.limits?.requestWindowHours ?? DEFAULT_WINDOW_HOURS;
  const hoursToStart = data?.hoursToStart ?? null;
  const requestsOpen = data?.requestsOpen ?? (hoursToStart == null ? true : hoursToStart >= windowHours);
  const requestsUsed = data?.requestsUsed ?? 0;

  // ---- Lists -----------------------------------------------------------
  const targets = useMemo(() => data?.targets ?? [], [data]);
  const owned = useMemo(() => targets.filter((t) => t.autoAccept), [targets]);
  const nonOwned = useMemo(() => targets.filter((t) => !t.autoAccept), [targets]);

  const byId = useMemo(() => {
    const m = new Map<string, Target>();
    for (const t of targets) m.set(t.calendarId, t);
    for (const t of picked.values()) if (!m.has(t.calendarId)) m.set(t.calendarId, t);
    for (const t of communityResults) if (!m.has(t.calendarId)) m.set(t.calendarId, t);
    return m;
  }, [targets, picked, communityResults]);

  const suggested = useMemo(() => {
    const ids = data?.suggested;
    const base = ids && ids.length
      ? ids.map((id) => byId.get(id)).filter((t): t is Target => Boolean(t))
      : nonOwned.slice(0, SUGGESTED_COUNT);
    const extras = [...picked.values()].filter((t) => !base.some((b) => b.calendarId === t.calendarId));
    return [...base, ...extras];
  }, [data, byId, nonOwned, picked]);
  const suggestedIds = useMemo(() => new Set(suggested.map((t) => t.calendarId)), [suggested]);

  const q = query.trim().toLowerCase();
  const matches = (t: Target) => !q || t.name.toLowerCase().includes(q);
  const fits = owned.filter((t) => fitOf(t) === 2 && matches(t));
  const others = owned.filter((t) => fitOf(t) < 2 && matches(t));
  const othersListOpen = othersOpen || Boolean(q) || fits.length === 0;
  const noOwnedMatch = Boolean(q) && owned.length > 0 && fits.length === 0 && others.length === 0;

  const checkedTargets = [...checked].map((id) => byId.get(id)).filter((t): t is Target => Boolean(t));
  const instant = checkedTargets.filter((t) => t.autoAccept);
  const requests = checkedTargets.filter((t) => !t.autoAccept);
  const count = checked.size;
  const reqLeft = Math.max(0, maxRequests - requestsUsed - requests.length);
  const requestCapHit = reqLeft === 0;
  const noteOk = requests.length === 0 || note.trim().length > 0;
  const nearbyExpanded = !narrow || nearbyOpen || requests.length > 0;

  // ---- Community search -------------------------------------------------
  useEffect(() => {
    const term = communityQuery.trim();
    if (term.length < 2) { setCommunityResults([]); setCommunitySearching(false); return; }
    let cancelled = false;
    setCommunitySearching(true);
    const timer = window.setTimeout(async () => {
      // Local hits (the server's wider nearby list) come first; the name
      // search covers everything else.
      const local = nonOwned.filter((t) => t.name.toLowerCase().includes(term.toLowerCase()));
      let remote: Target[] = [];
      try {
        const res = (await Parse.Cloud.run("searchPromotionTargets", { eventGroupId, query: term })) as { targets: Target[] };
        remote = res?.targets ?? [];
      } catch {
        // An older server has no search — local matches still work.
      }
      if (cancelled) return;
      const seen = new Set<string>();
      const merged: Target[] = [];
      for (const t of [...local, ...remote]) {
        if (seen.has(t.calendarId) || t.autoAccept) continue;
        seen.add(t.calendarId);
        merged.push(t);
      }
      setCommunityResults(merged);
      setCommunitySearching(false);
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [communityQuery, eventGroupId, nonOwned]);

  const openCommunitySearch = () => {
    setCommunitySearchOpen(true);
    setNearbyOpen(true);
    window.setTimeout(() => communityInputRef.current?.focus(), 0);
  };

  // ---- Selection --------------------------------------------------------
  const canCheck = (t: Target) => {
    if (t.status) return false;
    if (count >= maxSelect) return false;
    if (!t.autoAccept && (requestCapHit || !requestsOpen)) return false;
    return true;
  };

  const toggle = (t: Target) => {
    const id = t.calendarId;
    if (checked.has(id)) {
      setChecked((prev) => { const next = new Set(prev); next.delete(id); return next; });
      return;
    }
    if (!canCheck(t)) return;
    setChecked((prev) => new Set(prev).add(id));
    if (!t.autoAccept && !suggestedIds.has(id)) {
      setPicked((prev) => new Map(prev).set(id, t));
    }
  };

  const goReview = () => {
    if (count === 0 || !noteOk || !data?.planIsShareable) return;
    setStep(2);
  };

  const send = async () => {
    if (!data || count === 0 || sending || !noteOk) return;
    setSending(true);
    setError(null);
    try {
      const trimmedNote = note.trim();
      const res = (await Parse.Cloud.run("requestPlanPromotions", {
        eventGroupId,
        calendarIds: checkedTargets.map((t) => t.calendarId),
        requests: requests.map((t) => ({ calendarId: t.calendarId, note: trimmedNote })),
        note: requests.length ? trimmedNote : undefined,
      })) as RequestResult;
      const closed = res.results.filter((r) => r.reason === "window_closed").length;
      const skipped = res.results.filter((r) => !r.promotionId).length - closed;
      setDone({ instant: res.instantCount, pending: res.pendingCount, skipped, closed });
      track("cross_promo_share_sent", {
        planId: eventGroupId,
        targets: count,
        instant: res.instantCount,
        pending: res.pendingCount,
        requests: requests.length,
      }, calendarId ?? null);
      onSent?.({ instant: res.instantCount, pending: res.pendingCount });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't cross-promote the plan");
      setStep(1);
    } finally {
      setSending(false);
    }
  };

  // ---- Rows -------------------------------------------------------------
  const rowPad = narrow ? "px-3 py-3.5" : "px-3 py-2.5";

  const statusChip = (t: Target) =>
    t.status === "accepted" ? (
      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 shrink-0">Added</span>
    ) : t.status === "pending" ? (
      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 shrink-0">Pending</span>
    ) : null;

  const ownedRow = (t: Target) => {
    const on = checked.has(t.calendarId);
    const blocked = !on && !canCheck(t);
    const fit = fitOf(t);
    return (
      <label
        key={t.calendarId}
        className={`flex items-center gap-3 ${rowPad} rounded-xl border bg-white transition-[border-color,opacity] duration-150 ${
          on ? "border-zinc-900" : "border-zinc-200"
        } ${blocked ? "opacity-45 cursor-default" : "cursor-pointer hover:border-zinc-300"}`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={on}
          disabled={blocked}
          onChange={() => toggle(t)}
        />
        <Checkbox on={on} disabled={blocked} />
        <Avatar t={t} size={32} tone="owned" />
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-zinc-900 truncate">{t.name}</span>
          <span className="text-[11px] text-zinc-500">{metaOf(t)}</span>
        </span>
        {statusChip(t) ?? (
          <span className={`text-[10px] font-medium px-2 py-[3px] rounded-full shrink-0 whitespace-nowrap ${HINT_CHIP[fit]}`}>
            {hintOf(t)}
          </span>
        )}
      </label>
    );
  };

  const suggestedRow = (t: Target) => {
    const on = checked.has(t.calendarId);
    const blocked = !on && !canCheck(t);
    const isExpanded = expanded === t.calendarId;
    const chipLabel = !requestsOpen
      ? "Too close to start"
      : !on && requestCapHit && !t.status
        ? "Request limit"
        : hintOf(t);
    const chipCls = !requestsOpen || (!on && requestCapHit) ? AMBER_CHIP : HINT_CHIP[2];
    const calendarHref = t.shareId ? `/org/${t.shareId}` : null;
    return (
      <div
        key={t.calendarId}
        className={`rounded-xl border bg-white overflow-hidden transition-[border-color,opacity] duration-150 ${
          on ? "border-zinc-900" : "border-zinc-200"
        } ${blocked || !requestsOpen ? "opacity-45" : ""}`}
      >
        <label className={`flex items-start gap-3 ${rowPad} ${blocked ? "cursor-default" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            className="sr-only"
            checked={on}
            disabled={blocked}
            onChange={() => toggle(t)}
          />
          <Checkbox on={on} disabled={blocked} className="mt-1.5" />
          <Avatar t={t} size={32} tone="community" />
          <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
            <span className="flex items-center gap-2 min-w-0">
              <span className="flex-1 text-[13px] font-medium text-zinc-900 truncate">{t.name}</span>
              {statusChip(t) ?? (
                <span className={`text-[10px] font-medium px-2 py-[3px] rounded-full shrink-0 whitespace-nowrap ${chipCls}`}>
                  {chipLabel}
                </span>
              )}
            </span>
            <span className="text-[11px] text-zinc-500">{metaOf(t)}</span>
            {t.description && (
              <span className="text-[11px] leading-normal text-zinc-600 truncate">{t.description}</span>
            )}
          </span>
          <button
            type="button"
            aria-label="About this calendar"
            aria-expanded={isExpanded}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((cur) => (cur === t.calendarId ? null : t.calendarId));
            }}
            className="w-7 h-7 mt-0.5 -mr-1.5 -ml-1 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors shrink-0"
          >
            <Info className="w-[15px] h-[15px]" />
          </button>
        </label>
        {isExpanded && (
          <div className="flex flex-col gap-2 px-3.5 pt-3 pb-3.5 bg-zinc-50 border-t border-zinc-100">
            <p className="m-0 text-xs leading-relaxed text-zinc-700">
              {t.description || "No description yet."}
            </p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-500">{t.ownerName ? `Run by ${t.ownerName}` : ""}</span>
              {calendarHref && (
                <a
                  href={calendarHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-zinc-900 underline underline-offset-2"
                >
                  View calendar
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const reviewRow = (t: Target, right: React.ReactNode, tone: "owned" | "community") => (
    <div key={t.calendarId} className="flex items-center gap-3 px-3 py-2.5 border-t border-zinc-100 first:border-t-0">
      <Avatar t={t} size={28} tone={tone} />
      <span className="flex-1 min-w-0 text-[13px] text-zinc-900 truncate">{t.name}</span>
      {right}
    </div>
  );

  // ---- Footer -----------------------------------------------------------
  const review = step === 2;
  let footerText: string;
  if (review) {
    footerText = [
      instant.length ? `${instant.length} instant` : null,
      requests.length ? `${requests.length} need OK` : null,
    ].filter(Boolean).join(" · ");
  } else if (count === 0) {
    footerText = "Pick at least one";
  } else if (requests.length && !noteOk) {
    footerText = "Add a note to continue";
  } else {
    footerText = `${count} of ${maxSelect}${requests.length ? ` · ${requests.length} need OK` : ""}`;
  }
  const primaryDisabled = review
    ? sending
    : loading || count === 0 || !noteOk || !data?.planIsShareable;

  const noteRecipients = requests.length === 1 ? requests[0].name : `${requests.length} owners`;
  const communityTotal = data?.communityCount ?? null;
  const nearbyToggleLabel = nearbyOpen
    ? "Hide"
    : communityTotal && communityTotal > suggested.length
      ? `Show ${suggested.length} of ${communityTotal.toLocaleString()}`
      : `Show ${suggested.length}`;
  const searchResultsToShow = communityResults.filter((t) => !suggestedIds.has(t.calendarId));

  // ---- Render -----------------------------------------------------------
  const bodyPad = narrow ? "px-4 pt-4 pb-5" : "px-6 py-5";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/45 backdrop-blur-sm">
      <div
        className={`bg-white w-full flex flex-col text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.25)] max-h-[92vh] ${
          narrow ? "rounded-t-[20px]" : "max-w-[448px] rounded-2xl"
        }`}
      >
        {narrow && (
          <div className="flex justify-center pt-2">
            <div className="w-9 h-1 rounded-full bg-zinc-200" />
          </div>
        )}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="m-0 text-base font-semibold inline-flex items-center gap-2 text-zinc-900">
            <Send className="w-4 h-4 text-zinc-500" />
            Cross-promote this plan
          </h2>
          <button onClick={onClose} className="p-1 -mr-1 text-zinc-400 hover:text-zinc-900 transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-6 h-6 text-emerald-700" />
            </div>
            <p className="text-sm text-zinc-800 font-medium">{planTitle} is on its way.</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {done.instant > 0 && `Added to ${done.instant} ${plural(done.instant, "calendar", "calendars")} instantly. `}
              {done.pending > 0 && `${done.pending} ${plural(done.pending, "owner", "owners")} will get your note and decide. `}
              {done.closed > 0 && `${done.closed} ${plural(done.closed, "request", "requests")} closed because the plan starts within ${windowHours} hours. `}
              {done.skipped > 0 && `${done.skipped} couldn't take it right now.`}
              {done.instant === 0 && done.pending === 0 && done.skipped === 0 && done.closed === 0 && "Nothing new to send."}
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-5 py-2 bg-zinc-900 text-white text-xs font-medium rounded-full hover:bg-zinc-800 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Search — pinned above the scroll area */}
            {!review && !loading && !error && data?.planIsShareable && owned.length > 0 && (
              <div className={narrow ? "px-4 pt-3" : "px-6 pt-5"}>
                <label
                  className={`flex items-center gap-2 border border-zinc-200 rounded-[10px] bg-zinc-50 focus-within:border-zinc-400 transition-colors ${
                    narrow ? "px-3.5 py-3" : "px-3 py-[9px]"
                  }`}
                >
                  <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Search your ${owned.length} ${plural(owned.length, "calendar", "calendars")}`}
                    className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] text-zinc-900 placeholder:text-zinc-400"
                    aria-label="Search your calendars"
                  />
                </label>
              </div>
            )}

            <div
              className={`${bodyPad} flex flex-col gap-4 overflow-y-auto min-h-0 ${
                narrow ? "max-h-[min(480px,calc(92vh-190px))]" : "h-[520px] max-h-[calc(92vh-190px)]"
              }`}
            >
              {loading ? (
                <div className="py-8 flex justify-center text-zinc-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : error ? (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
              ) : data && !data.planIsShareable ? (
                <div className="p-3 bg-zinc-50 border border-zinc-200 text-zinc-600 text-sm rounded-lg">
                  Only upcoming, published plans can be cross-promoted.
                </div>
              ) : review ? (
                <>
                  <p className="m-0 text-xs leading-relaxed text-zinc-500">
                    Here&apos;s where <span className="font-medium text-zinc-700">{planTitle}</span> will show up.
                    Nothing changes on the plan itself.
                  </p>
                  {instant.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <Eyebrow>Adds instantly · {instant.length}</Eyebrow>
                      <div className="border border-zinc-200 rounded-xl overflow-hidden">
                        {instant.map((t) =>
                          reviewRow(
                            t,
                            <span className="text-[11px] text-zinc-500 shrink-0">
                              {t.followerCount} {plural(t.followerCount, "follower", "followers")}
                            </span>,
                            "owned",
                          ),
                        )}
                      </div>
                    </div>
                  )}
                  {requests.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <Eyebrow>Request sent · {requests.length}</Eyebrow>
                      <div className="border border-zinc-200 rounded-xl overflow-hidden">
                        {requests.map((t) =>
                          reviewRow(
                            t,
                            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-[#b45309] shrink-0">Pending</span>,
                            "community",
                          ),
                        )}
                        <div className="px-3 py-2.5 bg-zinc-50 text-xs text-zinc-600 leading-relaxed border-t border-zinc-100">
                          “{note.trim()}”
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!narrow && (
                    <p className="m-0 text-xs leading-relaxed text-zinc-500">
                      <span className="font-medium text-zinc-700">{planTitle}</span> stays one plan with one guest
                      list. Followers of any calendar it lands on RSVP straight to you.
                    </p>
                  )}

                  {/* Owned calendars that fit — pre-selected */}
                  {noOwnedMatch ? (
                    <p className="m-0 text-xs text-zinc-500">No calendars match</p>
                  ) : (
                    <>
                      {fits.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-baseline justify-between">
                            <Eyebrow>
                              <Zap className="w-[11px] h-[11px]" strokeWidth={2.4} />
                              Fits this plan · pre-selected
                            </Eyebrow>
                            <span className="text-[11px] text-zinc-400">Adds instantly</span>
                          </div>
                          {fits.map(ownedRow)}
                        </div>
                      )}

                      {/* The owner's other calendars */}
                      {others.length > 0 && (
                        <div className="flex flex-col gap-2">
                          {fits.length === 0 && (
                            // Nothing scored as a fit — list the owner's
                            // calendars plainly rather than behind a disclosure.
                            <div className="flex items-baseline justify-between">
                              <Eyebrow>Your calendars</Eyebrow>
                              <span className="text-[11px] text-zinc-400">Adds instantly</span>
                            </div>
                          )}
                          {fits.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setOthersOpen((v) => !v)}
                              aria-expanded={othersListOpen}
                              className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-xs text-zinc-600 hover:border-zinc-400 transition-colors"
                            >
                              <span>
                                {q
                                  ? `${others.length} more ${plural(others.length, "match", "matches")}`
                                  : `Your ${others.length} other ${plural(others.length, "calendar", "calendars")}`}
                              </span>
                              <ChevronDown
                                className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${othersListOpen ? "rotate-180" : ""}`}
                              />
                            </button>
                          )}
                          {othersListOpen && others.map(ownedRow)}
                        </div>
                      )}
                    </>
                  )}

                  {/* Suggested communities — needs their OK */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <Eyebrow>Suggested · needs their OK</Eyebrow>
                      {narrow && requests.length === 0 ? (
                        suggested.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setNearbyOpen((v) => !v)}
                            className="text-[11px] text-zinc-600 underline underline-offset-2"
                          >
                            {nearbyToggleLabel}
                          </button>
                        )
                      ) : (
                        <span className={`text-[11px] ${!requestsOpen || requestCapHit ? "text-[#b45309]" : "text-zinc-400"}`}>
                          {!requestsOpen
                            ? `Closed${hoursToStart != null ? ` · starts in ${hoursToStart}h` : ""}`
                            : `${reqLeft} of ${maxRequests} ${plural(maxRequests, "request", "requests")} left`}
                        </span>
                      )}
                    </div>

                    {!requestsOpen && (
                      <div className="flex gap-2.5 p-3 rounded-xl bg-[#fffbeb] border border-[#fde68a]">
                        <Clock className="w-3.5 h-3.5 text-[#b45309] shrink-0 mt-0.5" />
                        <p className="m-0 text-xs leading-[1.55] text-[#78350f]">
                          Requests close {windowHours} hours before a plan starts so owners have time to answer.
                          {hoursToStart != null && ` This one starts in ${hoursToStart} ${plural(hoursToStart, "hour", "hours")}.`}
                          {" "}Your own calendars still add instantly.
                        </p>
                      </div>
                    )}

                    {nearbyExpanded && (
                      <>
                        {suggested.length === 0 && !communitySearchOpen && (
                          <p className="m-0 text-xs text-zinc-500">
                            No communities nearby yet. Try searching for one by name.
                          </p>
                        )}
                        {suggested.map(suggestedRow)}

                        {communitySearchOpen && (
                          <>
                            <label
                              className={`flex items-center gap-2 border border-zinc-200 rounded-[10px] bg-zinc-50 focus-within:border-zinc-400 transition-colors ${
                                narrow ? "px-3.5 py-3" : "px-3 py-[9px]"
                              }`}
                            >
                              {communitySearching ? (
                                <Loader2 className="w-3.5 h-3.5 text-zinc-400 shrink-0 animate-spin" />
                              ) : (
                                <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              )}
                              <input
                                ref={communityInputRef}
                                value={communityQuery}
                                onChange={(e) => setCommunityQuery(e.target.value)}
                                placeholder="Search communities by name"
                                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] text-zinc-900 placeholder:text-zinc-400"
                                aria-label="Search all communities"
                              />
                              {communityQuery && (
                                <button
                                  type="button"
                                  onClick={() => setCommunityQuery("")}
                                  className="text-zinc-400 hover:text-zinc-700"
                                  aria-label="Clear search"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </label>
                            {searchResultsToShow.map(suggestedRow)}
                            {communityQuery.trim().length >= 2 && !communitySearching && searchResultsToShow.length === 0 && (
                              <p className="m-0 text-xs text-zinc-500">No communities match</p>
                            )}
                          </>
                        )}

                        {requests.length > 0 && (
                          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                            <label htmlFor="cross-promo-note" className="text-[11px] font-medium text-zinc-700">
                              Note to {noteRecipients} <span className="text-zinc-400 font-normal">· required</span>
                            </label>
                            <textarea
                              id="cross-promo-note"
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              rows={2}
                              maxLength={500}
                              placeholder="Why does this plan fit their community?"
                              className="w-full border border-zinc-200 rounded-lg px-2.5 py-2 text-xs leading-normal resize-none bg-white text-zinc-900 outline-none focus:border-zinc-400 placeholder:text-zinc-400"
                            />
                          </div>
                        )}

                        {!communitySearchOpen && (
                          <button
                            type="button"
                            onClick={openCommunitySearch}
                            className="self-start text-xs text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
                          >
                            Search all communities
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div
              className={`flex items-center justify-between gap-2 px-6 py-4 border-t border-zinc-100 bg-zinc-50 ${
                narrow ? "" : "rounded-b-2xl"
              }`}
            >
              <div className="flex flex-col gap-[5px] min-w-0">
                <span className="text-[11px] text-zinc-500 whitespace-nowrap">{footerText}</span>
                {!review && (
                  <div className="flex gap-[3px]" aria-hidden>
                    {Array.from({ length: maxSelect }, (_, i) => (
                      <span
                        key={i}
                        className={`w-3.5 h-1 rounded-sm transition-colors duration-150 ${i < count ? "bg-zinc-900" : "bg-zinc-200"}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={review ? () => setStep(1) : onClose}
                  disabled={sending}
                  className="text-sm text-zinc-500 px-3 py-2 hover:text-zinc-900 transition-colors disabled:opacity-50"
                >
                  {review ? "Back" : "Cancel"}
                </button>
                <button
                  onClick={review ? send : goReview}
                  disabled={primaryDisabled}
                  className={`inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none text-white font-medium rounded-full transition-colors whitespace-nowrap ${
                    narrow ? "text-sm px-5 py-3.5" : "text-xs px-4 py-2.5"
                  }`}
                >
                  {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {review ? `Cross-promote to ${count} ${plural(count, "community", "communities")}` : "Review"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
