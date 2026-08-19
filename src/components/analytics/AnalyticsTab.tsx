"use client";

import { Lightbulb, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { AnalyticsRange, OrgAnalytics } from "./types";

/**
 * The dashboard's Analytics tab.
 *
 * Extracted from `app/dashboard/[calendarId]/page.tsx` purely so recharts (the
 * single largest dependency in the route, ~200KB gzipped) can be code-split
 * behind `next/dynamic` and stay out of the first-paint bundle. Most owners are
 * on a free tier and never open this tab; the ones who do are already past the
 * initial load. Nothing here should be imported from the page module directly —
 * that would defeat the split.
 *
 * This component is presentational: all state and the `getOrgAnalytics` call
 * stay on the page so the fetch lifecycle isn't tied to the chunk's arrival.
 */

interface AnalyticsTabProps {
  analytics: OrgAnalytics | null;
  loading: boolean;
  error: string | null;
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  /** Sub-calendars for the filter dropdown. Empty/single hides the select. */
  calendars: { objectId: string; name: string; isActive: boolean }[];
  calFilter: string;
  onCalFilterChange: (id: string) => void;
  dismissedInsights: Set<string>;
  onDismissInsight: (key: string) => void;
}

const RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "all"];

const TOOLTIP_STYLE = {
  border: "1px solid #e4e4e7",
  borderRadius: 8,
  fontSize: 12,
} as const;

