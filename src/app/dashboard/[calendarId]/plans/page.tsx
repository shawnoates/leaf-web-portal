"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import SubscriptionModal from "@/components/SubscriptionModal";
import CreatePlanModal, { type CreatePlanPrefill } from "@/components/CreatePlanModal";
import { ArrowLeft, Calendar, Clock, Copy, Lock, MapPin, Pencil, Plus, RefreshCw, Settings, Trash2, Users } from "lucide-react";

interface PlanIdea {
  objectId: string;
  title: string;
  description: string;
  date: string;
  image: string | null;
  location: { name: string; address: string } | null;
}

interface UpcomingPlan {
  objectId: string;
  title: string;
  description: string;
  image: string | null;
  expiryDate: string;
  time: string | null;
  rsvpCount: number;
  host: { name: string } | null;
  location: { name: string; address: string } | null;
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

  // Upcoming plans (hosted)
  const [upcomingPlans, setUpcomingPlans] = useState<UpcomingPlan[]>([]);

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
      // Use getOrgCalendarPage to get plan ideas for this calendar
      // First get the shareId (for child calendars, find it in the calendars list)
      const dash = await Parse.Cloud.run("getOrgDashboard", { calendarId: orgId });
      let shareId = dash.shareId;
      if (orgId !== calendarId && dash.calendars) {
        const child = dash.calendars.find((c: { objectId: string; shareId: string }) => c.objectId === calendarId);
        if (child) shareId = child.shareId;
      }
      const page = await Parse.Cloud.run("getOrgCalendarPage", { shareId });
      setUpcomingPlans(
        (page.plans || []).map((p: { objectId: string; title: string; description: string; image: string | null; expiryDate: string; time: string | null; rsvpCount: number; host: { name: string } | null; location: { name: string; address: string } | null }) => ({
          objectId: p.objectId,
          title: p.title,
          description: p.description || "",
          image: p.image,
          expiryDate: p.expiryDate,
          time: p.time,
          rsvpCount: p.rsvpCount,
          host: p.host,
          location: p.location,
        }))
      );
      const allIdeas = (page.planIdeas || []).map((idea: { objectId: string; title: string; description: string; date: string; image: string | null; location: { name: string; address: string } | null }) => ({
        objectId: idea.objectId,
        title: idea.title,
        description: idea.description,
        date: idea.date,
        image: idea.image || null,
        location: idea.location,
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
          const rawIdeas = (page.planIdeas || []).map((idea: { objectId: string; title: string; description: string; date: string; image: string | null; location: { name: string; address: string } | null }) => ({
            objectId: idea.objectId,
            title: idea.title,
            description: idea.description,
            date: idea.date,
            image: idea.image || null,
            location: idea.location,
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

  async function handleDeletePlan(planId: string) {
    if (!confirm("Cancel this plan? Attendees will be notified. This cannot be undone.")) return;
    try {
      await Parse.Cloud.run("removePlanFromCalendar", { eventGroupId: planId });
      setSelectedPlan(null);
      setUpcomingPlans((prev) => prev.filter((p) => p.objectId !== planId));
    } catch (err) {
      console.error("Failed to cancel plan:", err);
      alert("Failed to cancel plan.");
    }
  }

  function handleDuplicatePlan() {
    if (!selectedPlan) return;
    setCreatePlanPrefill({
      title: selectedPlan.title,
      description: selectedPlan.description,
      venue: selectedPlan.location,
      imageUrl: selectedPlan.image,
    });
    setEditingPlanId(null);
    setSelectedPlan(null);
    setShowCreateModal(true);
  }

  function handleEditPlan() {
    if (!selectedPlan) return;
    const planDate = selectedPlan.expiryDate ? (() => { const d = new Date(selectedPlan.expiryDate); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })() : "";
    setCreatePlanPrefill({
      title: selectedPlan.title,
      description: selectedPlan.description,
      venue: selectedPlan.location,
      date: planDate,
      time: selectedPlan.time || "",
      imageUrl: selectedPlan.image,
    });
    setEditingPlanId(selectedPlan.objectId);
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
        {/* Upcoming Plans (Hosted) */}
        {upcomingPlans.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
              Upcoming Plans ({upcomingPlans.length})
            </h2>
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
                      {new Date(plan.expiryDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="truncate">{plan.host?.name || "You"}</span>
                      <span className="shrink-0 ml-2">{plan.rsvpCount} RSVPs</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                    <h3 className="font-medium text-sm truncate">{idea.title}</h3>
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

      {/* Plan Detail Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl md:h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => setSelectedPlan(null)}
              className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/20 text-white md:text-zinc-900 md:bg-transparent"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="hidden md:block w-1/2 h-full bg-zinc-100">
              {selectedPlan.image ? (
                <img src={selectedPlan.image} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Calendar className="w-20 h-20 text-zinc-300" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-12">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-light tracking-tighter">
                  {selectedPlan.title}
                </h2>
                <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                  Hosted by {selectedPlan.host?.name || "You"}
                </p>
                <div className="flex gap-6 text-sm text-zinc-500 font-light border-y border-zinc-100 py-6">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {new Date(selectedPlan.expiryDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    {(() => {
                      if (selectedPlan.time) return ` at ${selectedPlan.time}`;
                      const d = new Date(selectedPlan.expiryDate);
                      if (d.getHours() || d.getMinutes()) return ` at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
                      return null;
                    })()}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> {selectedPlan.rsvpCount} attending
                  </span>
                </div>
              </div>

              {(selectedPlan.description || selectedPlan.location) && (
                <div className="space-y-6">
                  {selectedPlan.description && (
                    <p className="text-xl font-light leading-relaxed text-zinc-600">
                      {selectedPlan.description}
                    </p>
                  )}
                  {selectedPlan.location && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                        Location
                      </h4>
                      <p className="text-sm text-zinc-700">{selectedPlan.location.name}</p>
                      <p className="text-sm text-zinc-500">{selectedPlan.location.address}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-8 border-t border-zinc-100 flex items-center justify-between">
                <button
                  onClick={handleDuplicatePlan}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
                <button
                  onClick={handleEditPlan}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePlan(selectedPlan.objectId)}
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancel Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Plan Modal */}
      {showCreateModal && (
        <CreatePlanModal
          calendarId={calendarId}
          tier={tier}
          prefill={createPlanPrefill}
          editMode={!!editingPlanId}
          eventGroupId={editingPlanId || undefined}
          onClose={() => { setShowCreateModal(false); resetForm(); }}
          onCreated={() => fetchPlanIdeas()}
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
    </div>
  );
}
