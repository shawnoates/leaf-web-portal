"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import type { AnalyticsRange, OrgAnalytics } from "@/components/analytics/types";

// Grow › Performance — analytics rebuilt as three answers instead of a scroll
// of charts. Five counters up top, then WHEN TO POST / HOW FAR AHEAD /
// WHO COMES BACK sentence cards with small inline charts, and an "All charts"
// disclosure that mounts the legacy chart set (passed in as `allCharts`) —
// nothing is deleted, only demoted.

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

const RANGES: { id: AnalyticsRange; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "all", label: "All" },
];

function Delta({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span
      className={`text-[11px] font-medium ${value > 0 ? "text-emerald-700" : "text-zinc-400"}`}
    >
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}

export default function GrowPerformance({
  analytics,
  loading,
  error,
  range,
  onRangeChange,
  onRetry,
  neverRsvpdCount,
  rsvpWindowDays,
  onNewPlan,
  onGoCommunity,
  allCharts,
}: {
  analytics: OrgAnalytics | null;
  loading: boolean;
  error: string | null;
  range: AnalyticsRange;
  onRangeChange: (r: AnalyticsRange) => void;
  onRetry: () => void;
  neverRsvpdCount: number;
  /** Bound on the RSVP tallies `neverRsvpdCount` comes from — the copy below
   *  must not imply a lifetime count. */
  rsvpWindowDays: number;
  onNewPlan: (dayIndex?: number) => void;
  onGoCommunity: (segment: "never") => void;
  allCharts: React.ReactNode;
}) {
  const [chartsOpen, setChartsOpen] = useState(false);
  // "See the data" opens the charts section, which lives below the fold —
  // without a scroll the click looks like a no-op.
  const [scrollToCharts, setScrollToCharts] = useState(false);
  const chartsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollToCharts && chartsOpen) {
      chartsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToCharts(false);
    }
  }, [scrollToCharts, chartsOpen]);

  const weekday = useMemo(() => {
    if (!analytics?.whatsWorking?.weekdayDistribution?.length) return null;
    const counts = new Array(7).fill(0);
    for (const d of analytics.whatsWorking.weekdayDistribution) {
      const idx = DAY_SHORT.findIndex((s) =>
        d.day.toLowerCase().startsWith(s.toLowerCase()),
      );
      if (idx >= 0) counts[idx] += d.value;
    }
    const total = counts.reduce((a: number, b: number) => a + b, 0);
    if (total === 0) return null;
    let best = 0;
    for (let i = 1; i < 7; i++) if (counts[i] > counts[best]) best = i;
    return {
      counts,
      max: counts[best],
      bestIndex: best,
      sharePct: Math.round((counts[best] / total) * 100),
    };
  }, [analytics]);

  const leadTime = useMemo(() => {
    const dist = analytics?.whatsWorking?.leadTimeDistribution;
    if (!dist || dist.length === 0) return null;
    const withPlans = dist.filter((b) => b.plans > 0);
    if (withPlans.length === 0) return null;
    const best = withPlans.reduce((a, b) => (b.avgRsvps > a.avgRsvps ? b : a));
    const maxAvg = Math.max(...dist.map((b) => b.avgRsvps), 0.001);
    return { dist, best, maxAvg };
  }, [analytics]);

  const repeat = useMemo(() => {
    if (!analytics) return null;
    const unique = analytics.engagement.uniqueRsvpUsersInRange;
    const repeaters = analytics.engagement.repeatAttendeeCount;
    if (unique === 0 && neverRsvpdCount === 0) return null;
    const once = Math.max(0, unique - repeaters);
    const max = Math.max(neverRsvpdCount, once, repeaters, 1);
    return { unique, repeaters, once, max };
  }, [analytics, neverRsvpdCount]);

  if (loading && !analytics) {
    return (
      <div className="border border-zinc-200 rounded-xl p-12 flex items-center justify-center text-zinc-400 text-sm">
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading performance…
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="border border-zinc-200 rounded-xl p-10 text-center">
        <p className="text-[13px] text-zinc-500">
          Couldn&apos;t load this.{" "}
          <button onClick={onRetry} className="underline hover:text-zinc-900">
            Retry
          </button>
        </p>
      </div>
    );
  }

  if (!analytics) return null;

  const g = analytics.growth;
  const e = analytics.engagement;

  return (
    <div>
      {/* Range control */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-zinc-500">
          All calendars ·{" "}
          {range === "all" ? "all time" : `last ${range.replace("d", " days")}`}
        </p>
        <div className="flex border border-zinc-200 rounded-full overflow-hidden text-[11px] font-medium">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => onRangeChange(r.id)}
              className={`px-3.5 py-2 transition-colors ${
                range === r.id
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="border border-zinc-200 rounded-xl p-3.5">
          <p className="text-[10px] text-zinc-500 uppercase">Page views</p>
          <p className="text-[21px] font-semibold text-zinc-900 mt-1">
            {g.pageViewsInRange}
          </p>
          <Delta value={g.pageViewDeltaPct} />
        </div>
        <div className="border border-zinc-200 rounded-xl p-3.5">
          <p className="text-[10px] text-zinc-500 uppercase">Followers</p>
          <p className="text-[21px] font-semibold text-zinc-900 mt-1">
            {g.followerCount}
          </p>
          <Delta value={g.followerDeltaPct} />
        </div>
        <div className="border border-zinc-200 rounded-xl p-3.5">
          <p className="text-[10px] text-zinc-500 uppercase">RSVPs</p>
          <p className="text-[21px] font-semibold text-zinc-900 mt-1">
            {g.rsvpsInRange}
          </p>
          <Delta value={g.rsvpDeltaPct} />
        </div>
        <div className="border border-zinc-200 rounded-xl p-3.5">
          <p className="text-[10px] text-zinc-500 uppercase">Attendance</p>
          {/* Wire quirk: `attendanceRate` arrives as a percent (31), while
              `repeatRate` below is a fraction (0.17) — mirror AnalyticsTab. */}
          <p className="text-[21px] font-semibold text-zinc-900 mt-1">
            {Math.round(e.attendanceRate)}%
          </p>
          <p className="text-[11px] text-zinc-400">
            {e.attendanceCount} of {e.rsvpCount}
          </p>
        </div>
        <div className="border border-zinc-200 rounded-xl p-3.5">
          <p className="text-[10px] text-zinc-500 uppercase">Repeat rate</p>
          <p className="text-[21px] font-semibold text-zinc-900 mt-1">
            {Math.round(e.repeatRate * 100)}%
          </p>
          <p className="text-[11px] text-zinc-400">
            {e.repeatAttendeeCount} of {e.uniqueRsvpUsersInRange}
          </p>
        </div>
      </div>

      {/* Answer cards */}
      <div className="mt-5 space-y-3">
        {/* WHEN TO POST */}
        {weekday && (
          <div className="border border-zinc-200 rounded-xl p-4 sm:p-5 lg:px-[22px] lg:flex lg:gap-7 lg:items-center">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                When to post
              </p>
              <p className="text-[15px] lg:text-lg font-medium leading-[1.45] lg:leading-[1.4] text-zinc-900 mt-2">
                {DAY_FULL[weekday.bestIndex]}s are your slot. They carry{" "}
                <span className="border-b-2 border-emerald-500">
                  {weekday.sharePct}% of RSVPs
                </span>
                .
              </p>
              <div className="mt-3.5 flex gap-2">
                <button
                  onClick={() => onNewPlan(weekday.bestIndex)}
                  className="px-4 py-2.5 min-h-[36px] bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
                >
                  Plan a {DAY_FULL[weekday.bestIndex]}
                </button>
                <button
                  onClick={() => {
                    setChartsOpen(true);
                    setScrollToCharts(true);
                  }}
                  className="px-4 py-2.5 min-h-[36px] border border-zinc-200 text-zinc-600 rounded-full text-xs font-medium hover:border-zinc-300 transition-colors"
                >
                  See the data
                </button>
              </div>
            </div>
            <div className="mt-4 lg:mt-0 w-full lg:w-[280px] shrink-0">
              <div className="flex gap-2 items-end h-24">
                {weekday.counts.map((v: number, i: number) => {
                  const isBest = i === weekday.bestIndex;
                  const h =
                    v === 0
                      ? 4
                      : Math.max(6, Math.round((v / weekday.max) * 96));
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col justify-end h-full"
                    >
                      <div
                        className={`rounded-[3px] ${
                          v === 0
                            ? "bg-zinc-100"
                            : isBest
                              ? "bg-zinc-900"
                              : "bg-zinc-300"
                        }`}
                        style={{ height: `${h}px` }}
                      />
                      <p
                        className={`text-[9px] font-medium text-center mt-1.5 uppercase ${isBest ? "text-zinc-900" : "text-zinc-400"}`}
                      >
                        {DAY_SHORT[i]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* HOW FAR AHEAD */}
        {leadTime && (
          <div className="border border-zinc-200 rounded-xl p-4 sm:p-5 lg:px-[22px] lg:flex lg:gap-7 lg:items-center">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                How far ahead
              </p>
              <p className="text-[15px] lg:text-lg font-medium leading-[1.45] lg:leading-[1.4] text-zinc-900 mt-2">
                Plans posted {leadTime.best.label.toLowerCase()} average{" "}
                <span className="border-b-2 border-emerald-500">
                  {leadTime.best.avgRsvps.toFixed(1)} RSVPs
                </span>
                .
              </p>
              <p className="text-xs text-zinc-500 mt-2">
                Posting earlier gives followers time to plan around you.
              </p>
            </div>
            <div className="mt-4 lg:mt-0 w-full lg:w-[280px] shrink-0">
              <div className="flex gap-2 items-end h-24">
                {leadTime.dist.map((b) => {
                  const isBest = b.bucket === leadTime.best.bucket;
                  const h =
                    b.avgRsvps === 0
                      ? 3
                      : Math.max(
                          6,
                          Math.round((b.avgRsvps / leadTime.maxAvg) * 96),
                        );
                  return (
                    <div
                      key={b.bucket}
                      className="flex-1 flex flex-col justify-end h-full"
                    >
                      <div
                        className={`rounded-[3px] ${
                          b.avgRsvps === 0
                            ? "bg-zinc-100"
                            : isBest
                              ? "bg-zinc-900"
                              : "bg-zinc-300"
                        }`}
                        style={{ height: `${h}px` }}
                      />
                      <p
                        className={`text-[9px] font-medium text-center mt-1.5 uppercase ${isBest ? "text-zinc-900" : "text-zinc-400"}`}
                      >
                        {b.bucket}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* WHO COMES BACK */}
        {repeat && (
          <div className="border border-zinc-200 rounded-xl p-4 sm:p-5 lg:px-[22px] lg:flex lg:gap-7 lg:items-center">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-500 uppercase">
                Who comes back
              </p>
              <p className="text-[15px] lg:text-lg font-medium leading-[1.45] lg:leading-[1.4] text-zinc-900 mt-2">
                {repeat.unique > 0 ? (
                  <>
                    Only{" "}
                    <span className="border-b-2 border-red-400">
                      {repeat.repeaters} of {repeat.unique}
                    </span>{" "}
                    attendees returned for a second plan.
                  </>
                ) : (
                  <>Nobody has RSVP&apos;d in this window yet.</>
                )}
              </p>
              {neverRsvpdCount > 0 && (
                <p className="text-xs text-zinc-500 mt-2">
                  {neverRsvpdCount} follower
                  {neverRsvpdCount === 1 ? " hasn't " : "s haven't "}RSVP&apos;d
                  to anything in the last {rsvpWindowDays} days.
                </p>
              )}
              {neverRsvpdCount > 0 && (
                <div className="mt-3.5 flex gap-2">
                  <button
                    onClick={() => onGoCommunity("never")}
                    className="px-4 py-2.5 min-h-[36px] bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
                  >
                    See the {neverRsvpdCount}
                  </button>
                </div>
              )}
            </div>
            <div className="mt-4 lg:mt-0 w-full lg:w-[280px] shrink-0 space-y-2.5">
              {[
                {
                  label: "Followed, no recent RSVP",
                  value: neverRsvpdCount,
                  fill: "bg-zinc-400",
                },
                { label: "RSVP'd once", value: repeat.once, fill: "bg-zinc-500" },
                {
                  label: "Came twice or more",
                  value: repeat.repeaters,
                  fill: "bg-zinc-900",
                },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-[11px] text-zinc-500 mb-1">
                    <span>{row.label}</span>
                    <span className="text-zinc-900 font-medium">
                      {row.value}
                    </span>
                  </div>
                  <div className="h-[7px] bg-zinc-100 rounded overflow-hidden">
                    <div
                      className={`h-full ${row.fill}`}
                      style={{
                        width: `${Math.round((row.value / repeat.max) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All charts disclosure */}
      <button
        onClick={() => setChartsOpen((v) => !v)}
        className="w-full mt-5 border border-zinc-200 rounded-xl px-4 sm:px-5 py-4 flex items-center gap-3 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-zinc-900">All charts</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Followers over time, page views, RSVPs by day and hour, lead time,
            top plans, top categories
          </p>
        </div>
        <span className="text-xs font-medium text-zinc-900 shrink-0 inline-flex items-center gap-1">
          {chartsOpen ? "Collapse" : "Expand"}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${chartsOpen ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {chartsOpen && (
        <div ref={chartsRef} className="mt-5 scroll-mt-4">
          {allCharts}
        </div>
      )}
    </div>
  );
}
