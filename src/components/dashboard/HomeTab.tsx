"use client";

import { useMemo } from "react";
import { Calendar, Plus } from "lucide-react";
import type { OrgAnalytics } from "@/components/analytics/types";
import { formatWallClockTime12h } from "@/lib/date-utils";
import type { CalActivePlan, OrgDashboard } from "./types";
import { buildRsvpCountIndex, rsvpCountForPerson } from "./types";

// Home — the landing place of the redesigned dashboard. Leads with pending
// work (NEEDS YOU), then the schedule as a 14-day timeline spine, with a right
// rail for recent photos. The goal: an admin landing here knows what to do in
// under five seconds.

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface DayBucket {
  date: Date;
  plans: CalActivePlan[];
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Best day of week for this org, from analytics when loaded (paid tiers) or
 *  a client-side pass over the recent-RSVP list otherwise. Null when there is
 *  not enough signal to make a claim. */
function computeBestDay(
  analytics: OrgAnalytics | null,
  rsvps: OrgDashboard["rsvps"],
): { dayIndex: number; sharePct: number } | null {
  let counts: number[] | null = null;
  if (analytics?.whatsWorking?.weekdayDistribution?.length) {
    counts = new Array(7).fill(0);
    for (const d of analytics.whatsWorking.weekdayDistribution) {
      const idx = DAY_SHORT.findIndex((s) =>
        d.day.toLowerCase().startsWith(s.toLowerCase()),
      );
      if (idx >= 0) counts[idx] += d.value;
    }
  } else if (rsvps.length > 0) {
    counts = new Array(7).fill(0);
    for (const r of rsvps) {
      const d = new Date(r.date);
      if (!isNaN(d.getTime())) counts[d.getDay()] += 1;
    }
  }
  if (!counts) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 5) return null;
  let best = 0;
  for (let i = 1; i < 7; i++) if (counts[i] > counts[best]) best = i;
  const sharePct = Math.round((counts[best] / total) * 100);
  if (sharePct < 25) return null;
  return { dayIndex: best, sharePct };
}

function hostLine(plan: CalActivePlan): string {
  if (plan.isVirtualHost) return `${plan.hostName} hosting`;
  if (plan.leafHostState === "leaf_hosted")
    return `Leaf hosting${plan.leafHostPersona?.name ? ` · ${plan.leafHostPersona.name}` : ""}`;
  if (plan.leafHostState === "leaf_arranging") return "Leaf is arranging this";
  return `${plan.hostName} hosting`;
}

/** Month-over-month percentage change, or null when there is no last-month
 *  baseline to compare against (0 or the server field not deployed yet). */
