"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { renderLinkedText } from "@/lib/linkify";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  EyeOff,
  MessageCircle,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  Users,
  Vote,
  X,
} from "lucide-react";

export type PlanDetailData = {
  objectId: string;
  title: string;
  description: string;
  image: string | null;
  date: string | null;
  /** Venue's IANA timezone (e.g. "America/New_York"). Used by the edit
   *  pre-fill so a cross-zone editor sees the plan's wall-clock, not their
   *  own. Falls back to viewer-local when null. */
  timezone: string | null;
  time: string | null;
  hostName: string;
  rsvpCount: number;
  location: { name: string; address: string } | null;
  /** Full itinerary from the API (matches `getOrgCalendarPage.plans[i].locations`).
   * Present when the plan has multiple stops from an iOS multi-stop edit; the
   * dashboard's edit modal uses this to hydrate `additionalStops`. */
  locations?: {
    objectId?: string | null;
    name: string | null;
    address: string | null;
    isPrivate?: boolean;
    time?: string | null;
  }[];
  isPoll?: boolean;
  pollOptionCount?: number;
  pollClosesAt?: string | null;
  pollVoteCount?: number;
  hideVenueUntilRsvp?: boolean;
  requireApproval?: boolean;
  /** When set, this plan was materialized from a recurring PlanSeries. The
   *  modal exposes a "Cancel future occurrences" action that stops further
   *  materialization without touching already-created instances. */
  planSeriesId?: string | null;
};

type PollOptionDetail = { date: string; time: string | null; count: number };
type PollVoter = {
  name: string;
  phone: string | null;
  selectedDateTimes: { date: string; time: string | null }[];
};

type Rsvp = {
  notificationId: string;
  name: string;
  phone: string | null;
  sharePhoneWithHost: boolean;
  source: string;
  status: string;
  rsvpNote: string | null;
};

type Props = {
  plan: PlanDetailData;
  onClose: () => void;
  /** Called after any change that should refresh parent data (cancel, approve, decline, remove, pick-poll-winner). */
  onChanged: () => void;
  /** Open the create modal in duplicate mode. Receives current poll options when this is a poll plan. */
  onDuplicate: (plan: PlanDetailData, pollOptions?: { date: string; time: string }[]) => void;
  /** Open the create modal in edit mode. Receives current poll options + close date when this is a poll plan. */
  onEdit: (plan: PlanDetailData, pollOptions?: { date: string; time: string }[], pollClosesAt?: string) => void;
  /** Open the create modal in poll-convert mode, pre-filled with the poll's
   *  current data and the winning date. The owner reviews/edits and optionally
   *  toggles Repeats; submission calls convertPollToPlan. */
  onConvertPoll?: (plan: PlanDetailData, winningDate: string, winningTime: string | null) => void;
  /**
   * If false, Duplicate calls `onConnectApp` instead of `onDuplicate` (used by the dashboard
   * to gate duplication behind the iOS-app pairing flow). Defaults to true.
   */
  leafAppConnected?: boolean;
  onConnectApp?: () => void;
  /** Optional callback when a pending RSVP is approved/declined — lets the parent reconcile its
   *  pendingRsvpRequests list without a full refetch. */
  onPendingRsvpResolved?: (notificationId: string) => void;
};

