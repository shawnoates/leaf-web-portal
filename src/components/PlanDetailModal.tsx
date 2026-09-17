"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { renderLinkedText } from "@/lib/linkify";
import { formatWallClockTime12h } from "@/lib/date-utils";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Link2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Users,
  Vote,
  X,
} from "lucide-react";
import PlanAttendeeList, { isPendingStatus } from "./PlanAttendeeList";
import { CrossPromoEyebrow } from "./CrossPromoBadge";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";

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
  /** The named host is a paid Leaf roster host on `assignedHost`, not the owner. */
  hostIsRoster?: boolean;
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
  /** Pending note from a host who can't edit from the app (requestPlanChange). */
  changeRequest?: {
    note: string;
    requestedByName: string;
    requestedAt: string;
  } | null;
  /** Cross-promotion: hosted on another calendar, accepted onto this one.
   *  The modal goes read-only — edit/cancel/host belong to the other owner —
   *  and offers "Remove from this calendar" instead. */
  promotedFrom?: {
    promotionId: string;
    calendarId: string | null;
    name: string | null;
    shareId: string | null;
    photoUrl?: string | null;
  } | null;
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
  /** Calendar this plan belongs to — required to open the AI-assisted host purchase sheet. */
  calendarId: string;
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
  /** Cross-promotion: open the "Cross-promote" sheet for this plan.
   *  Hidden for polls and past plans. Absent = no share action. */
  onShare?: (plan: PlanDetailData) => void;
};

