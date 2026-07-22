"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import SubscriptionModal from "@/components/SubscriptionModal";
import CreatePlanModal, { type CreatePlanPrefill } from "@/components/CreatePlanModal";
import PlanDetailModal, { type PlanDetailData } from "@/components/PlanDetailModal";
import PlanChatDrawer from "@/components/PlanChatDrawer";
import { formatDateInputInTimezone } from "@/lib/date-utils";
import { computeSpreadIdeaDates } from "@/lib/spread-idea-dates";
import { Calendar, Camera, Check, Link2, Lock, MessageCircle, Pencil, Plus, RefreshCw, Repeat, Settings, Trash2, UserCheck, Users, X } from "lucide-react";

// Renders a plan cover image with a Calendar-icon placeholder fallback when
// the src is missing OR 404s (attendee-uploaded / expired signed URLs go
// stale). Sized via `className` on the outer wrapper so callers keep full
// control of the layout.
function PlanImage({
  src,
  alt,
  className,
  iconSize = "w-6 h-6",
}: {
  src?: string | null;
  alt: string;
  className: string;
  iconSize?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${className} bg-zinc-100 flex items-center justify-center`}>
        <Calendar className={`${iconSize} text-zinc-300`} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${className} object-cover`}
      onError={() => setFailed(true)}
    />
  );
}

// Resolve an AI starter event's display date. Mirrors the logic in
// /org/[shareId]/page.tsx — dateISO present ⇒ locked calendar date;
// weekday-style time strings ("Sat · 7:00 PM") resolve to the next
// occurrence of that weekday. Returns null if the event can't be dated
// or its fixed date has already passed (keeps stale suggestions out of
// the manager's Upcoming list).
function resolveAIStarterDate(ev: {
  time?: string;
  isoDatetime?: string | null;
  dateISO?: string | null;
}): Date | null {
  const timeStr = String(ev.time || "").trim();
  const MONTH_RX = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
  const isFixedDate = MONTH_RX.test(timeStr) || !!(ev.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(ev.dateISO));

  if (isFixedDate) {
    if (!ev.isoDatetime) return null;
    const d = new Date(ev.isoDatetime);
    if (Number.isNaN(d.getTime())) return null;
    // Past fixed-date starter → drop. The manager can't retro-host a
    // date that already happened.
    if (d.getTime() < Date.now() - 3 * 60 * 60 * 1000) return null;
    return d;
  }

  // Weekly path — parse weekday + time and roll to next occurrence.
  const WEEKDAYS: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, weds: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };
  const weekdayMatch = timeStr
    .toLowerCase()
    .match(/\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/);
  if (!weekdayMatch) {
    if (!ev.isoDatetime) return null;
    const d = new Date(ev.isoDatetime);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const targetDow = WEEKDAYS[weekdayMatch[1]];
  const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/i);
  if (!timeMatch) return null;
  let hour = parseInt(timeMatch[1], 10);
  const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null;
  const now = new Date();
  const currentDow = now.getDay();
  let daysUntil = (targetDow - currentDow + 7) % 7;
  if (daysUntil === 0) {
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    if (hour < nowH || (hour === nowH && minute <= nowM)) daysUntil = 7;
  }
  const target = new Date(now);
  target.setDate(now.getDate() + daysUntil);
  target.setHours(hour, minute, 0, 0);
  return target;
}

interface PlanIdea {
  objectId: string;
  title: string;
  description: string;
  date: string;
  image: string | null;
  location: { name: string; address: string } | null;
  ideaSeriesId: string | null;
  interestCount: number;
}

interface PastPlan {
  objectId: string;
  title: string;
  description: string;
  image: string | null;
  expiryDate: string;
  timezone: string | null;
  rsvpCount: number;
  attendanceCount: number;
  photoCount: number;
  host: { name: string } | null;
  location: { name: string; address: string } | null;
}

interface EventPhoto {
  objectId: string;
  url: string | null;
  caption: string | null;
  uploadedAt: string;
  uploaderName: string;
}

interface PastPlanRsvp {
  notificationId: string;
  name: string;
  status: string;
  attendedAt: string | null;
  attendedSource: string | null;
  checkedInViaMobile: boolean;
  checkedInAt: string | null;
}

interface UpcomingPlan {
  objectId: string;
  title: string;
  description: string;
  image: string | null;
  expiryDate: string;
  timezone: string | null;
  time: string | null;
  rsvpCount: number;
  host: { name: string } | null;
  location: { name: string; address: string } | null;
  /** Full itinerary (server `getOrgDashboard` calendar.activePlans[i].locations).
   *  Threaded into `PlanDetailData.locations` for the edit modal to hydrate its
   *  multi-stop compose UI. */
  locations?: {
    objectId?: string | null;
    name: string | null;
    address: string | null;
    placeId?: string | null;
    time?: string | null;
  }[];
  isPoll?: boolean;
  pollOptionCount?: number;
  pollVoteCount?: number;
  pollClosesAt?: string | null;
  hideVenueUntilRsvp?: boolean;
  requireApproval?: boolean;
  planSeriesId?: string | null;
  // AI starter plans surfaced alongside real EventGroups. These come from
  // the parent AICalendar's aiSourceEvents; they never gain a host until a
  // manager promotes them via "Plan This" (which creates a real EventGroup
  // and drops the AI event index). Rendered with a "Waiting on host" byline
  // so the manager sees what still needs claiming.
  isAIStarter?: boolean;
  aiEventIndex?: number;
  aiVenueLine?: string;
  // Cover treatment inputs so the manager card matches the /org public
  // page — the tag rendered LARGE in serif on a green/amber gradient
  // instead of the plain calendar-icon placeholder.
  aiTag?: string;
  aiTagVariant?: "default" | "amber";
}