export default function PlanDetailModal({
  plan,
  onClose,
  onChanged,
  onDuplicate,
  onEdit,
  onConvertPoll,
  leafAppConnected = true,
  onConnectApp,
  onPendingRsvpResolved,
}: Props) {
  const [pollDetail, setPollDetail] = useState<{
    options: PollOptionDetail[];
    totalVotes: number;
    isExpired: boolean;
    voters: PollVoter[];
    canSeeVoters: boolean;
  } | null>(null);
  const [pollDetailLoading, setPollDetailLoading] = useState(false);
  const [closingPoll, setClosingPoll] = useState(false);
  const [planRsvps, setPlanRsvps] = useState<Rsvp[]>([]);
  const [planRsvpsLoading, setPlanRsvpsLoading] = useState(false);
  const [planRsvpsError, setPlanRsvpsError] = useState<string | null>(null);
  const [planRsvpsRefreshTick, setPlanRsvpsRefreshTick] = useState(0);

  // Change-host picker (owner/co-host reassigns this plan's host to a
  // follower/member, or themselves). Candidates load on open; the override
  // reflects the new host name immediately without waiting for a parent refetch.
  const [showChangeHost, setShowChangeHost] = useState(false);
  const [hostCandidates, setHostCandidates] = useState<
    { id: string; name: string; isCurrentHost: boolean; isSelf: boolean }[] | null
  >(null);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [changingHostId, setChangingHostId] = useState<string | null>(null);
  const [changeHostError, setChangeHostError] = useState<string | null>(null);
  const [hostNameOverride, setHostNameOverride] = useState<string | null>(null);

  // Load attendees for non-poll plans. Re-fires when the parent triggers a
  // refresh (planRsvpsRefreshTick) so RSVPs that land after the modal
  // opened get picked up. Errors used to be swallowed silently, which
  // masked auth failures and any server-side inconsistency; we now log
  // them and surface a short message so the "Attendees (1)" state has an
  // explanation when it doesn't match reality.
  useEffect(() => {
    if (plan.isPoll) {
      setPlanRsvps([]);
      return;
    }
    setPlanRsvpsLoading(true);
    setPlanRsvpsError(null);
    // Log the plan id we're querying so the user can grep it out of the
    // devtools console when app RSVPs aren't showing up — quicker than
    // rooting around the URL for the EventGroup objectId.
    console.info("[PlanDetailModal] getPlanRsvps →", plan.objectId);
    Parse.Cloud.run("getPlanRsvps", { eventGroupId: plan.objectId })
      .then((result: Rsvp[]) => {
        console.info(
          "[PlanDetailModal] getPlanRsvps result",
          plan.objectId,
          result
        );
        setPlanRsvps(result || []);
      })
      .catch((err: unknown) => {
        console.error("[PlanDetailModal] getPlanRsvps failed:", err);
        setPlanRsvps([]);
        setPlanRsvpsError(
          err instanceof Error ? err.message : "Failed to load attendees."
        );
      })
      .finally(() => setPlanRsvpsLoading(false));
  }, [plan.objectId, plan.isPoll, planRsvpsRefreshTick]);

  // Load poll detail for poll plans.
  useEffect(() => {
    if (!plan.isPoll) {
      setPollDetail(null);
      return;
    }
    setPollDetailLoading(true);
    Parse.Cloud.run("getCalendarDatePollForGuest", { eventGroupId: plan.objectId })
      .then((result: {
        poll: { options: PollOptionDetail[]; totalVotes: number; isExpired: boolean };
        voters?: PollVoter[];
        canSeeVoters?: boolean;
      }) => {
        setPollDetail({
          options: result.poll.options || [],
          totalVotes: result.poll.totalVotes || 0,
          isExpired: result.poll.isExpired || false,
          voters: result.voters || [],
          canSeeVoters: !!result.canSeeVoters,
        });
      })
      .catch(() => setPollDetail(null))
      .finally(() => setPollDetailLoading(false));
  }, [plan.objectId, plan.isPoll]);

  const handleDuplicate = () => {
    if (!leafAppConnected && onConnectApp) {
      onConnectApp();
      return;
    }
    const pollOptions = plan.isPoll
      ? pollDetail?.options.map((o) => ({ date: o.date, time: o.time || "" }))
      : undefined;
    onDuplicate(plan, pollOptions);
  };

  const handleEdit = () => {
    if (plan.isPoll) {
      const closesAtYmd = plan.pollClosesAt
        ? new Date(plan.pollClosesAt).toISOString().slice(0, 10)
        : undefined;
      const pollOptions = pollDetail?.options.map((o) => ({ date: o.date, time: o.time || "" }));
      onEdit(plan, pollOptions, closesAtYmd);
      return;
    }
    onEdit(plan);
  };

  const openChangeHost = async () => {
    setShowChangeHost(true);
    setChangeHostError(null);
    if (hostCandidates) return; // already loaded
    setLoadingCandidates(true);
    try {
      const res = await Parse.Cloud.run("getPlanHostCandidates", { eventGroupId: plan.objectId });
      setHostCandidates(res?.candidates || []);
    } catch (err) {
      setChangeHostError(err instanceof Error ? err.message : "Couldn't load people to assign");
      setHostCandidates([]);
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleChangeHost = async (candidate: { id: string; name: string }) => {
    setChangingHostId(candidate.id);
    setChangeHostError(null);
    try {
      const res = await Parse.Cloud.run("changePlanHost", {
        eventGroupId: plan.objectId,
        newHostUserId: candidate.id,
      });
      setHostNameOverride(res?.hostName || candidate.name);
      // Reflect the new current-host flag in the loaded candidate list.
      setHostCandidates((prev) =>
        prev ? prev.map((c) => ({ ...c, isCurrentHost: c.id === candidate.id })) : prev
      );
      setShowChangeHost(false);
      onChanged();
    } catch (err) {
      setChangeHostError(err instanceof Error ? err.message : "Couldn't change the host");
    } finally {
      setChangingHostId(null);
    }
  };

  const handleCancel = async () => {
    const isPoll = !!plan.isPoll;
    const confirmMsg = isPoll
      ? "Cancel this poll? Voters won't be notified. This cannot be undone."
      : plan.planSeriesId
        ? "Cancel just this occurrence? Future occurrences will continue. This cannot be undone."
        : "Cancel this plan? Attendees will be notified. This cannot be undone.";
    if (!confirm(confirmMsg)) return;
    try {
      await Parse.Cloud.run("removePlanFromCalendar", { eventGroupId: plan.objectId });
      onClose();
      onChanged();
    } catch (err) {
      console.error("Failed to cancel:", err);
      alert(isPoll ? "Failed to cancel poll." : "Failed to cancel plan.");
    }
  };

  const handleCancelSeries = async () => {
    if (!plan.planSeriesId) return;
    if (!confirm("End this recurring series? Already-created occurrences stay; no new ones will be scheduled. This cannot be undone.")) return;
    try {
      await Parse.Cloud.run("cancelPlanSeries", { planSeriesId: plan.planSeriesId });
      onClose();
      onChanged();
    } catch (err) {
      console.error("Failed to cancel series:", err);
      alert(err instanceof Error ? err.message : "Failed to end series.");
    }
  };

  const handlePickPollWinner = async (opt: PollOptionDetail, dateLabel: string, timeLabel: string | null) => {
    // Newer flow: open the create modal pre-filled with the poll's data + the
    // winning date so the owner can edit copy/venue/image and optionally toggle
    // Repeats. Falls back to the legacy inline conversion if the parent didn't
    // wire onConvertPoll (e.g. /plans page hasn't been updated yet).
    if (onConvertPoll) {
      onConvertPoll(plan, opt.date, opt.time);
      return;
    }
    if (!confirm(`Pick ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}? All followers will be SMS'd to RSVP.`)) return;
    setClosingPoll(true);
    try {
      await Parse.Cloud.run("closeAndConvertPoll", {
        eventGroupId: plan.objectId,
        winningDate: opt.date,
        winningTime: opt.time || undefined,
      });
      onClose();
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to close poll.");
    } finally {
      setClosingPoll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] md:h-[85vh] md:max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/20 text-white md:text-zinc-900 md:bg-transparent"
        >
          <Plus className="w-8 h-8 rotate-45" />
        </button>

        <div className="hidden md:block w-1/2 h-full bg-zinc-100">
          {plan.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={plan.image} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Calendar className="w-20 h-20 text-zinc-300" />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-12">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-light tracking-tighter">
              {plan.title}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                Hosted by {hostNameOverride || plan.hostName}
              </p>
              {!plan.isPoll && (
                <button
                  onClick={openChangeHost}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 underline underline-offset-2 transition-colors"
                >
                  Change host
                </button>
              )}
            </div>

            {/* Change-host picker — owner/co-host reassigns hosting to a
                follower/member (or themselves). Inline so it stays in the
                detail context. */}
            {showChangeHost && (
              <div className="border border-zinc-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Assign hosting to
                  </p>
                  <button
                    onClick={() => setShowChangeHost(false)}
                    className="p-1 rounded-full hover:bg-zinc-100 transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
                {changeHostError && (
                  <p className="text-xs text-red-500 px-4 pt-3">{changeHostError}</p>
                )}
                <div className="max-h-64 overflow-y-auto p-1">
                  {loadingCandidates ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                    </div>
                  ) : hostCandidates && hostCandidates.length > 0 ? (
                    hostCandidates.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { if (!c.isCurrentHost) handleChangeHost(c); }}
                        disabled={!!changingHostId || c.isCurrentHost}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                            <Users className="w-3.5 h-3.5 text-zinc-400" />
                          </span>
                          <span className="text-sm font-medium text-zinc-900 truncate">
                            {c.name}{c.isSelf ? " (you)" : ""}
                          </span>
                        </span>
                        {c.isCurrentHost ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 shrink-0">
                            Current host
                          </span>
                        ) : changingHostId === c.id ? (
                          <span className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin shrink-0" />
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-400 text-center py-6 px-4">
                      No followers or members to assign yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-6 text-sm text-zinc-500 font-light border-y border-zinc-100 py-6">
              {plan.isPoll ? (
                <>
                  <span className="flex items-center gap-2">
                    <Vote className="w-4 h-4" />
                    {plan.pollOptionCount || 0}{" "}
                    {plan.pollOptionCount === 1 ? "option" : "options"}
                    {plan.pollClosesAt && (() => {
                      const ms = new Date(plan.pollClosesAt).getTime() - Date.now();
                      if (ms <= 0) return <> &middot; closed</>;
                      const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
                      return <> &middot; {days}d left</>;
                    })()}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />{" "}
                    {pollDetail?.totalVotes ?? plan.pollVoteCount ?? 0}{" "}
                    {(pollDetail?.totalVotes ?? plan.pollVoteCount ?? 0) === 1 ? "vote" : "votes"}
                  </span>
                </>
              ) : (
                <>
                  {plan.date && (
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {new Date(plan.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      {plan.time && ` at ${plan.time}`}
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />{" "}
                    {planRsvpsLoading ? plan.rsvpCount : planRsvps.length} RSVP{planRsvps.length === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </div>
          </div>

          {(plan.description || plan.location) && (
            <div className="space-y-6">
              {plan.description && (
                <p className="text-xl font-light leading-relaxed text-zinc-600 whitespace-pre-wrap">
                  {renderLinkedText(plan.description)}
                </p>
              )}
              {plan.location && (
                <div className="space-y-2">
                  <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                    Location
                  </h4>
                  <p className="text-sm text-zinc-700">{plan.location.name}</p>
                  <p className="text-sm text-zinc-500">{plan.location.address}</p>
                </div>
              )}
            </div>
          )}

          {/* Poll branch — vote results, voter list, "Pick this date" */}
          {plan.isPoll ? (
            <div className="space-y-3">
              <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                Vote Results
              </h4>
              {pollDetailLoading && <p className="text-sm text-zinc-400">Loading results…</p>}
              {!pollDetailLoading && pollDetail && (
                <>
                  {pollDetail.isExpired && (
                    <div className="px-3 py-2 bg-amber-50 text-amber-700 text-xs rounded-md">
                      This poll is closed. Convert anyway by picking a date below.
                    </div>
                  )}
                  <div className="space-y-2">
                    {[...pollDetail.options]
                      .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))
                      .map((opt, idx) => {
                        const total = pollDetail.totalVotes;
                        const pct = total > 0 ? Math.round((opt.count / total) * 100) : 0;
                        const dateLabel = (() => {
                          const [y, m, d] = opt.date.split("-").map(Number);
                          if (!y || !m || !d) return opt.date;
                          return new Date(y, m - 1, d).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          });
                        })();
                        const timeLabel = opt.time ? (() => {
                          const [hh, mm] = opt.time!.split(":");
                          let h = parseInt(hh, 10);
                          const ampm = h >= 12 ? "PM" : "AM";
                          if (h === 0) h = 12; else if (h > 12) h -= 12;
                          return `${h}:${mm} ${ampm}`;
                        })() : null;
                        return (
                          <div key={`${opt.date}|${opt.time || ""}`} className="relative border border-zinc-200 rounded-lg overflow-hidden">
                            <div className="absolute inset-y-0 left-0 bg-zinc-100" style={{ width: `${pct}%` }} />
                            <div className="relative flex items-center justify-between gap-3 p-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-zinc-900">
                                  {dateLabel}
                                  {timeLabel && <span className="text-zinc-500"> · {timeLabel}</span>}
                                  {idx === 0 && opt.count > 0 && (
                                    <span className="ml-2 text-[9px] font-bold uppercase tracking-widest bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                                      Leader
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-zinc-400">
                                  {opt.count} {opt.count === 1 ? "vote" : "votes"}{total > 0 ? ` · ${pct}%` : ""}
                                </p>
                              </div>
                              <button
                                disabled={closingPoll}
                                onClick={() => handlePickPollWinner(opt, dateLabel, timeLabel)}
                                className="shrink-0 text-xs font-bold uppercase tracking-widest bg-zinc-900 text-white px-3 py-2 rounded hover:bg-zinc-800 transition-colors disabled:opacity-50"
                              >
                                Pick this date
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
                    Picking a date locks voting and promotes this to a real plan. Every voter gets a text with the chosen date and an RSVP link.
                  </p>

                  {/* Voter roster — host/owner/co-host only */}
                  {pollDetail.canSeeVoters && pollDetail.voters.length > 0 && (
                    <div className="pt-6">
                      <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400 mb-3">
                        Voters ({pollDetail.voters.length})
                      </h4>
                      <div className="border border-zinc-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-50 text-left">
                            <tr>
                              <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Name</th>
                              <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Phone</th>
                              <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Picked</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {pollDetail.voters.map((v, i) => (
                              <tr key={i}>
                                <td className="px-4 py-2.5 text-zinc-700">{v.name}</td>
                                <td className="px-4 py-2.5 text-zinc-400">{v.phone || "—"}</td>
                                <td className="px-4 py-2.5 text-zinc-500 text-[12px]">
                                  {v.selectedDateTimes.map((dt, j) => {
                                    const [y, m, d] = dt.date.split("-").map(Number);
                                    const dateLabel = (y && m && d)
                                      ? new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                      : dt.date;
                                    const timeLabel = dt.time ? (() => {
                                      const [hh, mm] = dt.time.split(":");
                                      let h = parseInt(hh, 10);
                                      const ampm = h >= 12 ? "PM" : "AM";
                                      if (h === 0) h = 12; else if (h > 12) h -= 12;
                                      return `${h}:${mm} ${ampm}`;
                                    })() : null;
                                    return (
                                      <span key={j}>
                                        {j > 0 && ", "}
                                        {dateLabel}{timeLabel && ` ${timeLabel}`}
                                      </span>
                                    );
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
              {!pollDetailLoading && !pollDetail && (
                <p className="text-sm text-zinc-400">Couldn&apos;t load poll details.</p>
              )}
            </div>
          ) : (
            // Non-poll branch — attendees table
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400 flex items-center gap-2">
                  Attendees{!planRsvpsLoading && ` (${planRsvps.filter((r) => r.status === "Accepted").length})`}
                  {!planRsvpsLoading && planRsvps.some((r) => (r.status === "pendingRsvp" || r.status === "Requested")) && (
                    <span className="text-amber-500">
                      {planRsvps.filter((r) => (r.status === "pendingRsvp" || r.status === "Requested")).length} pending
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPlanRsvpsRefreshTick((n) => n + 1)}
                    disabled={planRsvpsLoading}
                    className="text-[10px] font-medium text-zinc-400 hover:text-zinc-700 underline disabled:opacity-40"
                    title="Reload attendees"
                  >
                    Refresh
                  </button>
                </h4>
                {(() => {
                  // iOS Safari treats `+` in `sms:` URLs as a space and is inconsistent
                  // with comma-separated multi-recipient links. The `&addresses=` query
                  // form is the documented way to populate multiple recipients on iOS;
                  // Android handles either format fine.
                  const sharingPhones = planRsvps
                    .filter((r) => r.status === "Accepted" && r.sharePhoneWithHost && r.phone)
                    .map((r) => r.phone as string);
                  if (sharingPhones.length === 0) return null;
                  const smsHref = `sms:&addresses=${sharingPhones.map((p) => encodeURIComponent(p)).join(",")}`;
                  return (
                    <a
                      href={smsHref}
                      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Message All ({sharingPhones.length})
                    </a>
                  );
                })()}
              </div>
              {planRsvpsError && (
                <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg px-3 py-2 text-xs">
                  Couldn&apos;t load attendees: {planRsvpsError}
                </div>
              )}
              {planRsvpsLoading ? (
                <p className="text-sm text-zinc-400">Loading...</p>
              ) : planRsvps.length > 0 ? (
                <div className="border border-zinc-200 rounded-xl">
                  <table className="w-full text-sm table-fixed">
                    <thead className="bg-zinc-50 text-left">
                      <tr>
                        <th className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Name</th>
                        <th className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 w-[40%]">Phone</th>
                        <th className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400 text-center w-14">Status</th>
                        <th className="px-3 py-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {planRsvps.map((r, i) => {
                        const isPending = r.status === "pendingRsvp" || r.status === "Requested";
                        return (
                        <tr key={i}>
                          <td className="px-3 py-2.5">
                            <div className="truncate" title={r.name}>{r.name}</div>
                            {r.rsvpNote && (
                              <p
                                className="text-[11px] text-zinc-400 italic line-clamp-3 whitespace-pre-wrap break-words"
                                title={r.rsvpNote}
                              >
                                &ldquo;{r.rsvpNote}&rdquo;
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-zinc-400">
                            {r.phone
                              ? <span className="truncate block" title={r.phone}>{r.phone}</span>
                              : r.sharePhoneWithHost
                                ? "—"
                                : <span className="inline-flex items-center gap-1 text-zinc-300" title="Hidden"><EyeOff className="w-3 h-3" /></span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {isPending ? (
                              <span
                                className="flex items-center justify-center text-amber-500"
                                title="Pending approval"
                                aria-label="Pending approval"
                              >
                                <Clock className="w-4 h-4" />
                              </span>
                            ) : (
                              <span
                                className="flex items-center justify-center text-emerald-600"
                                title="Confirmed"
                                aria-label="Confirmed"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {isPending ? (
                              <div className="flex gap-1 justify-end">
                                <button
                                  onClick={async () => {
                                    try {
                                      await Parse.Cloud.run("approveRsvpRequest", { notificationId: r.notificationId });
                                      setPlanRsvps((prev) => prev.map((rsvp) => rsvp.notificationId === r.notificationId ? { ...rsvp, status: "Accepted" } : rsvp));
                                      onPendingRsvpResolved?.(r.notificationId);
                                    } catch (err) {
                                      console.error("Failed to approve:", err);
                                    }
                                  }}
                                  className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors"
                                  title="Approve"
                                  aria-label={`Approve ${r.name}`}
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await Parse.Cloud.run("declineRsvpRequest", { notificationId: r.notificationId });
                                      setPlanRsvps((prev) => prev.filter((rsvp) => rsvp.notificationId !== r.notificationId));
                                      onPendingRsvpResolved?.(r.notificationId);
                                    } catch (err) {
                                      console.error("Failed to decline:", err);
                                    }
                                  }}
                                  className="p-1 rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
                                  title="Decline"
                                  aria-label={`Decline ${r.name}`}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end">
                                <button
                                  onClick={async () => {
                                    if (!confirm(`Remove ${r.name} from this plan?`)) return;
                                    try {
                                      await Parse.Cloud.run("removeAttendeeFromPlan", { notificationId: r.notificationId });
                                      setPlanRsvps((prev) => prev.filter((rsvp) => rsvp.notificationId !== r.notificationId));
                                    } catch (err) {
                                      console.error("Failed to remove attendee:", err);
                                      alert("Failed to remove attendee.");
                                    }
                                  }}
                                  className="p-1 rounded text-zinc-300 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title="Remove attendee"
                                  aria-label={`Remove ${r.name}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No RSVPs yet.</p>
              )}
            </div>
          )}

          {/* Action bar — Plan Chat / Duplicate / Edit on top, Cancel below */}
          <div className="pt-8 border-t border-zinc-100 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              {!plan.isPoll && (
                <Link
                  href={`/chat/${plan.objectId}`}
                  className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Plan Chat
                </Link>
              )}
              <button
                onClick={handleDuplicate}
                className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </button>
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
            </div>
            <div className="flex justify-center gap-6 flex-wrap">
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                {plan.isPoll
                  ? "Cancel Poll"
                  : plan.planSeriesId
                    ? "Cancel This Occurrence"
                    : "Cancel Plan"}
              </button>
              {plan.planSeriesId && (
                <button
                  onClick={handleCancelSeries}
                  className="flex items-center gap-2 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
                >
                  <Repeat className="w-4 h-4" />
                  End Recurring Series
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