export default function PlanDetailModal({
  plan,
  calendarId,
  onClose,
  onChanged,
  onDuplicate,
  onEdit,
  onConvertPoll,
  leafAppConnected = true,
  onConnectApp,
  onPendingRsvpResolved,
  onShare,
}: Props) {
  // Flashes "Copied" on the Copy Link action after the direct /p/<id> URL is
  // written to the clipboard.
  const [linkCopied, setLinkCopied] = useState(false);

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
    { id: string; name: string; isCurrentHost: boolean; isSelf: boolean; suffix?: string; hasPhone?: boolean }[] | null
  >(null);
  // For a series occurrence, default to handing over the whole series: the
  // new host then confirms each month from a texted link. Off = this
  // occurrence only (next month reverts to the series host).
  const [applyToSeries, setApplyToSeries] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [changingHostId, setChangingHostId] = useState<string | null>(null);
  const [changeHostError, setChangeHostError] = useState<string | null>(null);
  const [hostNameOverride, setHostNameOverride] = useState<string | null>(null);

  // AI-assisted host purchase sheet, opened from the Change host popup —
  // attaches (and pays for, unless Concierge-tier) an AI-assisted host that
  // replaces whoever is currently hosting this plan, live RSVPs included.
  // Attaching a persona mid-session flips this on without a parent refetch.

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

  // Copy the plan's public direct link (/p/<eventGroupId>) — same canonical
  // share URL the card and SMS flows use — so the owner can hand someone a
  // single event without sending them to the whole calendar page.
  const copyPlanLink = async () => {
    try {
      // Cross-promoted: the link keeps recipients on this calendar (?via=),
      // not the host calendar's page and its follow prompts.
      const via = plan.promotedFrom ? `?via=${calendarId}` : "";
      await navigator.clipboard.writeText(`${window.location.origin}/p/${plan.objectId}${via}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context) — silently no-op.
    }
  };

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

  // Local copy so Dismiss hides the banner immediately; the parent refetch
  // (onChanged) reconciles the row in Needs You.
  const [changeRequest, setChangeRequest] = useState(plan.changeRequest ?? null);
  const [dismissingChangeRequest, setDismissingChangeRequest] = useState(false);
  const dismissChangeRequest = async () => {
    setDismissingChangeRequest(true);
    try {
      await Parse.Cloud.run("resolvePlanChangeRequest", { eventGroupId: plan.objectId });
      setChangeRequest(null);
      onChanged();
    } catch (err) {
      console.error("resolvePlanChangeRequest failed", err);
    } finally {
      setDismissingChangeRequest(false);
    }
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
      if (plan.planSeriesId) {
        // Series: followers AND past RSVPers of the calendar — the person who
        // wants to run a monthly club is often a regular who never followed.
        const res = (await Parse.Cloud.run("getSeriesHostCandidates", { calendarId })) as {
          candidates?: { id: string; name: string; hasPhone: boolean; follower: boolean; attendee: boolean; rsvps: number; attended: boolean }[];
        };
        setHostCandidates(
          (res?.candidates || []).map((c) => ({
            id: c.id,
            name: c.name,
            isCurrentHost: c.name === (hostNameOverride || plan.hostName),
            isSelf: false,
            hasPhone: c.hasPhone,
            suffix: [
              c.attendee ? (c.attended ? "attended" : `${c.rsvps} RSVP${c.rsvps === 1 ? "" : "s"}`) : c.follower ? "follower" : null,
              c.hasPhone ? null : "no phone",
            ].filter(Boolean).join(" · "),
          })),
        );
      } else {
        const res = await Parse.Cloud.run("getPlanHostCandidates", { eventGroupId: plan.objectId });
        setHostCandidates(res?.candidates || []);
      }
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
      // Whole-series handover reassigns every future occurrence (this one
      // included) and texts the new host their invite link.
      const res = plan.planSeriesId && applyToSeries
        ? await Parse.Cloud.run("changeSeriesHost", { seriesId: plan.planSeriesId, hostUserId: candidate.id })
        : await Parse.Cloud.run("changePlanHost", { eventGroupId: plan.objectId, newHostUserId: candidate.id });
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

  const goingCount = planRsvps.filter((r) => r.status === "Accepted").length;
  const pendingCount = planRsvps.filter((r) => isPendingStatus(r.status)).length;
  // iOS Safari treats `+` in `sms:` URLs as a space and is inconsistent
  // with comma-separated multi-recipient links. The `&addresses=` query
  // form is the documented way to populate multiple recipients on iOS;
  // Android handles either format fine.
  const sharingPhones = planRsvps
    .filter((r) => r.status === "Accepted" && r.sharePhoneWithHost && r.phone)
    .map((r) => r.phone as string);
  const messageAllHref = `sms:&addresses=${sharingPhones.map((p) => encodeURIComponent(p)).join(",")}`;

  const approveRsvp = async (r: { notificationId: string }) => {
    try {
      await Parse.Cloud.run("approveRsvpRequest", { notificationId: r.notificationId });
      setPlanRsvps((prev) => prev.map((rsvp) => rsvp.notificationId === r.notificationId ? { ...rsvp, status: "Accepted" } : rsvp));
      onPendingRsvpResolved?.(r.notificationId);
    } catch (err) {
      console.error("Failed to approve:", err);
    }
  };
  const declineRsvp = async (r: { notificationId: string }) => {
    try {
      await Parse.Cloud.run("declineRsvpRequest", { notificationId: r.notificationId });
      setPlanRsvps((prev) => prev.filter((rsvp) => rsvp.notificationId !== r.notificationId));
      onPendingRsvpResolved?.(r.notificationId);
    } catch (err) {
      console.error("Failed to decline:", err);
    }
  };
  const removeRsvp = async (r: { notificationId: string }) => {
    const snapshot = planRsvps;
    setPlanRsvps((prev) => prev.filter((rsvp) => rsvp.notificationId !== r.notificationId));
    try {
      await Parse.Cloud.run("removeAttendeeFromPlan", { notificationId: r.notificationId });
    } catch (err) {
      console.error("Failed to remove attendee:", err);
      setPlanRsvps(snapshot);
      alert("Failed to remove attendee.");
    }
  };

  // Cross-promoted onto this calendar: someone else's plan. No edit, cancel,
  // host change or re-promotion from here — only removal from this calendar.
  const isPromoted = Boolean(plan.promotedFrom);
  const [removingPromotion, setRemovingPromotion] = useState(false);
  const handleRemovePromotion = async () => {
    if (!plan.promotedFrom) return;
    if (!confirm(`Remove "${plan.title}" from this calendar? ${plan.promotedFrom.name || "The host calendar"} keeps the plan and its RSVPs.`)) return;
    setRemovingPromotion(true);
    try {
      await Parse.Cloud.run("withdrawPlanPromotion", { promotionId: plan.promotedFrom.promotionId });
      onChanged();
      onClose();
    } catch (err) {
      console.error("Failed to remove cross-promoted plan:", err);
      alert("Couldn't remove it. Please try again.");
    } finally {
      setRemovingPromotion(false);
    }
  };

  const canShare = !!onShare && !plan.isPoll && !isPromoted && (!plan.date || new Date(plan.date).getTime() > Date.now());
  const primaryActionCount = (plan.isPoll ? 0 : 1) + (canShare ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] md:h-[85vh] md:max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
        <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
          <button
            onClick={copyPlanLink}
            title="Copy direct link to this plan"
            className="p-2 rounded-full bg-zinc-100 text-zinc-900 md:bg-transparent"
          >
            {linkCopied ? (
              <Check className="w-5 h-5 text-emerald-600" />
            ) : (
              <Link2 className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-100 text-zinc-900 md:bg-transparent"
          >
            <Plus className="w-8 h-8 rotate-45" />
          </button>
        </div>

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
          {changeRequest && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-amber-800">
                    Change requested by {changeRequest.requestedByName}
                    <span className="font-normal normal-case tracking-normal text-amber-700">
                      {" · "}
                      {new Date(changeRequest.requestedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-900 mt-1 whitespace-pre-wrap">{changeRequest.note}</p>
                </div>
              </div>
              <div className="flex gap-2 pl-7">
                <button
                  onClick={handleEdit}
                  className="px-3.5 py-1.5 min-h-[30px] bg-zinc-900 text-white rounded-full text-xs font-medium hover:bg-zinc-800 transition-colors"
                >
                  Edit plan
                </button>
                <button
                  onClick={dismissChangeRequest}
                  disabled={dismissingChangeRequest}
                  className="px-3.5 py-1.5 min-h-[30px] text-zinc-600 rounded-full text-xs font-medium hover:text-zinc-900 transition-colors disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {plan.promotedFrom && (
              <div className="flex">
                <CrossPromoEyebrow source={plan.promotedFrom} />
              </div>
            )}
            <h2 className="text-4xl md:text-5xl font-light tracking-tighter">
              {plan.title}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                Hosted by {hostNameOverride || plan.hostName}
                {plan.hostIsRoster && !hostNameOverride && (
                  <span className="ml-2 normal-case tracking-normal font-medium text-xs text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                    Leaf host
                  </span>
                )}
              </p>
              {/* A roster host is placed and replaced from the Leaf side (the
                  needs-host queue), not by picking a follower here. */}
              {!plan.isPoll && !plan.hostIsRoster && !isPromoted && (
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
                {plan.planSeriesId && (
                  <label className="flex items-start gap-2.5 px-4 py-3 border-b border-zinc-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToSeries}
                      onChange={(e) => setApplyToSeries(e.target.checked)}
                      className="mt-0.5 accent-zinc-900"
                    />
                    <span className="text-xs text-zinc-700 leading-snug">
                      <span className="font-medium text-zinc-900">Whole series.</span>{" "}
                      They get a text to accept, then confirm each month&apos;s date from a link.
                      Unchecked, only this occurrence changes and next month reverts to you.
                    </span>
                  </label>
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
                        disabled={!!changingHostId || c.isCurrentHost || Boolean(plan.planSeriesId && applyToSeries && c.hasPhone === false)}
                        title={c.hasPhone === false ? "No phone on file — can't be texted" : undefined}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-50 transition-colors text-left disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                            <Users className="w-3.5 h-3.5 text-zinc-400" />
                          </span>
                          <span className="text-sm font-medium text-zinc-900 truncate">
                            {c.name}{c.isSelf ? " (you)" : ""}
                            {c.suffix ? <span className="font-normal text-zinc-400"> · {c.suffix}</span> : null}
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
                      {plan.planSeriesId ? "Nobody has followed or RSVP'd yet." : "No followers or members to assign yet."}
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
                      {plan.time && ` at ${formatWallClockTime12h(plan.time)}`}
                    </span>
                  )}
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />{" "}
                    {planRsvpsLoading ? plan.rsvpCount : goingCount} going
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
                        const timeLabel = opt.time ? formatWallClockTime12h(opt.time) : null;
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
            // Non-poll branch — attendees list
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-baseline min-w-0">
                  <h4 className="text-[15px] font-semibold text-zinc-900">Attendees</h4>
                  {!planRsvpsLoading && (
                    <span className="text-xs font-medium text-zinc-500 ml-2 whitespace-nowrap">
                      {goingCount} going
                      {pendingCount > 0 && (
                        <span className="text-amber-600"> · {pendingCount} pending</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPlanRsvpsRefreshTick((n) => n + 1)}
                    disabled={planRsvpsLoading}
                    aria-label="Refresh attendees"
                    className={`h-8 w-8 rounded-lg border border-zinc-200 text-zinc-600 grid place-items-center hover:bg-zinc-50 disabled:opacity-60 ${FOCUS_RING}`}
                  >
                    <RefreshCw className={`w-4 h-4 ${planRsvpsLoading ? "animate-spin" : ""}`} />
                  </button>
                  <a
                    href={sharingPhones.length > 0 ? messageAllHref : undefined}
                    aria-disabled={sharingPhones.length === 0 || undefined}
                    className={`h-8 px-3 rounded-lg bg-zinc-900 text-white text-[13px] font-medium inline-flex items-center gap-1.5 no-underline hover:bg-zinc-800 ${sharingPhones.length === 0 ? "opacity-40 pointer-events-none" : ""} ${FOCUS_RING}`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message all
                  </a>
                </div>
              </div>
              {planRsvpsError && (
                <div className="mt-3 border border-red-200 bg-red-50 text-red-700 rounded-lg px-3 py-2 text-xs">
                  Couldn&apos;t load attendees: {planRsvpsError}
                </div>
              )}
              {planRsvpsLoading ? (
                <p className="mt-3 text-sm text-zinc-400">Loading...</p>
              ) : planRsvps.length > 0 ? (
                <PlanAttendeeList
                  attendees={planRsvps}
                  onApprove={approveRsvp}
                  onDecline={declineRsvp}
                  onRemove={removeRsvp}
                />
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
                  <p>No one&apos;s RSVP&apos;d yet. Cross-promote it to nearby communities to get it moving.</p>
                  {canShare && (
                    <button
                      type="button"
                      onClick={() => onShare?.(plan)}
                      className={`mt-2 text-sm font-medium text-zinc-900 underline underline-offset-2 rounded ${FOCUS_RING}`}
                    >
                      Cross-promote
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-zinc-100 flex flex-col gap-2.5">
            {primaryActionCount > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {!plan.isPoll && (
                  <Link
                    href={`/chat/${plan.objectId}`}
                    className={`h-11 rounded-[10px] bg-zinc-900 text-white text-sm font-medium inline-flex items-center justify-center gap-2 no-underline hover:bg-zinc-800 transition-colors ${primaryActionCount === 1 ? "col-span-2" : ""} ${FOCUS_RING}`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Plan chat
                  </Link>
                )}
                {canShare && (
                  <button
                    type="button"
                    onClick={() => onShare?.(plan)}
                    className={`h-11 rounded-[10px] border border-zinc-300 bg-white text-zinc-900 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors ${primaryActionCount === 1 ? "col-span-2" : ""} ${FOCUS_RING}`}
                  >
                    <Send className="w-4 h-4" />
                    Cross-promote
                  </button>
                )}
              </div>
            )}
            {isPromoted ? (
              <div className="flex flex-wrap items-center justify-center gap-3 text-[13px]">
                <span className="text-zinc-500">
                  {plan.promotedFrom?.name || "The host calendar"} runs this plan and manages its RSVPs.
                </span>
                <button
                  type="button"
                  onClick={handleRemovePromotion}
                  disabled={removingPromotion}
                  className={`h-9 px-3 rounded-lg font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 inline-flex items-center transition-colors ${FOCUS_RING}`}
                >
                  Remove from this calendar
                </button>
              </div>
            ) : (
            <div className="flex flex-wrap items-center justify-center gap-1">
              <button
                type="button"
                onClick={handleEdit}
                className={`h-9 px-3 rounded-lg text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 inline-flex items-center gap-1.5 transition-colors ${FOCUS_RING}`}
              >
                <Pencil className="w-[15px] h-[15px]" />
                Edit
              </button>
              <button
                type="button"
                onClick={handleDuplicate}
                className={`h-9 px-3 rounded-lg text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 inline-flex items-center gap-1.5 transition-colors ${FOCUS_RING}`}
              >
                <Copy className="w-[15px] h-[15px]" />
                Duplicate
              </button>
              <span aria-hidden="true" className="w-px h-5 bg-zinc-200 mx-1.5" />
              <button
                type="button"
                onClick={handleCancel}
                className={`h-9 px-3 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 inline-flex items-center transition-colors ${FOCUS_RING}`}
              >
                {plan.isPoll
                  ? "Cancel poll"
                  : plan.planSeriesId
                    ? "Cancel this occurrence"
                    : "Cancel plan"}
              </button>
              {plan.planSeriesId && (
                <button
                  type="button"
                  onClick={handleCancelSeries}
                  className={`h-9 px-3 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 inline-flex items-center transition-colors ${FOCUS_RING}`}
                >
                  End recurring series
                </button>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