const AXIS_TICK = { fill: "#a1a1aa", fontSize: 11 } as const;

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// `unknown` rather than `string | number`: recharts types the tooltip's
// labelFormatter argument as ReactNode, so a narrower parameter isn't
// assignable there. The values we actually receive are the ISO date strings
// from `AnalyticsSeriesPoint.date`.
const longDate = (d: unknown) =>
  new Date(d as string | number).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export default function AnalyticsTab({
  analytics,
  loading,
  error,
  range,
  onRangeChange,
  calendars,
  calFilter,
  onCalFilterChange,
  dismissedInsights,
  onDismissInsight,
}: AnalyticsTabProps) {
  // Build a stable dismiss key from insight content. If the underlying insight
  // changes (e.g., top category flips from "dining" to "music"), the key
  // changes and the new one appears even if the prior was dismissed.
  const insightKey = (ins: { type: string; message: string }) =>
    `${ins.type}|${ins.message}`.slice(0, 200);

  return (
    <div className="space-y-8">
      {/* Range selector + calendar filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
            Analytics
          </h2>
          {calendars.length > 1 && (
            <select
              value={calFilter}
              onChange={(e) => onCalFilterChange(e.target.value)}
              className="text-xs border border-zinc-200 rounded-lg px-3 py-2 text-zinc-600 focus:outline-none focus:border-zinc-400"
            >
              <option value="all">All Calendars</option>
              {calendars.filter((c) => c.isActive).map((cal) => (
                <option key={cal.objectId} value={cal.objectId}>{cal.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-1 border border-zinc-200 rounded-lg p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-3 py-1.5 text-xs uppercase tracking-widest font-bold rounded-md transition-colors ${
                range === r
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {r === "all" ? "All time" : `Last ${r}`}
            </button>
          ))}
        </div>
      </div>

      {/* First load only. Once `analytics` exists we keep the charts mounted and
          dim them instead — swapping a full chart grid for a one-line spinner
          collapses the page height and springs it back, which reads as a
          flicker on every range change. */}
      {loading && !analytics && (
        <div className="border border-zinc-200 rounded-xl p-12 flex items-center justify-center text-zinc-400 text-sm">
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Loading analytics…
        </div>
      )}

      {/* Shown whether or not charts are on screen: a failed background
          revalidation still needs surfacing, but it shouldn't wipe out the
          last-good data underneath it. */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-sm text-red-700">
          {error}
        </div>
      )}

      {analytics && (
        <div
          className={`space-y-8 transition-opacity duration-200 ${
            loading ? "opacity-50" : "opacity-100"
          }`}
          aria-busy={loading}
        >
          {/* Insights / recommendations (no_growth lives on the Followers tab) */}
          {(() => {
            const filtered = analytics.insights
              .filter((ins) => ins.type !== "no_growth")
              .filter((ins) => !dismissedInsights.has(insightKey(ins)));
            if (filtered.length === 0) return null;
            return (
              <section className="space-y-2">
                {filtered.map((ins) => {
                  const key = insightKey(ins);
                  return (
                    <div
                      key={key}
                      className="border border-emerald-200 bg-emerald-50/40 rounded-lg px-3 py-2 flex items-center gap-3"
                    >
                      <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center flex-shrink-0">
                        <Lightbulb className="w-3 h-3" />
                      </div>
                      <p className="text-xs text-zinc-700 leading-snug flex-1">
                        {ins.message}
                      </p>
                      <button
                        onClick={() => onDismissInsight(key)}
                        className="text-xs uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-700 transition-colors flex-shrink-0"
                      >
                        Dismiss
                      </button>
                    </div>
                  );
                })}
              </section>
            );
          })()}

          {/* Growth headline stats */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
              Growth
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                {
                  label: "Page Views",
                  value: analytics.growth.pageViewCount,
                  delta: analytics.growth.pageViewsInRange,
                  deltaPct: analytics.growth.pageViewDeltaPct,
                },
                {
                  label: "Followers",
                  value: analytics.growth.followerCount,
                  delta: analytics.growth.followersInRange,
                  deltaPct: analytics.growth.followerDeltaPct,
                },
                {
                  label: "Members",
                  value: analytics.growth.memberCount,
                  delta: analytics.growth.membersInRange,
                  deltaPct: null,
                },
                {
                  label: "RSVPs",
                  value: analytics.engagement.rsvpCount,
                  delta: analytics.growth.rsvpsInRange,
                  deltaPct: analytics.growth.rsvpDeltaPct,
                },
                {
                  label: "Upcoming Plans",
                  value: analytics.engagement.planCount,
                  delta: null,
                  deltaPct: null,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="border border-zinc-200 rounded-xl p-4"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-light">{stat.value}</p>
                  {stat.delta != null && (
                    <p
                      className={`text-[11px] mt-1 ${
                        stat.deltaPct == null
                          ? "text-zinc-400"
                          : stat.deltaPct >= 0
                          ? "text-emerald-600"
                          : "text-red-500"
                      }`}
                    >
                      {stat.deltaPct == null
                        ? `+${stat.delta} this period`
                        : `${stat.deltaPct >= 0 ? "+" : ""}${stat.deltaPct}% vs prev`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Followers over time */}
          <section className="border border-zinc-200 rounded-xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
              Followers over time
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.growth.followerSeries}>
                  <CartesianGrid stroke="#f4f4f5" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={shortDate}
                    minTickGap={30}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={longDate} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#18181b"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Page views over time */}
          <section className="border border-zinc-200 rounded-xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
              Page views over time
            </h3>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.growth.pageViewSeries}>
                  <CartesianGrid stroke="#f4f4f5" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={shortDate}
                    minTickGap={30}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={longDate} />
                  <Bar dataKey="value" fill="#18181b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* RSVPs by day of week + time of day */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="border border-zinc-200 rounded-xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                RSVPs by day of week
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.whatsWorking.weekdayDistribution}>
                    <CartesianGrid stroke="#f4f4f5" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={30}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="value" fill="#18181b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="border border-zinc-200 rounded-xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                RSVPs by time of day
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.whatsWorking.timeOfDayDistribution}>
                    <CartesianGrid stroke="#f4f4f5" vertical={false} />
                    <XAxis
                      dataKey="bucket"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(s: string) =>
                        s.charAt(0).toUpperCase() + s.slice(1)
                      }
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      labelFormatter={(s) => {
                        const str = String(s ?? "");
                        return str.charAt(0).toUpperCase() + str.slice(1);
                      }}
                    />
                    <Bar dataKey="value" fill="#18181b" radius={[6, 6, 0, 0]}>
                      {analytics.whatsWorking.timeOfDayDistribution.map((_, i) => (
                        <Cell key={i} fill="#18181b" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          {/* Posting lead time — avg RSVPs per plan by how far ahead it was
              posted (completed plans only, computed server-side). */}
          {(() => {
            const leadDist = analytics.whatsWorking.leadTimeDistribution || [];
            const totalLeadPlans = leadDist.reduce((a, b) => a + b.plans, 0);
            if (totalLeadPlans === 0) return null;
            const arrival = analytics.whatsWorking.rsvpArrival;
            return (
              <section className="border border-zinc-200 rounded-xl p-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">
                  RSVPs by posting lead time
                </h3>
                <p className="text-[11px] text-zinc-400 mb-4">
                  Average RSVPs per completed plan, by how far ahead it was posted
                </p>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leadDist}>
                      <CartesianGrid stroke="#f4f4f5" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, _name, entry) => {
                          const row = entry?.payload as { plans?: number } | undefined;
                          return [
                            `${value} avg RSVPs (${row?.plans ?? 0} plan${row?.plans === 1 ? "" : "s"})`,
                            null,
                          ];
                        }}
                      />
                      <Bar dataKey="avgRsvps" fill="#18181b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {arrival && (
                  <p className="text-[11px] text-zinc-500 mt-3">
                    Half of your RSVPs arrive within{" "}
                    {arrival.medianLeadDays <= 1
                      ? "a day"
                      : `${Math.round(arrival.medianLeadDays)} days`}{" "}
                    of the event · {arrival.withinTwoDaysPct}% come in the final 48 hours
                  </p>
                )}
              </section>
            );
          })()}

          {/* Engagement summary */}
          <section className="border border-zinc-200 rounded-xl p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
              Engagement
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">
                  Avg RSVPs / plan
                </p>
                <p className="text-2xl font-light">{analytics.engagement.rsvpRate}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">
                  Attendance
                </p>
                <p className="text-2xl font-light">
                  {analytics.engagement.attendanceRate}%
                  <span className="text-sm text-zinc-400 ml-1">
                    ({analytics.engagement.attendanceCount}/{analytics.engagement.rsvpCount})
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">
                  Repeat attendees
                </p>
                <p className="text-2xl font-light">
                  {analytics.engagement.repeatAttendeeCount}
                  <span className="text-sm text-zinc-400 ml-1">
                    / {analytics.engagement.uniqueRsvpUsersInRange}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-zinc-400 mb-1">
                  Repeat rate
                </p>
                <p className="text-2xl font-light">
                  {Math.round(analytics.engagement.repeatRate * 100)}%
                </p>
              </div>
            </div>
          </section>

          {/* Top plans */}
          {analytics.engagement.topPlans.length > 0 && (
            <section className="border border-zinc-200 rounded-xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                Top plans
              </h3>
              <div className="space-y-2">
                {analytics.engagement.topPlans.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 py-2 border-b border-zinc-100 last:border-0"
                  >
                    <span className="text-xs text-zinc-400 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-900 truncate">{p.title}</p>
                      <p className="text-[11px] text-zinc-400">{p.category}</p>
                    </div>
                    <span className="text-sm font-medium text-zinc-900">
                      {p.rsvpCount} RSVP{p.rsvpCount === 1 ? "" : "s"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Top categories */}
          {analytics.whatsWorking.topCategories.length > 0 && (
            <section className="border border-zinc-200 rounded-xl p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-4">
                Top categories
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.whatsWorking.topCategories}
                    layout="vertical"
                  >
                    <CartesianGrid stroke="#f4f4f5" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="rsvps" fill="#18181b" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
