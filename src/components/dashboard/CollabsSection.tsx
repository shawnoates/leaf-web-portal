"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Users, X } from "lucide-react";
import Parse from "@/lib/parse-client";
import SettingsSwitch from "@/components/SettingsSwitch";
import { track } from "@/lib/track";
import type { PlanPromotionRow } from "./types";

// Grow › Collabs — everything cross-promotion for the whole org:
//   Incoming     share requests waiting on us (Add / Skip) and plans other
//                communities put on our calendars (Remove)
//   Outgoing     where each of our shared plans went, with status and the
//                RSVPs it brought in
//   Settings     right-hand panel: per-calendar "accept share requests" switch,
//                who we auto-accept from, and who auto-accepts from us

interface CalendarPolicy {
  objectId: string;
  name: string;
  opt_out: boolean;
  accepts_from: { calendarId: string; name: string; shareId: string | null }[];
  accepted_by: { calendarId: string; name: string; shareId: string | null }[];
}

interface Payload {
  enabled: boolean;
  org: { objectId: string; name: string };
  calendars: CalendarPolicy[];
  incoming: PlanPromotionRow[];
  outgoing: PlanPromotionRow[];
}

function day(date: string | null, timezone: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  try {
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(timezone ? { timeZone: timezone } : {}) });
  } catch {
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
}

