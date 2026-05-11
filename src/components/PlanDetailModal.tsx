"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import {
  Calendar,
  Clock,
  Copy,
  Pencil,
  Plus,
  Trash2,
  Users,
  Vote,
} from "lucide-react";

export type PlanDetailData = {
  objectId: string;
  title: string;
  description: string;
  image: string | null;
  date: string | null;
  time: string | null;
  hostName: string;
  rsvpCount: number;
  location: { name: string; address: string } | null;
  isPoll?: boolean;
  pollOptionCount?: number;
  pollClosesAt?: string | null;
  pollVoteCount?: number;
  hideVenueUntilRsvp?: boolean;
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

  // Load attendees for non-poll plans.
  useEffect(() => {
    if (plan.isPoll) {
      setPlanRsvps([]);
      return;
    }
    setPlanRsvpsLoading(true);
    Parse.Cloud.run("getPlanRsvps", { eventGroupId: plan.objectId })
      .then((result: Rsvp[]) => setPlanRsvps(result || []))
      .catch(() => setPlanRsvps([]))
      .finally(() => setPlanRsvpsLoading(false));
  }, [plan.objectId, plan.isPoll]);

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

  const handleCancel = async () => {
    const isPoll = !!plan.isPoll;
    const confirmMsg = isPoll
      ? "Cancel this poll? Voters won't be notified. This cannot be undone."
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

  const handlePickPollWinner = async (opt: PollOptionDetail, dateLabel: string, timeLabel: string | null) => {
    if (!confirm(`Pick ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}? Voters will be SMS'd to RSVP.`)) return;
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
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
              Hosted by {plan.hostName}
            </p>
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
                <p className="text-xl font-light leading-relaxed text-zinc-600">
                  {plan.description}
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
              <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                Attendees{!planRsvpsLoading && ` (${planRsvps.filter((r) => r.status === "Accepted").length})`}
                {!planRsvpsLoading && planRsvps.some((r) => r.status === "pendingRsvp") && (
                  <span className="text-amber-500 ml-2">
                    {planRsvps.filter((r) => r.status === "pendingRsvp").length} pending
                  </span>
                )}
              </h4>
              {planRsvpsLoading ? (
                <p className="text-sm text-zinc-400">Loading...</p>
              ) : planRsvps.length > 0 ? (
                <div className="border border-zinc-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-sm min-w-0">
                    <thead className="bg-zinc-50 text-left">
                      <tr>
                        <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Name</th>
                        <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Phone</th>
                        <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400">Status</th>
                        <th className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {planRsvps.map((r, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5">
                            <div>{r.name}</div>
                            {r.rsvpNote && (
                              <p className="text-[11px] text-zinc-400 italic truncate max-w-[200px]">&ldquo;{r.rsvpNote}&rdquo;</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-400">{r.phone || "—"}</td>
                          <td className="px-4 py-2.5">
                            {r.status === "pendingRsvp" ? (
                              <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Pending</span>
                            ) : (
                              <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Confirmed</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {r.status === "pendingRsvp" ? (
                              <div className="flex gap-2">
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
                                  className="px-2 py-1 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest rounded hover:bg-emerald-700 transition-colors"
                                >
                                  Approve
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
                                  className="px-2 py-1 bg-white text-zinc-600 text-xs font-bold uppercase tracking-widest rounded border border-zinc-300 hover:bg-zinc-50 transition-colors"
                                >
                                  Decline
                                </button>
                              </div>
                            ) : (
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
                                className="text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No RSVPs yet.</p>
              )}
            </div>
          )}

          {/* Action bar — Duplicate / Edit / Cancel */}
          <div className="pt-8 border-t border-zinc-100 flex items-center justify-between">
            <button
              onClick={handleDuplicate}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </button>
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {plan.isPoll ? "Cancel Poll" : "Cancel Plan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