/**
 * Full plan-management surface for a single calendar: upcoming/past plans
 * (with attendance + photos), AI plan ideas (regenerate/remove/end-series),
 * and plan creation/editing. Extracted from the former standalone
 * /dashboard/[calendarId]/plans page so it can render inline inside the
 * dashboard Calendars tab (as a slide-over) with no separate route.
 *
 * `calendarId` is the calendar being managed; `orgId` is its parent org (used
 * for getOrgDashboard). `initialPrefill`/`returnTo` support the /m "Host
 * Another" deep-link, which opens the create modal pre-filled and bounces back
 * to `returnTo` on cancel.
 */
export default function PlansManager({
  calendarId,
  orgId,
  initialPrefill = null,
  returnTo = null,
}: {
  calendarId: string;
  orgId: string;
  initialPrefill?: CreatePlanPrefill | null;
  returnTo?: string | null;
}) {
  const router = useRouter();

  const [tier, setTier] = useState("starter");
  // Only trust the tier once getOrgDashboard has actually resolved. Defaulting
  // to "starter" made a failed/slow load look identical to a free plan and
  // FALSE-locked paid features (e.g. Regenerate on a concierge org).
  const [tierLoaded, setTierLoaded] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<UpcomingPlan | null>(null);
  // Per-plan chat drawer state. Non-null = eventGroupId of the plan
  // whose chat should render as a slide-over. Set from the plan-card
  // hover overlay's "Chat" button so the owner never leaves the
  // dashboard to see the plan chat.
  const [chatPlanId, setChatPlanId] = useState<string | null>(null);
  // Tracks which plan's direct link was just copied, so the card can flash a
  // "Copied" confirmation. Cleared after a short delay.
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [createPlanPrefill, setCreatePlanPrefill] = useState<CreatePlanPrefill | null>(null);
  const planCreatedRef = useRef(false);

  // Upcoming plans (hosted)
  const [upcomingPlans, setUpcomingPlans] = useState<UpcomingPlan[]>([]);

  // Past plans (with photo counts) — lazy-loaded when the user opens the Past tab
  const [planTense, setPlanTense] = useState<"upcoming" | "past">("upcoming");
  const [pastPlans, setPastPlans] = useState<PastPlan[] | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);

  // Photos modal
  const [photosModalPlan, setPhotosModalPlan] = useState<PastPlan | null>(null);
  const [modalPhotos, setModalPhotos] = useState<EventPhoto[] | null>(null);
  const [modalRsvps, setModalRsvps] = useState<PastPlanRsvp[] | null>(null);
  const [markingAttendeeId, setMarkingAttendeeId] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  // Plan ideas
  const [planIdeas, setPlanIdeas] = useState<PlanIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [hidePlanIdeas, setHidePlanIdeas] = useState(false);

  // Assign-a-host: members eligible to be assigned as a suggestion's host,
  // plus the idea currently being assigned (null = picker closed) and the
  // user id mid-assignment (for the row spinner).
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [assigningIdea, setAssigningIdea] = useState<PlanIdea | null>(null);
  const [assignBusyUserId, setAssignBusyUserId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Spread the suggestions' "Preferred" dates across the calendar's real
  // cadence (same helper the public /org page uses) so a server-clustered
  // batch fans out instead of all showing one day. Display-only + drives the
  // Edit/Assign prefill so the shown date and the published date agree.
  // Cadence is inferred from real plans only (AI starters excluded). Bucketed
  // hourly so the 2-week floor rolls forward without thrashing each render.
  const nowBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const spreadIdeaDates = useMemo(
    () =>
      computeSpreadIdeaDates(
        upcomingPlans.filter((p) => !p.isAIStarter).map((p) => p.expiryDate),
        planIdeas.map((i) => ({ id: i.objectId, date: i.date })),
        nowBucket * 60 * 60 * 1000
      ),
    [upcomingPlans, planIdeas, nowBucket]
  );
  const spreadDateOf = (idea: PlanIdea): Date | null =>
    spreadIdeaDates.get(idea.objectId) ?? (idea.date ? new Date(idea.date) : null);

  // Upgrade gate
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  // Deep-link prefill (opens the create modal on mount).
  useEffect(() => {
    if (initialPrefill) {
      setCreatePlanPrefill(initialPrefill);
      setShowCreateModal(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchOrgInfo();
    fetchPlanIdeas();
    // Reset per-calendar caches when the parent switches calendars so
    // fetchPastPlans() actually re-runs against the newly-selected id.
    // Without this the null-short-circuit at the top of fetchPastPlans()
    // keeps rendering the previously-loaded calendar's plans.
    setPastPlans(null);
    setLoadingPast(false);
    if (planTense === "past") {
      fetchPastPlans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarId]);

  async function toggleAttendance(eventGroupId: string, attendee: PastPlanRsvp) {
    if (attendee.checkedInViaMobile) return; // mobile check-ins are read-only
    const nextAttended = !attendee.attendedAt;
    setMarkingAttendeeId(attendee.notificationId);
    setAttendanceError(null);
    try {
      await Parse.Cloud.run("markAttendance", {
        eventGroupId,
        attendeeNotificationId: attendee.notificationId,
        attended: nextAttended,
      });
      setModalRsvps((prev) =>
        prev
          ? prev.map((r) =>
              r.notificationId === attendee.notificationId
                ? {
                    ...r,
                    attendedAt: nextAttended ? new Date().toISOString() : null,
                    attendedSource: nextAttended ? "host" : null,
                  }
                : r
            )
          : prev
      );
      setPastPlans((prev) =>
        prev
          ? prev.map((p) =>
              p.objectId === eventGroupId
                ? {
                    ...p,
                    attendanceCount: Math.max(0, p.attendanceCount + (nextAttended ? 1 : -1)),
                  }
                : p
            )
          : prev
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[dashboard] markAttendance failed:", err);
      setAttendanceError(msg);
    } finally {
      setMarkingAttendeeId(null);
    }
  }

  async function fetchOrgInfo() {
    try {
      const result = await Parse.Cloud.run("getOrgDashboard", { calendarId: orgId });
      if (orgId !== calendarId && result.calendars) {
        const child = result.calendars.find((c: { objectId: string; hidePlanIdeas?: boolean }) => c.objectId === calendarId);
        setHidePlanIdeas((child ? child.hidePlanIdeas : result.hidePlanIdeas) || false);
      } else {
        setHidePlanIdeas(result.hidePlanIdeas || false);
      }
      setTier(result.tier);
      setTierLoaded(true);
    } catch (err) {
      // Leave tierLoaded false so we don't false-lock paid features on a failed
      // load; the server still tier-gates the actual regenerate.
      console.warn("[PlansManager] getOrgDashboard failed:", err);
    }
  }

  async function fetchPlanIdeas() {
    setLoadingIdeas(true);
    try {
      const dash = await Parse.Cloud.run("getOrgDashboard", { calendarId: orgId });
      let shareId = dash.shareId;
      const cal = dash.calendars?.find((c: { objectId: string }) => c.objectId === calendarId);
      if (cal?.shareId) shareId = cal.shareId;
      // People eligible to be assigned as a suggestion's host: the calendar's
      // members AND followers. Both need a bound user (objectId) — unbound
      // invites / phone-only followers can't host yet, so drop them. Deduped
      // by user id (someone can be both a member and a follower).
      const candidateMap = new Map<string, string>();
      for (const m of (dash.members || []) as { objectId: string | null; name: string }[]) {
        if (m.objectId && !candidateMap.has(m.objectId)) candidateMap.set(m.objectId, m.name || "Member");
      }
      for (const f of (dash.followers || []) as { objectId: string | null; name: string }[]) {
        if (f.objectId && !candidateMap.has(f.objectId)) candidateMap.set(f.objectId, f.name || "Follower");
      }
      setMembers([...candidateMap.entries()].map(([id, name]) => ({ id, name })));
      const activePlans = (cal?.activePlans || []) as {
        objectId: string;
        title: string;
        description: string;
        image: string | null;
        date: string;
        timezone: string | null;
        time: string | null;
        hostName: string;
        rsvpCount: number;
        location: { name: string; address: string; placeId?: string | null } | null;
        locations?: {
          objectId?: string | null;
          name: string | null;
          address: string | null;
          placeId?: string | null;
          time?: string | null;
        }[];
        isPoll?: boolean;
        pollOptionCount?: number;
        pollVoteCount?: number;
        pollClosesAt?: string | null;
        hideVenueUntilRsvp?: boolean;
        requireApproval?: boolean;
        planSeriesId?: string | null;
      }[];
      const realPlans: UpcomingPlan[] = activePlans.map((p) => ({
        objectId: p.objectId,
        title: p.title,
        description: p.description || "",
        image: p.image,
        expiryDate: p.date,
        timezone: p.timezone ?? null,
        time: p.time,
        rsvpCount: p.rsvpCount,
        host: p.hostName ? { name: p.hostName } : null,
        location: p.location ? { name: p.location.name, address: p.location.address } : null,
        locations: p.locations,
        isPoll: p.isPoll,
        pollOptionCount: p.pollOptionCount,
        pollVoteCount: p.pollVoteCount,
        pollClosesAt: p.pollClosesAt,
        hideVenueUntilRsvp: p.hideVenueUntilRsvp,
        requireApproval: p.requireApproval,
        planSeriesId: p.planSeriesId,
      }));
      // Show real plans right away; AI events fold in on the next await.
      setUpcomingPlans(realPlans);
      const page = await Parse.Cloud.run("getOrgCalendarPage", { shareId });
      // Merge AI starter events (from the adopted AICalendar's snapshot) so
      // the manager sees them alongside real plans. Never a host until they
      // "Plan This" and a real EventGroup gets created. Skip past dates so
      // the section doesn't accrue stale entries — Shape B events with a
      // locked dateISO in the past drop out here.
      const aiEvents = (page.aiSourceEvents || []) as Array<{
        name: string;
        time: string;
        venueLine: string;
        tag: string;
        tagVariant?: "default" | "amber";
        isoDatetime?: string | null;
        dateISO?: string | null;
      }>;
      const aiStarters: UpcomingPlan[] = aiEvents
        .map((ev, index) => ({ ev, index, resolved: resolveAIStarterDate(ev) }))
        .filter((r) => r.resolved !== null)
        .map(({ ev, index, resolved }) => ({
          objectId: `ai-${index}`,
          title: ev.name,
          description: "",
          image: null,
          expiryDate: (resolved as Date).toISOString(),
          timezone: null,
          time: ev.time,
          rsvpCount: 0,
          host: null,
          location: ev.venueLine ? { name: ev.name, address: ev.venueLine } : null,
          isAIStarter: true,
          aiEventIndex: index,
          aiVenueLine: ev.venueLine,
          aiTag: ev.tag || "Event",
          aiTagVariant: ev.tagVariant === "amber" ? "amber" : "default",
        }));
      const merged = [...realPlans, ...aiStarters].sort(
        (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
      );
      setUpcomingPlans(merged);
      const allIdeas = (page.planIdeas || []).map((idea: { objectId: string; title: string; description: string; date: string; image: string | null; location: { name: string; address: string } | null; ideaSeriesId?: string | null; interestCount?: number }) => ({
        objectId: idea.objectId,
        title: idea.title,
        description: idea.description,
        date: idea.date,
        image: idea.image || null,
        location: idea.location,
        ideaSeriesId: idea.ideaSeriesId || null,
        interestCount: typeof idea.interestCount === "number" ? idea.interestCount : 0,
      }));
      const seen = new Set<string>();
      setPlanIdeas(allIdeas.filter((idea: PlanIdea) => {
        if (seen.has(idea.title)) return false;
        seen.add(idea.title);
        return true;
      }));
    } catch {
      // Failed
    } finally {
      setLoadingIdeas(false);
    }
  }

  function resetForm() {
    setCreatePlanPrefill(null);
    setEditingPlanId(null);
  }

  async function fetchPastPlans() {
    if (pastPlans !== null) return;
    setLoadingPast(true);
    try {
      const result = await Parse.Cloud.run("getCalendarPastPlans", { calendarId });
      setPastPlans(result.plans || []);
    } catch {
      setPastPlans([]);
    } finally {
      setLoadingPast(false);
    }
  }

  // Copy the plan's public direct link (/p/<eventGroupId>) to the clipboard so
  // the owner can share a single event without routing people through the whole
  // calendar page. Same canonical URL the SMS/share flows use.
  async function copyPlanLink(objectId: string) {
    try {
      const url = `${window.location.origin}/p/${objectId}`;
      await navigator.clipboard.writeText(url);
      setCopiedPlanId(objectId);
      setTimeout(() => setCopiedPlanId((cur) => (cur === objectId ? null : cur)), 2000);
    } catch {
      // Clipboard blocked (permissions / insecure context) — silently no-op;
      // the owner can still open the plan and share from there.
    }
  }

  async function openPhotosModal(plan: PastPlan) {
    setPhotosModalPlan(plan);
    setModalPhotos(null);
    setModalRsvps(null);
    Parse.Cloud.run("getEventPhotos", { eventGroupId: plan.objectId })
      .then((result: { photos: EventPhoto[] }) => setModalPhotos(result.photos || []))
      .catch(() => setModalPhotos([]));
    Parse.Cloud.run("getPlanRsvps", { eventGroupId: plan.objectId })
      .then((result: PastPlanRsvp[]) =>
        setModalRsvps((result || []).filter((r) => r.status === "Accepted"))
      )
      .catch(() => setModalRsvps([]));
  }

  async function handleRegenerate() {
    if (tierLoaded && tier === "starter") {
      setShowUpgradeModal(true);
      return;
    }
    setRegenerating(true);
    const startCount = planIdeas.length;
    try {
      await Parse.Cloud.run("generateCalendarPlansForOne", { calendarId, count: 3 });
      const maxAttempts = 20;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const dash = await Parse.Cloud.run("getOrgDashboard", { calendarId });
          const page = await Parse.Cloud.run("getOrgCalendarPage", { shareId: dash.shareId });
          const rawIdeas = (page.planIdeas || []).map((idea: { objectId: string; title: string; description: string; date: string; image: string | null; location: { name: string; address: string } | null; ideaSeriesId?: string | null }) => ({
            objectId: idea.objectId,
            title: idea.title,
            description: idea.description,
            date: idea.date,
            image: idea.image || null,
            location: idea.location,
            ideaSeriesId: idea.ideaSeriesId || null,
          }));
          const seenTitles = new Set<string>();
          const ideas = rawIdeas.filter((idea: PlanIdea) => {
            if (seenTitles.has(idea.title)) return false;
            seenTitles.add(idea.title);
            return true;
          });
          if (ideas.length > startCount) {
            setPlanIdeas(ideas);
            break;
          }
        } catch {
          // Keep polling
        }
      }
    } catch (err) {
      console.error("Regenerate failed:", err);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSubscriptionChange(newTier: string, billingPeriod: "monthly" | "yearly" = "monthly") {
    setSubscriptionLoading(true);
    try {
      if (newTier === "starter") {
        if (!confirm("Switching to Starter will cancel your subscription at the end of the current billing period. Continue?")) {
          setSubscriptionLoading(false);
          return;
        }
        await Parse.Cloud.run("cancelOrgSubscription", { calendarId });
        setTier("starter");
        setShowUpgradeModal(false);
      } else {
        const result = await Parse.Cloud.run("createOrgSubscriptionCheckout", {
          calendarId,
          tier: newTier,
          billingPeriod,
          returnUrl: `${window.location.origin}/dashboard/${orgId}?tab=calendars`,
        });
        if (result?.url) {
          window.location.href = result.url;
        } else {
          throw new Error("Checkout session could not be created.");
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update subscription";
      alert(message);
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function handleRemoveIdea(ideaId: string) {
    // Warn the owner/co-host when followers have already marked interest —
    // deleting drops a suggestion people are waiting on, so make it deliberate.
    const idea = planIdeas.find((p) => p.objectId === ideaId);
    const interested = idea?.interestCount ?? 0;
    const message =
      interested > 0
        ? `${interested} follower${interested === 1 ? "" : "s"} ${interested === 1 ? "is" : "are"} interested in this suggested plan. Delete it anyway?`
        : "Remove this suggested plan?";
    if (!confirm(message)) return;
    try {
      await Parse.Cloud.run("removePlanIdea", { ideaId, calendarId });
      setPlanIdeas((prev) => prev.filter((p) => p.objectId !== ideaId));
    } catch (err) {
      console.error("Failed to remove idea:", err);
    }
  }

  // Open the suggestion in the create modal, prefilled — the owner/co-host
  // can tweak details and publish it themselves ("Edit").
  function openIdeaEditor(idea: PlanIdea) {
    const spread = spreadDateOf(idea);
    setCreatePlanPrefill({
      title: idea.title,
      description: idea.description,
      date: spread ? spread.toISOString().split("T")[0] : "",
      time: "",
      capacity: "",
      venue: idea.location || null,
      imageUrl: idea.image || undefined,
    });
    setEditingPlanId(null);
    setShowCreateModal(true);
  }

  // Assign a member as the host of a suggestion — publishes it live hosted by
  // them (server: assignPlanIdeaHost). Owner/co-host only; the Calendars tab
  // is already gated to those roles.
  async function handleAssignHost(idea: PlanIdea, hostUserId: string) {
    setAssignBusyUserId(hostUserId);
    setAssignError(null);
    try {
      const spread = spreadDateOf(idea);
      await Parse.Cloud.run("assignPlanIdeaHost", {
        calendarPlanId: idea.objectId,
        hostUserId,
        date: spread ? spread.toISOString() : idea.date || undefined,
      });
      setPlanIdeas((prev) => prev.filter((p) => p.objectId !== idea.objectId));
      setAssigningIdea(null);
    } catch (err) {
      console.error("Failed to assign host:", err);
      setAssignError(err instanceof Error ? err.message : "Failed to assign host");
    } finally {
      setAssignBusyUserId(null);
    }
  }

  async function handleEndSeries(ideaSeriesId: string) {
    if (!confirm("End this recurring idea? Future instances will stop being created. The current idea stays.")) return;
    try {
      await Parse.Cloud.run("endIdeaSeries", { ideaSeriesId });
      setPlanIdeas((prev) => prev.map((p) => p.ideaSeriesId === ideaSeriesId ? { ...p, ideaSeriesId: null } : p));
    } catch (err) {
      console.error("Failed to end series:", err);
      alert(err instanceof Error ? err.message : "Failed to end series");
    }
  }

  function handleDuplicatePlan(plan: PlanDetailData, pollOptions?: { date: string; time: string }[]) {
    setCreatePlanPrefill({
      title: plan.title,
      description: plan.description,
      venue: plan.location,
      imageUrl: plan.image,
      ...(plan.isPoll ? { mode: "poll" as const, pollOptions } : {}),
    });
    setEditingPlanId(null);
    setSelectedPlan(null);
    setShowCreateModal(true);
  }

  function handleEditPlan(plan: PlanDetailData, pollOptions?: { date: string; time: string }[], pollClosesAt?: string) {
    if (plan.isPoll) {
      setCreatePlanPrefill({
        title: plan.title,
        description: plan.description,
        venue: plan.location,
        imageUrl: plan.image,
        mode: "poll",
        pollOptions,
        pollClosesAt,
        hideVenueUntilRsvp: plan.hideVenueUntilRsvp,
        requireApproval: plan.requireApproval,
      });
      setEditingPlanId(plan.objectId);
      setSelectedPlan(null);
      setShowCreateModal(true);
      return;
    }
    const planDate = plan.date ? formatDateInputInTimezone(plan.date, plan.timezone) : "";
    // For multi-stop plans the primary Venue field stays at stop 0; stops
    // 1..N flow into `additionalStops`. Poll edits keep single-venue since
    // the poll surface itself is single-card.
    const extraStops = (plan.locations || []).slice(1).map((loc) => ({
      objectId: loc.objectId ?? null,
      name: loc.name || "",
      address: loc.address || "",
      placeId: null,
      time: loc.time || null,
    }));
    setCreatePlanPrefill({
      title: plan.title,
      description: plan.description,
      venue: plan.location,
      date: planDate,
      time: plan.time || "",
      imageUrl: plan.image,
      hideVenueUntilRsvp: plan.hideVenueUntilRsvp,
      requireApproval: plan.requireApproval,
      additionalStops: extraStops.length > 0 ? extraStops : undefined,
    });
    setEditingPlanId(plan.objectId);
    setSelectedPlan(null);
    setShowCreateModal(true);
  }

  return (
    <div className="space-y-10">
        {/* Plans (Upcoming / Past) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                {planTense === "upcoming" ? "Upcoming" : "Past"}
              </h2>
              <button
                onClick={() => { resetForm(); setShowCreateModal(true); }}
                className="inline-flex items-center gap-1 border border-zinc-200 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition-colors"
                aria-label="New plan"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>
            <div className="flex gap-1 border border-zinc-200 rounded-lg p-0.5">
              <button
                onClick={() => setPlanTense("upcoming")}
                className={`px-3 py-1.5 text-xs uppercase tracking-widest font-bold rounded-md transition-colors ${
                  planTense === "upcoming" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Upcoming
              </button>
              <button
                onClick={() => { setPlanTense("past"); fetchPastPlans(); }}
                className={`px-3 py-1.5 text-xs uppercase tracking-widest font-bold rounded-md transition-colors ${
                  planTense === "past" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Past
              </button>
            </div>
          </div>

          {planTense === "upcoming" ? (
            upcomingPlans.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {upcomingPlans.map((plan) => {
                  const isAI = !!plan.isAIStarter;
                  return (
                  <div
                    key={plan.objectId}
                    onClick={() => {
                      if (isAI) {
                        // AI starter → open the New Plan drawer prefilled
                        // so the manager can convert it into a real plan.
                        setCreatePlanPrefill({
                          title: plan.title,
                          description: plan.description || "",
                          venue: plan.location
                            ? { name: plan.location.name, address: plan.aiVenueLine || plan.location.address, placeId: null }
                            : null,
                          date: plan.expiryDate.slice(0, 10),
                          time: plan.time || undefined,
                        });
                        setShowCreateModal(true);
                        return;
                      }
                      setSelectedPlan(plan);
                    }}
                    className={`group relative border rounded-lg overflow-hidden hover:border-zinc-200 transition-colors shrink-0 w-52 cursor-pointer ${isAI ? "border-emerald-200/70 bg-emerald-50/30" : "border-zinc-100"}`}
                  >
                    {isAI ? (
                      // Placeholder cover matches /org/<shareId>: gradient
                      // ground + the tag rendered LARGE in serif, so the
                      // manager and the public visitor see the SAME card.
                      (() => {
                        const isAmber = plan.aiTagVariant === "amber";
                        return (
                          <div
                            className="relative w-full h-28 flex items-center justify-center"
                            style={{
                              background: isAmber
                                ? "linear-gradient(135deg, #f5e6d0 0%, #e8d1a5 100%)"
                                : "linear-gradient(135deg, #e8efe9 0%, #cddcd0 100%)",
                            }}
                          >
                            <div
                              className="absolute inset-0 opacity-[0.07]"
                              style={{
                                backgroundImage:
                                  "radial-gradient(circle at 25% 30%, rgba(0,0,0,0.15) 1px, transparent 2px)",
                                backgroundSize: "18px 18px",
                              }}
                            />
                            <span
                              className="relative text-2xl font-light tracking-tight text-center px-4 truncate max-w-full"
                              style={{
                                fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                                color: isAmber ? "#8A5F1E" : "#1B4332",
                                letterSpacing: "-0.01em",
                              }}
                            >
                              {(plan.aiTag || "Event").toLowerCase()}
                            </span>
                            <span
                              className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5"
                              style={{
                                background: "rgba(255,255,255,0.85)",
                                color: isAmber ? "#8A5F1E" : "#1B4332",
                                backdropFilter: "blur(4px)",
                              }}
                            >
                              Suggestion
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <PlanImage src={plan.image} alt={plan.title} className="w-full h-28" />
                    )}
                    <div className="p-3">
                      <h4 className="font-medium text-sm mb-1 truncate">{plan.title}</h4>
                      <p className="text-xs text-zinc-400 mb-1">
                        {new Date(plan.expiryDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(plan.timezone ? { timeZone: plan.timezone } : {}) })}
                      </p>
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span className="truncate">{isAI ? "Waiting on host" : plan.host?.name || "You"}</span>
                        {!isAI && (
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span>{plan.rsvpCount} RSVPs</span>
                            {/* Quiet copy-link icon — grabs the shareable /p/<id>
                                URL without opening the plan or the public
                                calendar. Kept out of the hover overlay so the
                                cover stays a clean Details/Chat affordance. */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyPlanLink(plan.objectId);
                              }}
                              title="Copy direct link to this plan"
                              aria-label="Copy direct link to this plan"
                              className="p-1 -m-1 rounded text-zinc-300 hover:text-zinc-700 transition-colors"
                            >
                              {copiedPlanId === plan.objectId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Hover overlay — two-action panel over the cover
                        image. Skipped for AI starters (the card click
                        already routes to the create-plan flow, and
                        there's no chat on an unhosted suggestion). */}
                    {!isAI && (
                      <div className="absolute inset-x-0 top-0 h-28 bg-zinc-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlan(plan);
                          }}
                          className="inline-flex items-center gap-1.5 bg-white text-zinc-900 text-[11px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-full hover:bg-zinc-50 transition-colors"
                        >
                          <Calendar className="w-3 h-3" />
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setChatPlanId(plan.objectId);
                          }}
                          className="inline-flex items-center gap-1.5 bg-white text-zinc-900 text-[11px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-full hover:bg-zinc-50 transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" />
                          Chat
                        </button>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No upcoming plans yet.</p>
            )
          ) : loadingPast ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
          ) : pastPlans && pastPlans.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pastPlans.map((plan) => (
                <button
                  key={plan.objectId}
                  onClick={() => openPhotosModal(plan)}
                  className="text-left border border-zinc-100 rounded-lg overflow-hidden hover:border-zinc-200 transition-colors flex"
                >
                  <PlanImage
                    src={plan.image}
                    alt={plan.title}
                    className="w-24 h-24 flex-shrink-0"
                  />
                  <div className="p-3 flex-1 min-w-0">
                    <h4 className="font-medium text-sm mb-1 truncate">{plan.title}</h4>
                    <p className="text-xs text-zinc-400 mb-2">
                      {new Date(plan.expiryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(plan.timezone ? { timeZone: plan.timezone } : {}) })}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                      {plan.rsvpCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 whitespace-nowrap">
                          <UserCheck className="w-3 h-3" />
                          {plan.attendanceCount}/{plan.rsvpCount} attended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <Users className="w-3 h-3" />
                          0 RSVPs
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Camera className="w-3 h-3" />
                        {plan.photoCount} {plan.photoCount === 1 ? "photo" : "photos"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No past plans yet.</p>
          )}
        </section>

        {/* Existing Plan Ideas */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              Suggested Plans{hidePlanIdeas ? "" : ` (${planIdeas.length})`}
            </h2>
            {!hidePlanIdeas && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
              >
                {tierLoaded && tier === "starter" ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
                )}
                {regenerating ? "Generating..." : "Regenerate"}
              </button>
            )}
          </div>

          {hidePlanIdeas ? (
            <div className="border border-zinc-200 rounded-xl p-6 text-center space-y-3">
              <p className="text-sm text-zinc-500">Suggested plans are turned off for this calendar.</p>
              <Link
                href={`/dashboard/${orgId}?tab=calendars&editCal=${calendarId}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Calendar settings
              </Link>
            </div>
          ) : loadingIdeas ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
            </div>
          ) : planIdeas.length === 0 ? (
            <p className="text-sm text-zinc-400 py-4">No suggested plans yet.</p>
          ) : (
            // Same card language as the Upcoming row (image-top, compact),
            // just a touch narrower. Owner/co-host actions reveal on hover
            // (always visible on touch, where there's no hover).
            <div className="flex gap-3 overflow-x-auto pb-1">
              {[...planIdeas]
                .sort((a, b) => {
                  const at = spreadDateOf(a)?.getTime() ?? Number.POSITIVE_INFINITY;
                  const bt = spreadDateOf(b)?.getTime() ?? Number.POSITIVE_INFINITY;
                  if (at !== bt) return at - bt;
                  return a.objectId < b.objectId ? -1 : a.objectId > b.objectId ? 1 : 0;
                })
                .map((idea) => {
                  const d = spreadDateOf(idea);
                  return (
                    <div
                      key={idea.objectId}
                      className="group relative border border-zinc-100 rounded-lg overflow-hidden shrink-0 w-48 hover:border-zinc-200 transition-colors"
                    >
                      <div className="relative">
                        <PlanImage src={idea.image} alt={idea.title} className="w-full h-28" />
                        <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-white/85 text-[#1B4332] backdrop-blur-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1B4332]" />
                          Needs a host
                        </span>
                        {idea.ideaSeriesId && (
                          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider text-zinc-700 bg-white/85 backdrop-blur-sm">
                            <Repeat className="w-3 h-3" /> Recurring
                          </span>
                        )}
                        {/* Owner/co-host actions overlay the cover (matches the
                            Upcoming cards) so the footer text stays full-width
                            and "Waiting on host" isn't truncated. */}
                        <div className="absolute inset-0 bg-zinc-900/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
                          <button
                            onClick={() => openIdeaEditor(idea)}
                            className="p-2 bg-white rounded-full text-zinc-900 hover:bg-zinc-50 transition-colors"
                            title="Edit and publish"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setAssignError(null); setAssigningIdea(idea); }}
                            className="p-2 bg-white rounded-full text-zinc-900 hover:bg-zinc-50 transition-colors"
                            title="Assign a host"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          {idea.ideaSeriesId && (
                            <button
                              onClick={() => handleEndSeries(idea.ideaSeriesId!)}
                              className="p-2 bg-white rounded-full text-zinc-700 hover:bg-zinc-50 transition-colors"
                              title="End recurring series"
                            >
                              <Repeat className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveIdea(idea.objectId)}
                            className="p-2 bg-white rounded-full text-red-500 hover:bg-zinc-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="font-medium text-sm mb-1 truncate">{idea.title}</h4>
                        <p className="text-xs text-zinc-400 mb-1">
                          {d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Waiting on host"}
                        </p>
                        <p className="text-xs">
                          {idea.interestCount > 0 ? (
                            <span className="text-emerald-600 font-medium">{idea.interestCount} interested</span>
                          ) : (
                            <span className="text-zinc-400">Waiting on host</span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

      {/* Per-plan chat drawer — right-side slide-over. Opens from the
          hover overlay's Chat button so the owner stays inside the
          dashboard rather than navigating to /chat/[eventGroupId]. */}
      {chatPlanId && (
        <PlanChatDrawer
          eventGroupId={chatPlanId}
          onClose={() => setChatPlanId(null)}
        />
      )}

      {/* Plan Detail Modal */}
      {selectedPlan && (
        <PlanDetailModal
          plan={{
            objectId: selectedPlan.objectId,
            title: selectedPlan.title,
            description: selectedPlan.description,
            image: selectedPlan.image,
            date: selectedPlan.expiryDate,
            timezone: selectedPlan.timezone,
            time: selectedPlan.time,
            hostName: selectedPlan.host?.name || "You",
            rsvpCount: selectedPlan.rsvpCount,
            location: selectedPlan.location,
            locations: selectedPlan.locations,
            isPoll: selectedPlan.isPoll,
            pollOptionCount: selectedPlan.pollOptionCount,
            pollVoteCount: selectedPlan.pollVoteCount,
            pollClosesAt: selectedPlan.pollClosesAt,
            hideVenueUntilRsvp: selectedPlan.hideVenueUntilRsvp,
            requireApproval: selectedPlan.requireApproval,
            planSeriesId: selectedPlan.planSeriesId,
          }}
          onClose={() => setSelectedPlan(null)}
          onChanged={() => { fetchPlanIdeas(); }}
          onDuplicate={handleDuplicatePlan}
          onEdit={handleEditPlan}
        />
      )}

      {/* Create/Edit Plan Modal */}
      {showCreateModal && (
        <CreatePlanModal
          calendarId={calendarId}
          tier={tier}
          prefill={createPlanPrefill}
          editMode={!!editingPlanId}
          eventGroupId={editingPlanId || undefined}
          onClose={() => {
            setShowCreateModal(false);
            // Cancelled (no create) + returnTo set => bounce back to where the
            // user came from (e.g. /m/{notificationId}).
            if (!planCreatedRef.current && returnTo && returnTo.startsWith("/")) {
              router.replace(returnTo);
            }
            planCreatedRef.current = false;
            resetForm();
          }}
          onCreated={() => {
            planCreatedRef.current = true;
            fetchPlanIdeas();
          }}
        />
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <SubscriptionModal
          currentTier={tier}
          onSelect={handleSubscriptionChange}
          onClose={() => setShowUpgradeModal(false)}
          loading={subscriptionLoading}
        />
      )}

      {/* Assign-a-Host picker — publishes the suggestion live, hosted by the
          chosen member (server assigns them, no self-host approval needed). */}
      {assigningIdea && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          onClick={() => { if (!assignBusyUserId) setAssigningIdea(null); }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-zinc-100">
              <div className="min-w-0">
                <h3 className="text-lg font-medium text-zinc-900 truncate">Assign a host</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Publishes <span className="font-medium text-zinc-600">{assigningIdea.title}</span> live, hosted by the member or follower you pick.
                </p>
              </div>
              <button
                onClick={() => { if (!assignBusyUserId) setAssigningIdea(null); }}
                className="p-1.5 rounded-full hover:bg-zinc-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5 text-zinc-500" />
              </button>
            </div>
            {assignError && (
              <p className="text-xs text-red-500 px-5 pt-3">{assignError}</p>
            )}
            <div className="overflow-y-auto p-2">
              {members.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8 px-4">
                  No members or followers yet. Once people join your calendar you can assign them as hosts.
                </p>
              ) : (
                members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleAssignHost(assigningIdea, m.id)}
                    disabled={!!assignBusyUserId}
                    className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-lg hover:bg-zinc-50 transition-colors text-left disabled:opacity-50"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-zinc-400" />
                      </span>
                      <span className="text-sm font-medium text-zinc-900 truncate">{m.name}</span>
                    </span>
                    {assignBusyUserId === m.id ? (
                      <span className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin shrink-0" />
                    ) : (
                      <UserCheck className="w-4 h-4 text-zinc-300 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Past Plan Photos Modal */}
      {photosModalPlan && (
        <div
          className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
          onClick={() => { setPhotosModalPlan(null); setModalPhotos(null); setModalRsvps(null); }}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-zinc-100">
              <div className="min-w-0">
                <h3 className="text-lg font-medium text-zinc-900 truncate">{photosModalPlan.title}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {new Date(photosModalPlan.expiryDate).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                    ...(photosModalPlan.timezone ? { timeZone: photosModalPlan.timezone } : {}),
                  })}
                  {" · "}
                  {photosModalPlan.photoCount} {photosModalPlan.photoCount === 1 ? "photo" : "photos"}
                </p>
              </div>
              <button
                onClick={() => { setPhotosModalPlan(null); setModalPhotos(null); setModalRsvps(null); }}
                className="text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-6">
              <section>
                <div className="flex items-baseline justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Attendance
                    {modalRsvps !== null ? ` (${modalRsvps.length})` : ""}
                  </h4>
                  {modalRsvps !== null && modalRsvps.length > 0 && (() => {
                    const attended = modalRsvps.filter((r) => r.attendedAt || r.checkedInViaMobile).length;
                    const pct = Math.round((attended / modalRsvps.length) * 100);
                    return (
                      <span className="text-[11px] text-zinc-500">
                        {attended}/{modalRsvps.length} attended ({pct}%)
                      </span>
                    );
                  })()}
                </div>
                {modalRsvps === null ? (
                  <div className="flex items-center py-4">
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
                  </div>
                ) : modalRsvps.length === 0 ? (
                  <p className="text-sm text-zinc-400">No RSVPs.</p>
                ) : (
                  <>
                  {attendanceError && (
                    <p className="text-xs text-red-600 mb-2 break-words">{attendanceError}</p>
                  )}
                  <ul className="divide-y divide-zinc-100 border border-zinc-100 rounded-lg">
                    {modalRsvps.map((r) => {
                      const attended = !!r.attendedAt || r.checkedInViaMobile;
                      const badge = r.checkedInViaMobile
                        ? { label: "Checked in", cls: "text-emerald-700 bg-emerald-50" }
                        : r.attendedAt
                        ? { label: "Attended", cls: "text-emerald-700 bg-emerald-50" }
                        : { label: "No-show", cls: "text-zinc-500 bg-zinc-100" };
                      const editable = !r.checkedInViaMobile && !!photosModalPlan;
                      const isBusy = markingAttendeeId === r.notificationId;
                      return (
                        <li key={r.notificationId} className="flex items-center justify-between px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {attended ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
                            )}
                            <span className="text-sm text-zinc-800 truncate">{r.name}</span>
                          </div>
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => toggleAttendance(photosModalPlan!.objectId, r)}
                              disabled={isBusy}
                              title={r.attendedAt ? "Click to mark as no-show" : "Click to mark as attended"}
                              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 hover:opacity-80 cursor-pointer ${badge.cls}`}
                            >
                              {isBusy ? "..." : badge.label}
                            </button>
                          ) : (
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge.cls}`}
                              title="Checked in via the Leaf app — can't be edited"
                            >
                              {badge.label}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  </>
                )}
              </section>

              <section>
                <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">
                  Photos
                  {modalPhotos !== null ? ` (${modalPhotos.length})` : ""}
                </h4>
                {modalPhotos === null ? (
                  <div className="flex items-center py-4">
                    <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" />
                  </div>
                ) : modalPhotos.length === 0 ? (
                  <p className="text-sm text-zinc-400">No photos uploaded yet.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {modalPhotos.map((photo) =>
                      photo.url ? (
                        <a
                          key={photo.objectId}
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block aspect-square rounded-lg overflow-hidden bg-zinc-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt={`Photo by ${photo.uploaderName}`}
                            className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ) : null
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
