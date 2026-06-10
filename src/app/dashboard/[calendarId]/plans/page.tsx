"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import SubscriptionModal from "@/components/SubscriptionModal";
import CreatePlanModal, { type CreatePlanPrefill } from "@/components/CreatePlanModal";
import PlanDetailModal, { type PlanDetailData } from "@/components/PlanDetailModal";
import { ArrowLeft, Calendar, Camera, Check, Lock, MapPin, Plus, RefreshCw, Repeat, Settings, Trash2, UserCheck, Users, X } from "lucide-react";

interface PlanIdea {
  objectId: string;
  title: string;
  description: string;
  date: string;
  image: string | null;
  location: { name: string; address: string } | null;
  ideaSeriesId: string | null;
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
  isPoll?: boolean;
  pollOptionCount?: number;
  pollVoteCount?: number;
  pollClosesAt?: string | null;
  hideVenueUntilRsvp?: boolean;
  requireApproval?: boolean;
  planSeriesId?: string | null;
}

export default function PlansPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarId = params.calendarId as string;
  // For child calendars, orgId (parent org) is passed as a query param.
  // Use it for getOrgDashboard calls; use calendarId for plan operations.
  const orgId = searchParams.get("orgId") || calendarId;

  const [user, setUser] = useState<Parse.User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [tier, setTier] = useState("starter");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<UpcomingPlan | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [createPlanPrefill, setCreatePlanPrefill] = useState<CreatePlanPrefill | null>(null);
  // Tracks whether the current create-plan modal session resulted in a save.
  // Used together with the ?returnTo query param to decide where to send the
  // user on close: created => stay on dashboard, cancelled => returnTo (/m page).
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
      // Keep the past-plans card rollup ("X/Y attended") in sync with the
      // toggle. Without this the card still shows the count from when the
      // tab was first loaded until a full refresh.
      setPastPlans((prev) =>
        prev
          ? prev.map((p) =>
              p.objectId === eventGroupId
                ? {
                    ...p,
                    attendanceCount: Math.max(
                      0,
                      p.attendanceCount + (nextAttended ? 1 : -1)
                    ),
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

  // Plan ideas
  const [planIdeas, setPlanIdeas] = useState<PlanIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [hidePlanIdeas, setHidePlanIdeas] = useState(false);

  // Upgrade gate
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);

  useEffect(() => {
    try {
      const current = Parse.User.current();
      if (current) setUser(current);
    } catch {
      // No session
    }
    setAuthChecked(true);
  }, []);

  // Pre-fill form from marketplace event (URL params)
  useEffect(() => {
    const prefillTitle = searchParams.get("prefillTitle");
    if (prefillTitle) {
      let venue: { name: string; address: string } | undefined;
      const venueStr = searchParams.get("prefillVenue");
      if (venueStr) {
        try {
          const v = JSON.parse(venueStr);
          venue = { name: v.name, address: v.address };
        } catch {
          // Invalid venue JSON
        }
      }
      setCreatePlanPrefill({
        title: prefillTitle,
        description: searchParams.get("prefillDescription") || "",
        date: searchParams.get("prefillDate") || "",
        time: searchParams.get("prefillTime") || "",
        capacity: searchParams.get("prefillCapacity") || "",
        venue: venue || null,
      });
      setShowCreateModal(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    fetchOrgInfo();
    fetchPlanIdeas();
  }, [user, calendarId]);

  async function fetchOrgInfo() {
    try {
      const result = await Parse.Cloud.run("getOrgDashboard", { calendarId: orgId });
      // If viewing a child calendar, find its name and settings from the calendars list
      if (orgId !== calendarId && result.calendars) {
        const child = result.calendars.find((c: { objectId: string; name: string; hidePlanIdeas?: boolean }) => c.objectId === calendarId);
        if (child) {
          setOrgName(child.name);
          setHidePlanIdeas(child.hidePlanIdeas || false);
        } else {
          setOrgName(result.name);
          setHidePlanIdeas(result.hidePlanIdeas || false);
        }
      } else {
        setOrgName(result.name);
        setHidePlanIdeas(result.hidePlanIdeas || false);
      }
      setTier(result.tier);
    } catch {
      // Failed to load
    }
  }

  async function fetchPlanIdeas() {
    setLoadingIdeas(true);
    try {
      // Upcoming plans come from getOrgDashboard's activePlans — getOrgCalendarPage
      // is a public-visitor endpoint that returns plans:[] for private calendars
      // when no phoneNumber is supplied. Plan ideas are still pulled from
      // getOrgCalendarPage since they aren't exposed on the dashboard response.
      const dash = await Parse.Cloud.run("getOrgDashboard", { calendarId: orgId });
      let shareId = dash.shareId;
      const cal = dash.calendars?.find((c: { objectId: string }) => c.objectId === calendarId);
      if (cal?.shareId) shareId = cal.shareId;
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
        isPoll?: boolean;
        pollOptionCount?: number;
        pollVoteCount?: number;
        pollClosesAt?: string | null;
        hideVenueUntilRsvp?: boolean;
        requireApproval?: boolean;
        planSeriesId?: string | null;
      }[];
      setUpcomingPlans(
        activePlans.map((p) => ({
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
          isPoll: p.isPoll,
          pollOptionCount: p.pollOptionCount,
          pollVoteCount: p.pollVoteCount,
          pollClosesAt: p.pollClosesAt,
          hideVenueUntilRsvp: p.hideVenueUntilRsvp,
          requireApproval: p.requireApproval,
          planSeriesId: p.planSeriesId,
        }))
      );
      const page = await Parse.Cloud.run("getOrgCalendarPage", { shareId });
      const allIdeas = (page.planIdeas || []).map((idea: { objectId: string; title: string; description: string; date: string; image: string | null; location: { name: string; address: string } | null; ideaSeriesId?: string | null }) => ({
        objectId: idea.objectId,
        title: idea.title,
        description: idea.description,
        date: idea.date,
        image: idea.image || null,
        location: idea.location,
        ideaSeriesId: idea.ideaSeriesId || null,
      }));
      // Deduplicate by title (backend may return duplicate plan ideas)
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
    // Starter tier can't regenerate ideas — show the upgrade modal instead.
    if (tier === "starter") {
      setShowUpgradeModal(true);
      return;
    }
    setRegenerating(true);
    const startCount = planIdeas.length;
    try {
      await Parse.Cloud.run("generateCalendarPlansForOne", {
        calendarId,
        count: 3,
      });
      // Poll until new plans appear (generation runs in the background on the server)
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
        // Paid upgrade — open Stripe Checkout
        const result = await Parse.Cloud.run("createOrgSubscriptionCheckout", {
          calendarId,
          tier: newTier,
          billingPeriod,
          returnUrl: `${window.location.origin}/dashboard/${calendarId}/plans`,
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
    if (!confirm("Remove this plan idea?")) return;
    try {
      await Parse.Cloud.run("removePlanIdea", { ideaId, calendarId });
      setPlanIdeas((prev) => prev.filter((p) => p.objectId !== ideaId));
    } catch (err) {
      console.error("Failed to remove idea:", err);
    }
  }

  async function handleEndSeries(ideaSeriesId: string) {
    if (!confirm("End this recurring idea? Future instances will stop being created. The current idea stays.")) return;
    try {
      await Parse.Cloud.run("endIdeaSeries", { ideaSeriesId });
      // Drop the series link locally so the badge disappears immediately on the
      // current instance. Already-materialized ideas remain claimable.
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
      ...(plan.isPoll
        ? { mode: "poll" as const, pollOptions }
        : {}),
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
    const planDate = plan.date ? (() => { const d = new Date(plan.date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })() : "";
    setCreatePlanPrefill({
      title: plan.title,
      description: plan.description,
      venue: plan.location,
      date: planDate,
      time: plan.time || "",
      imageUrl: plan.image,
      hideVenueUntilRsvp: plan.hideVenueUntilRsvp,
      requireApproval: plan.requireApproval,
    });
    setEditingPlanId(plan.objectId);
    setSelectedPlan(null);
    setShowCreateModal(true);
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-2xl font-light tracking-tight mb-2">Sign in to continue</h1>
          <p className="text-sm text-zinc-500 mb-8">You need to sign in to manage plans.</p>
          <GoogleSignInButton onSignIn={(u) => setUser(u)} onError={(err) => console.error(err)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-zinc-100">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/${searchParams.get("orgId") || calendarId}?tab=calendars`} className="p-2 hover:bg-zinc-50 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-medium tracking-tight">Plans</h1>
              <p className="text-xs text-zinc-400">{orgName}</p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Plan
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {/* Plans (Upcoming / Past) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              {planTense === "upcoming"
                ? `Upcoming Plans (${upcomingPlans.length})`
                : `Past Plans${pastPlans ? ` (${pastPlans.length})` : ""}`}
            </h2>
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
                onClick={() => {
                  setPlanTense("past");
                  fetchPastPlans();
                }}
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
              <div className="flex gap-3 overflow-x-auto no-scrollbar">
                {upcomingPlans.map((plan) => (
                  <div key={plan.objectId} onClick={() => setSelectedPlan(plan)} className="border border-zinc-100 rounded-lg overflow-hidden hover:border-zinc-200 transition-colors shrink-0 w-52 cursor-pointer">
                    {plan.image ? (
                      <img src={plan.image} alt={plan.title} className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 bg-zinc-100 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-zinc-300" />
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="font-medium text-sm mb-1 truncate">{plan.title}</h4>
                      <p className="text-xs text-zinc-400 mb-1">
                        {new Date(plan.expiryDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(plan.timezone ? { timeZone: plan.timezone } : {}) })}
                      </p>
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span className="truncate">{plan.host?.name || "You"}</span>
                        <span className="shrink-0 ml-2">{plan.rsvpCount} RSVPs</span>
                      </div>
                    </div>
                  </div>
                ))}
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
                  {plan.image ? (
                    <img src={plan.image} alt={plan.title} className="w-24 h-24 object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-24 h-24 bg-zinc-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-6 h-6 text-zinc-300" />
                    </div>
                  )}
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
              Active Plan Ideas ({planIdeas.length})
            </h2>
            {!hidePlanIdeas && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors disabled:opacity-50"
              >
                {tier === "starter" ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
                )}
                {regenerating ? "Generating..." : "Regenerate Ideas"}
              </button>
            )}
          </div>

          {hidePlanIdeas ? (
            <div className="border border-zinc-200 rounded-xl p-6 text-center space-y-3">
              <p className="text-sm text-zinc-500">Plan ideas are turned off for this calendar.</p>
              <Link
                href={`/dashboard/${searchParams.get("orgId") || calendarId}?tab=calendars&editCal=${calendarId}`}
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
            <p className="text-sm text-zinc-400 py-4">No active plan ideas.</p>
          ) : (
            <div className="space-y-3">
              {planIdeas.map((idea) => (
                <div
                  key={idea.objectId}
                  className="border border-zinc-200 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:border-zinc-400 transition-colors"
                  onClick={() => {
                    setCreatePlanPrefill({
                      title: idea.title,
                      description: idea.description,
                      date: idea.date ? new Date(idea.date).toISOString().split("T")[0] : "",
                      time: "",
                      capacity: "",
                      venue: idea.location || null,
                      imageUrl: idea.image || undefined,
                    });
                    setEditingPlanId(null);
                    setShowCreateModal(true);
                  }}
                >
                  {idea.image && (
                    <img src={idea.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate">{idea.title}</h3>
                      {idea.ideaSeriesId && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider text-zinc-600 bg-zinc-100 shrink-0">
                          <Repeat className="w-3 h-3" /> Recurring
                        </span>
                      )}
                    </div>
                    {idea.description && (
                      <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{idea.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                      {idea.date && (
                        <span>Preferred: {new Date(idea.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                      )}
                      {idea.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {idea.location.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {idea.ideaSeriesId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEndSeries(idea.ideaSeriesId!); }}
                      className="p-3 text-zinc-300 hover:text-zinc-700 transition-colors shrink-0 self-start"
                      title="End recurring series"
                    >
                      <Repeat className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemoveIdea(idea.objectId); }}
                    className="p-3 text-zinc-300 hover:text-red-500 transition-colors shrink-0 self-start"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Plan Detail Modal — shared component, same view as the dashboard active-plans modal */}
      {selectedPlan && (
        <PlanDetailModal
          plan={{
            objectId: selectedPlan.objectId,
            title: selectedPlan.title,
            description: selectedPlan.description,
            image: selectedPlan.image,
            date: selectedPlan.expiryDate,
            time: selectedPlan.time,
            hostName: selectedPlan.host?.name || "You",
            rsvpCount: selectedPlan.rsvpCount,
            location: selectedPlan.location,
            isPoll: selectedPlan.isPoll,
            pollOptionCount: selectedPlan.pollOptionCount,
            pollVoteCount: selectedPlan.pollVoteCount,
            pollClosesAt: selectedPlan.pollClosesAt,
            hideVenueUntilRsvp: selectedPlan.hideVenueUntilRsvp,
            requireApproval: selectedPlan.requireApproval,
            planSeriesId: selectedPlan.planSeriesId,
          }}
          onClose={() => setSelectedPlan(null)}
          onChanged={() => {
            // Removing/updating a plan invalidates the upcoming list — refetch.
            fetchPlanIdeas();
          }}
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
            const returnTo = searchParams.get("returnTo");
            // Cancelled (no create occurred) + returnTo set => bounce back to
            // wherever the user came from (e.g. /m/{notificationId}). On create,
            // stay on dashboard so the host can see their new plan land.
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

      {/* Upgrade Modal — shown when a starter user clicks Regenerate Ideas */}
      {showUpgradeModal && (
        <SubscriptionModal
          currentTier={tier}
          onSelect={handleSubscriptionChange}
          onClose={() => setShowUpgradeModal(false)}
          loading={subscriptionLoading}
        />
      )}

      {/* Past Plan Photos Modal */}
      {photosModalPlan && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => {
            setPhotosModalPlan(null);
            setModalPhotos(null);
            setModalRsvps(null);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-zinc-100">
              <div className="min-w-0">
                <h3 className="text-lg font-medium text-zinc-900 truncate">
                  {photosModalPlan.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {new Date(photosModalPlan.expiryDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    ...(photosModalPlan.timezone ? { timeZone: photosModalPlan.timezone } : {}),
                  })}
                  {" · "}
                  {photosModalPlan.photoCount}{" "}
                  {photosModalPlan.photoCount === 1 ? "photo" : "photos"}
                </p>
              </div>
              <button
                onClick={() => {
                  setPhotosModalPlan(null);
                  setModalPhotos(null);
                  setModalRsvps(null);
                }}
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
                    const attended = modalRsvps.filter(
                      (r) => r.attendedAt || r.checkedInViaMobile
                    ).length;
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
                    <p className="text-xs text-red-600 mb-2 break-words">
                      {attendanceError}
                    </p>
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
                        <li
                          key={r.notificationId}
                          className="flex items-center justify-between px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {attended ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
                            )}
                            <span className="text-sm text-zinc-800 truncate">
                              {r.name}
                            </span>
                          </div>
                          {editable ? (
                            <button
                              type="button"
                              onClick={() =>
                                toggleAttendance(photosModalPlan!.objectId, r)
                              }
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