function momDeltaPct(current: number, previous: number | undefined): number | null {
  if (previous == null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function StatTile({
  label,
  value,
  deltaPct,
}: {
  label: string;
  value: number;
  deltaPct: number | null;
}) {
  return (
    <div className="border border-zinc-200 rounded-xl p-3 sm:p-4">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="text-xl sm:text-2xl font-semibold text-zinc-900 mt-1.5">
        {value}
        {deltaPct != null && deltaPct !== 0 && (
          <span
            className={`text-xs font-medium ml-1.5 ${deltaPct > 0 ? "text-leaf-700" : "text-zinc-400"}`}
          >
            {deltaPct > 0 ? "+" : ""}
            {deltaPct}%
          </span>
        )}
      </p>
    </div>
  );
}

function PlanCover({
  plan,
  className,
}: {
  plan: CalActivePlan;
  className: string;
}) {
  return plan.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={plan.image} alt="" className={`${className} object-cover`} />
  ) : (
    <div className={`${className} bg-zinc-100 flex items-center justify-center`}>
      <Calendar className="w-4 h-4 text-zinc-300" />
    </div>
  );
}

export default function HomeTab({
  dashboard,
  analytics,
  publishBanner,
  topSlot,
  onNewPlan,
  onOpenPlan,
  onGoCommunity,
  onApproveHostRequest,
  onDeclineHostRequest,
  onEditHostRequest,
  onApproveRsvp,
  onDeclineRsvp,
  onApproveFollower,
  onRejectFollower,
  eventApprovalsCount,
  eventApprovalsHref,
}: {
  dashboard: OrgDashboard;
  analytics: OrgAnalytics | null;
  publishBanner: string | null;
  /** Banners and cards the page owns (concierge entry, app-connect nudge,
   *  RSVP-limit warning) — rendered between the header and the counters. */
  topSlot?: React.ReactNode;
  onNewPlan: (prefillDate?: string) => void;
  onOpenPlan: (plan: CalActivePlan) => void;
  onGoCommunity: (segment?: "never") => void;
  onApproveHostRequest: (req: OrgDashboard["hostRequests"][number]) => void;
  onDeclineHostRequest: (req: OrgDashboard["hostRequests"][number]) => void;
  onEditHostRequest: (req: OrgDashboard["hostRequests"][number]) => void;
  onApproveRsvp: (req: OrgDashboard["pendingRsvpRequests"][number]) => void;
  onDeclineRsvp: (req: OrgDashboard["pendingRsvpRequests"][number]) => void;
  onApproveFollower: (pf: OrgDashboard["pendingFollowers"][number]) => void;
  onRejectFollower: (pf: OrgDashboard["pendingFollowers"][number]) => void;
  eventApprovalsCount: number;
  eventApprovalsHref: string;
}) {
  const allPlans = useMemo(
    () =>
      dashboard.calendars
        .flatMap((c) => c.activePlans || [])
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [dashboard.calendars],
  );

  const days: DayBucket[] = useMemo(() => {
    const byDay = new Map<string, CalActivePlan[]>();
    for (const p of allPlans) {
      const d = new Date(p.date);
      if (isNaN(d.getTime())) continue;
      const key = localDayKey(d);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(p);
    }
    const out: DayBucket[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      out.push({ date, plans: byDay.get(localDayKey(date)) || [] });
    }
    return out;
  }, [allPlans]);

  const bestDay = useMemo(
    () => computeBestDay(analytics, dashboard.rsvps),
    [analytics, dashboard.rsvps],
  );

  const rsvpIndex = useMemo(
    () => buildRsvpCountIndex(dashboard.rsvps),
    [dashboard.rsvps],
  );
  const neverRsvpd = useMemo(
    () =>
      dashboard.followers.filter(
        (f) => rsvpCountForPerson(rsvpIndex, f) === 0,
      ).length,
    [dashboard.followers, rsvpIndex],
  );

  // Stat tiles: this-calendar-month counts, each with a month-over-month
  // delta from the server's last-month counterparts. Plans and new followers
  // fall back to client-side counts (upcoming plans only / the follower list)
  // until the getOrgDashboard deploy that computes them is live.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
  const inThisMonth = (raw: string) => {
    const d = new Date(raw);
    return !isNaN(d.getTime()) && d >= monthStart && d < nextMonthStart;
  };
  const plansThisMonth =
    dashboard.plansThisMonth ?? allPlans.filter((p) => inThisMonth(p.date)).length;
  const newFollowersThisMonth =
    dashboard.newFollowersThisMonth ??
    dashboard.followers.filter((f) => inThisMonth(f.joinedAt)).length;
  const plansDelta = momDeltaPct(plansThisMonth, dashboard.plansLastMonth);
  const followersDelta = momDeltaPct(
    newFollowersThisMonth,
    dashboard.newFollowersLastMonth,
  );
  const rsvpsDelta = momDeltaPct(dashboard.rsvpsThisMonth, dashboard.rsvpsLastMonth);

  const today = new Date();
  const title = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const emptyDayPrompt = (date: Date) =>
    bestDay && date.getDay() === bestDay.dayIndex;

  const promptSentence = bestDay
    ? `${DAY_FULL[bestDay.dayIndex]}s drive ${bestDay.sharePct}% of your RSVPs`
    : "";

  // ── NEEDS YOU rows ────────────────────────────────────────────────────
  const needsYouRows: React.ReactNode[] = [];
  for (const req of dashboard.hostRequests) {
    needsYouRows.push(
      <div
        key={`host-${req.planId}`}
        className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-[18px] border-b border-zinc-100 last:border-b-0"
      >
        <div className="flex-1 min-w-[180px]">
          <p className="text-[13px] font-medium text-zinc-900">
            {req.title} — <span className="text-amber-700">host request</span>
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {req.requesterName}
            {req.requestedDate &&
              ` · ${new Date(req.requestedDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
            {req.calendarName && ` · ${req.calendarName}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onApproveHostRequest(req)}
            className="px-3.5 py-2 min-h-[36px] bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => onEditHostRequest(req)}
            className="px-3.5 py-2 min-h-[36px] border border-zinc-300 text-zinc-900 rounded-full text-xs font-medium hover:bg-zinc-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDeclineHostRequest(req)}
            className="px-3.5 py-2 min-h-[36px] text-zinc-500 rounded-full text-xs font-medium hover:text-red-700 transition-colors"
          >
            Decline
          </button>
        </div>
      </div>,
    );
  }
  for (const req of dashboard.pendingRsvpRequests) {
    needsYouRows.push(
      <div
        key={`rsvp-${req.notificationId}`}
        className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-[18px] border-b border-zinc-100 last:border-b-0"
      >
        <div className="flex-1 min-w-[180px]">
          <p className="text-[13px] font-medium text-zinc-900">
            {req.name} wants to attend {req.planTitle}
          </p>
          {req.rsvpNote && (
            <p className="text-[11px] text-zinc-500 mt-0.5 italic truncate">
              &ldquo;{req.rsvpNote}&rdquo;
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onApproveRsvp(req)}
            className="px-3.5 py-2 min-h-[36px] bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => onDeclineRsvp(req)}
            className="px-3.5 py-2 min-h-[36px] border border-zinc-300 text-zinc-900 rounded-full text-xs font-medium hover:bg-zinc-50 transition-colors"
          >
            Decline
          </button>
        </div>
      </div>,
    );
  }
  for (const pf of dashboard.pendingFollowers) {
    needsYouRows.push(
      <div
        key={`pf-${pf.membershipId}`}
        className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-[18px] border-b border-zinc-100 last:border-b-0"
      >
        <div className="flex-1 min-w-[180px]">
          <p className="text-[13px] font-medium text-zinc-900">
            {pf.name} asked to follow
            {pf.calendarName ? ` ${pf.calendarName}` : ""}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Requested {new Date(pf.requestedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onApproveFollower(pf)}
            className="px-3.5 py-2 min-h-[36px] bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => onRejectFollower(pf)}
            className="px-3.5 py-2 min-h-[36px] border border-zinc-300 text-zinc-900 rounded-full text-xs font-medium hover:bg-zinc-50 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>,
    );
  }
  if (eventApprovalsCount > 0) {
    needsYouRows.push(
      <div
        key="event-approvals"
        className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-[18px] border-b border-zinc-100 last:border-b-0"
      >
        <div className="flex-1 min-w-[180px]">
          <p className="text-[13px] font-medium text-zinc-900">
            {eventApprovalsCount} business event{" "}
            {eventApprovalsCount === 1 ? "request" : "requests"} awaiting review
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            From nearby businesses that want on your calendar
          </p>
        </div>
        <a
          href={eventApprovalsHref}
          className="px-3.5 py-2 min-h-[36px] bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors shrink-0 inline-flex items-center"
        >
          Review
        </a>
      </div>,
    );
  }
  if (neverRsvpd > 0) {
    needsYouRows.push(
      <div
        key="never-rsvpd"
        className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-[18px] border-b border-zinc-100 last:border-b-0"
      >
        <div className="flex-1 min-w-[180px]">
          <p className="text-[13px] font-medium text-zinc-900">
            {neverRsvpd} follower{neverRsvpd === 1 ? " has " : "s have "}
            never RSVP&apos;d
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            See who they are and reach out
          </p>
        </div>
        <button
          onClick={() => onGoCommunity("never")}
          className="px-3.5 py-2 min-h-[36px] border border-zinc-300 text-zinc-900 rounded-full text-xs font-medium hover:bg-zinc-50 transition-colors shrink-0"
        >
          See them
        </button>
      </div>,
    );
  }

  // ── Spine entries (14 days, quiet stretches collapsed) ────────────────
  const spineEntries: React.ReactNode[] = [];
  {
    let i = 0;
    while (i < days.length) {
      const day = days[i];
      const isLast = i === days.length - 1;
      const dateLabel = day.date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      if (day.plans.length > 0) {
        spineEntries.push(
          <div
            key={localDayKey(day.date)}
            className={`relative border-l-2 border-zinc-900 pl-4 sm:pl-5 ${isLast ? "" : "pb-5"}`}
          >
            <span className="absolute -left-[7px] top-[3px] w-3 h-3 rounded-full bg-zinc-900" />
            <div className="sm:flex sm:gap-[18px]">
              <div className="sm:w-[92px] shrink-0">
                <p className="text-sm font-semibold text-zinc-900">
                  {dateLabel}
                </p>
                {i === 1 && (
                  <p className="text-[11px] text-zinc-400">Tomorrow</p>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-2 mt-2 sm:mt-0">
                {day.plans.map((plan) => (
                  <button
                    key={plan.objectId}
                    onClick={() => onOpenPlan(plan)}
                    className="w-full text-left border border-zinc-200 rounded-xl p-3 flex gap-3 items-center hover:bg-zinc-50 transition-colors"
                  >
                    <PlanCover
                      plan={plan}
                      className="w-14 h-[42px] rounded-[7px] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate">
                        {plan.title}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        {plan.time
                          ? `${formatWallClockTime12h(plan.time)} · `
                          : ""}
                        {hostLine(plan)} ·{" "}
                        {plan.isPoll
                          ? `${plan.pollVoteCount ?? 0} votes`
                          : `${plan.rsvpCount} going`}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>,
        );
        i++;
      } else if (emptyDayPrompt(day.date)) {
        spineEntries.push(
          <div
            key={localDayKey(day.date)}
            className={`relative border-l-2 border-leaf-300 pl-4 sm:pl-5 ${isLast ? "" : "pb-5"}`}
          >
            <span className="absolute -left-[7px] top-[3px] w-3 h-3 rounded-full bg-white border-2 border-leaf-600" />
            <div className="sm:flex sm:gap-[18px]">
              <div className="sm:w-[92px] shrink-0">
                <p className="text-sm font-semibold text-leaf-800">
                  {dateLabel}
                </p>
                <p className="text-[11px] text-leaf-700">Empty</p>
              </div>
              <div className="flex-1 min-w-0 mt-2 sm:mt-0">
                <div className="border border-dashed border-leaf-300 bg-leaf-50 rounded-xl p-3.5 flex flex-wrap gap-3 items-center">
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-medium text-leaf-800">
                      Your best day of the week is unbooked
                    </p>
                    <p className="text-xs text-leaf-700 mt-0.5">
                      {promptSentence}
                    </p>
                  </div>
                  <button
                    onClick={() => onNewPlan(toDateInputValue(day.date))}
                    className="px-4 py-2.5 min-h-[36px] bg-leaf-700 text-white rounded-full text-xs font-medium hover:bg-leaf-800 transition-colors"
                  >
                    Fill it
                  </button>
                </div>
              </div>
            </div>
          </div>,
        );
        i++;
      } else {
        // Collapse a run of consecutive quiet days into one row.
        let j = i;
        while (
          j < days.length &&
          days[j].plans.length === 0 &&
          !emptyDayPrompt(days[j].date)
        )
          j++;
        const from = days[i].date;
        const to = days[j - 1].date;
        const label =
          i === j - 1
            ? from.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
            : `${from.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })} – ${to.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}`;
        const lastRun = j >= days.length;
        spineEntries.push(
          <div
            key={`quiet-${localDayKey(from)}`}
            className={`relative border-l-2 border-zinc-100 pl-4 sm:pl-5 ${lastRun ? "" : "pb-5"}`}
          >
            <span className="absolute -left-[6px] top-[5px] w-2.5 h-2.5 rounded-full bg-zinc-200" />
            <div className="sm:flex sm:gap-[18px]">
              <div className="sm:w-[92px] shrink-0">
                <p className="text-[13px] font-medium text-zinc-400">{label}</p>
              </div>
              <p className="flex-1 text-xs text-zinc-400 pt-0.5">
                Quiet stretch · nothing scheduled
              </p>
            </div>
          </div>,
        );
        i = j;
      }
    }
  }

  // Counted from the rendered rows so the counter, header subtitle, and the
  // NEEDS YOU section can never disagree (the never-RSVP'd nudge is a row too).
  const needsYouCount = needsYouRows.length;

  return (
    <div>
      {/* Header row */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 lg:py-5 border-b border-zinc-100 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-lg lg:text-xl font-semibold tracking-[-0.01em] text-zinc-900">
            {title}
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {dashboard.calendars.length} calendar
            {dashboard.calendars.length === 1 ? "" : "s"} ·{" "}
            {dashboard.upcomingPlanCount} plan
            {dashboard.upcomingPlanCount === 1 ? "" : "s"} upcoming
            {needsYouCount > 0 &&
              ` · ${needsYouCount} thing${needsYouCount === 1 ? "" : "s"} need${needsYouCount === 1 ? "s" : ""} you`}
          </p>
        </div>
        <button
          onClick={() => onNewPlan()}
          className="hidden sm:inline-flex h-[38px] items-center px-[18px] bg-zinc-900 text-white rounded-full text-[13px] font-medium hover:bg-zinc-800 transition-colors"
        >
          + New plan
        </button>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-6">
        {topSlot}
        {/* Publish confirmation */}
        {publishBanner && (
          <div className="bg-leaf-50 border border-leaf-300 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <p className="flex-1 text-[13px] font-medium text-leaf-800">
              {publishBanner}
            </p>
          </div>
        )}

        {/* Counters — this calendar month, deltas vs last month */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <StatTile
            label="Plans this month"
            value={plansThisMonth}
            deltaPct={plansDelta}
          />
          <StatTile
            label="New followers this month"
            value={newFollowersThisMonth}
            deltaPct={followersDelta}
          />
          <StatTile
            label="RSVPs this month"
            value={dashboard.rsvpsThisMonth}
            deltaPct={rsvpsDelta}
          />
        </div>

        <div
          className={`mt-6 ${
            dashboard.recentPhotos.length > 0
              ? "lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6"
              : ""
          }`}
        >
          {/* Main column */}
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase mb-3.5">
              Next 14 days
            </p>
            <div>{spineEntries}</div>

            {/* NEEDS YOU */}
            <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase mt-6 mb-2.5">
              Needs you
            </p>
            {needsYouRows.length > 0 ? (
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                {needsYouRows}
              </div>
            ) : (
              <div className="border border-zinc-200 rounded-xl p-6 flex flex-wrap items-center gap-3">
                <p className="flex-1 text-sm font-medium text-zinc-900 min-w-[180px]">
                  Nothing needs you right now
                </p>
                <button
                  onClick={() => onNewPlan()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> New plan
                </button>
              </div>
            )}
          </div>

          {/* Right rail */}
          <div className="mt-6 lg:mt-0 space-y-3.5">
            {dashboard.recentPhotos.length > 0 && (
              <div className="border border-zinc-200 rounded-xl p-4">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase mb-2.5">
                  Recent photos
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {dashboard.recentPhotos.slice(0, 6).map((photo) =>
                    photo.url ? (
                      <a
                        key={photo.objectId}
                        href={photo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${photo.eventTitle} · ${photo.uploaderName}`}
                        className="block aspect-square rounded-md overflow-hidden bg-zinc-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt={`Photo from ${photo.eventTitle}`}
                          className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ) : null,
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