const STATUS_CHIP: Record<PlanPromotionRow["status"], { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  accepted: { label: "Added", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  declined: { label: "Skipped", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
  withdrawn: { label: "Withdrawn", cls: "bg-zinc-100 text-zinc-500 border-zinc-200" },
};

export default function CollabsSection({
  calendarId,
  onToast,
  onSharePlan,
  onPartnerPrompt,
}: {
  calendarId: string;
  onToast?: (msg: string) => void;
  /** Opens the share sheet for one of our plans (from the empty state). */
  onSharePlan?: () => void;
  /** After an Add: offer "Always accept from {source}". */
  onPartnerPrompt?: (promotionId: string, sourceName: string) => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = (await Parse.Cloud.run("listCalendarPromotions", { calendarId })) as Payload;
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load collabs");
    } finally {
      setLoading(false);
    }
  }, [calendarId]);

  useEffect(() => { load(); }, [load]);

  const decide = async (promo: PlanPromotionRow, accept: boolean) => {
    setBusy(promo.promotion_id);
    try {
      await Parse.Cloud.run("decidePlanPromotion", { promotionId: promo.promotion_id, accept });
      track("cross_promo_decided", { promotionId: promo.promotion_id, accept }, calendarId);
      onToast?.(accept ? `Added ${promo.plan.title}` : `Skipped ${promo.plan.title}`);
      if (accept && promo.source_calendar) onPartnerPrompt?.(promo.promotion_id, promo.source_calendar.name);
      await load();
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (promo: PlanPromotionRow, label: string) => {
    if (!confirm(`${label} ${promo.plan.title}?`)) return;
    setBusy(promo.promotion_id);
    try {
      await Parse.Cloud.run("withdrawPlanPromotion", { promotionId: promo.promotion_id });
      await load();
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const setPolicy = async (cal: CalendarPolicy, params: { optOut?: boolean; removePartnerId?: string }) => {
    setBusy(cal.objectId);
    try {
      await Parse.Cloud.run("setCrossPromoPolicy", { calendarId: cal.objectId, ...params });
      await load();
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center text-zinc-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  // The portal auto-deploys ahead of the server, so a missing cloud function
  // reads as "not on yet", not as a broken page.
  if (error || !data || !data.enabled) {
    return (
      <div className="border border-zinc-200 rounded-xl p-6 max-w-2xl">
        <h3 className="text-base font-medium text-zinc-900 mb-2">Cross-promotion</h3>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Cross-promote a plan to nearby communities and their followers can RSVP straight to you.
          It isn&apos;t switched on for your account yet.
        </p>
      </div>
    );
  }

  const pendingIn = data.incoming.filter((p) => p.status === "pending");
  const acceptedIn = data.incoming.filter((p) => p.status === "accepted");
  const multiCal = data.calendars.length > 1;

  // Outgoing grouped by plan.
  const byPlan = new Map<string, { plan: PlanPromotionRow["plan"]; from: string | null; rows: PlanPromotionRow[] }>();
  // A withdrawn chip is noise — the owner pulled it, nothing is left to act on.
  // Skipped stays: it tells the owner that calendar said no.
  for (const r of data.outgoing) {
    if (r.status === "withdrawn") continue;
    const k = r.plan.objectId;
    if (!byPlan.has(k)) byPlan.set(k, { plan: r.plan, from: r.source_calendar?.name ?? null, rows: [] });
    byPlan.get(k)!.rows.push(r);
  }

  const chip = (s: PlanPromotionRow["status"]) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider ${STATUS_CHIP[s].cls}`}>
      {STATUS_CHIP[s].label}
    </span>
  );

  return (
    <div className="max-w-5xl">
      <div>
        <h3 className="text-base font-medium text-zinc-900">Cross-promotion</h3>
        <p className="text-sm text-zinc-500 leading-relaxed mt-1">
          One plan, one guest list, more calendars. Open any upcoming plan and tap
          <span className="font-medium text-zinc-700"> Cross-promote</span>.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-8 min-w-0">
          {/* Incoming */}
          <section className="border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h4 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Cross-promoted to you</h4>
              {pendingIn.length > 0 && (
                <span className="text-[11px] text-amber-700 font-medium">{pendingIn.length} waiting</span>
              )}
            </div>
            {pendingIn.length === 0 && acceptedIn.length === 0 ? (
              <p className="px-4 py-5 text-sm text-zinc-400">Nothing cross-promoted to you yet.</p>
            ) : (
              <ul>
                {[...pendingIn, ...acceptedIn].map((p) => (
                  <li key={p.promotion_id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-zinc-100 last:border-b-0">
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-[13px] font-medium text-zinc-900">{p.plan.title}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {[
                          `from ${p.source_calendar?.name ?? "a community"}`,
                          day(p.plan.date, p.plan.timezone),
                          multiCal && p.target_calendar ? `to ${p.target_calendar.name}` : null,
                        ].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {p.status === "pending" ? (
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled={busy === p.promotion_id}
                          onClick={() => decide(p, true)}
                          className="px-3.5 py-1.5 min-h-[30px] bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                        >
                          Add
                        </button>
                        <button
                          disabled={busy === p.promotion_id}
                          onClick={() => decide(p, false)}
                          className="px-3.5 py-1.5 min-h-[30px] text-zinc-500 rounded-full text-xs font-medium hover:text-red-700 disabled:opacity-50 transition-colors"
                        >
                          Skip
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 shrink-0">
                        {chip(p.status)}
                        <button
                          disabled={busy === p.promotion_id}
                          onClick={() => withdraw(p, "Remove")}
                          className="p-1 text-zinc-400 hover:text-red-700 transition-colors"
                          aria-label="Remove from my calendar"
                          title="Remove from my calendar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Outgoing */}
          <section className="border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <h4 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Your cross-promotions</h4>
            </div>
            {byPlan.size === 0 ? (
              <div className="px-4 py-5 flex flex-wrap items-center gap-3">
                <p className="text-sm text-zinc-400 flex-1 min-w-[200px]">You haven&apos;t cross-promoted a plan yet.</p>
                {onSharePlan && (
                  <button
                    onClick={onSharePlan}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 min-h-[30px] bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" /> Cross-promote a plan
                  </button>
                )}
              </div>
            ) : (
              <ul>
                {[...byPlan.values()].map(({ plan, from, rows }) => {
                  const rsvps = rows.reduce((n, r) => n + (r.attributed_rsvps ?? 0), 0);
                  return (
                    <li key={plan.objectId} className="px-4 py-3 border-b border-zinc-100 last:border-b-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px]">
                          <p className="text-[13px] font-medium text-zinc-900">{plan.title}</p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            {[day(plan.date, plan.timezone), multiCal && from ? from : null, `${plan.rsvp_count} RSVP${plan.rsvp_count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {rsvps > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium shrink-0">
                            <Users className="w-3.5 h-3.5" /> {rsvps} via cross-promotion
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rows.map((r) => (
                          <span key={r.promotion_id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-zinc-200 text-[11px] text-zinc-700">
                            {r.target_calendar?.name ?? "Calendar"}
                            {chip(r.status)}
                            {(r.attributed_rsvps ?? 0) > 0 && <span className="text-emerald-700 font-medium">+{r.attributed_rsvps}</span>}
                            {(r.status === "pending" || r.status === "accepted") && (
                              <button
                                disabled={busy === r.promotion_id}
                                onClick={() => withdraw(r, "Withdraw from " + (r.target_calendar?.name ?? "this calendar") + ":")}
                                className="p-0.5 text-zinc-400 hover:text-red-700 transition-colors"
                                aria-label="Withdraw"
                                title="Withdraw"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Settings — partnerships + per-calendar opt-in */}
        <section className="border border-zinc-200 rounded-xl overflow-hidden lg:sticky lg:top-6">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h4 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-zinc-500">Settings</h4>
          </div>
          <ul>
            {data.calendars.map((cal) => (
              <li key={cal.objectId} className="px-4 py-4 border-b border-zinc-100 last:border-b-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-zinc-900">{cal.name}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Accept cross-promotion requests from other communities</p>
                  </div>
                  <div className="shrink-0 pt-0.5">
                    <SettingsSwitch
                      checked={!cal.opt_out}
                      disabled={busy === cal.objectId}
                      onChange={(v) => setPolicy(cal, { optOut: !v })}
                      label={`Accept cross-promotion requests on ${cal.name}`}
                    />
                  </div>
                </div>
                {cal.accepts_from.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Always accept from</p>
                    <div className="flex flex-wrap gap-2">
                      {cal.accepts_from.map((p) => (
                        <span key={p.calendarId} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-zinc-200 text-[11px] text-zinc-700">
                          {p.name}
                          <button
                            disabled={busy === cal.objectId}
                            onClick={() => setPolicy(cal, { removePartnerId: p.calendarId })}
                            className="p-0.5 text-zinc-400 hover:text-red-700 transition-colors"
                            aria-label={`Stop auto-accepting from ${p.name}`}
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {cal.accepted_by.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">Auto-accepts your plans</p>
                    <div className="flex flex-wrap gap-2">
                      {cal.accepted_by.map((p) => (
                        <span key={p.calendarId} className="inline-flex items-center px-2.5 py-1 rounded-full border border-zinc-200 text-[11px] text-zinc-700">
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
