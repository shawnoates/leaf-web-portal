"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import VenueSearch from "@/components/VenueSearch";
import { ArrowLeft, Calendar, Check, MapPin, Plus, Sparkles, Trash2 } from "lucide-react";

interface Venue {
  name: string;
  address: string;
  placeId: string;
}

interface PlanIdea {
  objectId: string;
  title: string;
  description: string;
  date: string;
  location: { name: string; address: string } | null;
}

export default function PlansPage() {
  const params = useParams();
  const router = useRouter();
  const calendarId = params.calendarId as string;

  const [user, setUser] = useState<Parse.User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [tier, setTier] = useState("starter");

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venueQuery, setVenueQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [capacity, setCapacity] = useState("");
  const [isHosted, setIsHosted] = useState(true);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);

  // Plan ideas
  const [planIdeas, setPlanIdeas] = useState<PlanIdea[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);

  useEffect(() => {
    try {
      const current = Parse.User.current();
      if (current) setUser(current);
    } catch {
      // No session
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchOrgInfo();
    fetchPlanIdeas();
  }, [user, calendarId]);

  async function fetchOrgInfo() {
    try {
      const result = await Parse.Cloud.run("getOrgDashboard", { calendarId });
      setOrgName(result.name);
      setTier(result.tier);
    } catch {
      // Failed to load
    }
  }

  async function fetchPlanIdeas() {
    setLoadingIdeas(true);
    try {
      // Use getOrgCalendarPage to get plan ideas for this calendar
      // First get the shareId
      const dash = await Parse.Cloud.run("getOrgDashboard", { calendarId });
      const page = await Parse.Cloud.run("getOrgCalendarPage", { shareId: dash.shareId });
      setPlanIdeas(
        (page.planIdeas || []).map((idea: { objectId: string; title: string; description: string; date: string; location: { name: string; address: string } | null }) => ({
          objectId: idea.objectId,
          title: idea.title,
          description: idea.description,
          date: idea.date,
          location: idea.location,
        }))
      );
    } catch {
      // Failed
    } finally {
      setLoadingIdeas(false);
    }
  }

  async function handleCreate() {
    if (!title || !date) return;
    setCreating(true);
    try {
      await Parse.Cloud.run("createManualPlan", {
        calendarId,
        title,
        description,
        venue: selectedVenue ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId } : null,
        date: `${date}T${time || "12:00"}:00`,
        time: time || null,
        capacity: capacity ? parseInt(capacity) : null,
        isHosted,
      });
      setSuccess(true);
      setTitle("");
      setDescription("");
      setVenueQuery("");
      setSelectedVenue(null);
      setDate("");
      setTime("");
      setCapacity("");
      fetchPlanIdeas();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create plan";
      alert(message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRemoveIdea(ideaId: string) {
    if (!confirm("Remove this plan idea?")) return;
    try {
      // Direct Parse update to set ideaStatus to "removed"
      const CalendarGeneratedPlan = Parse.Object.extend("CalendarGeneratedPlan");
      const idea = new CalendarGeneratedPlan();
      idea.id = ideaId;
      idea.set("ideaStatus", "removed");
      await idea.save(null);
      setPlanIdeas((prev) => prev.filter((p) => p.objectId !== ideaId));
    } catch (err) {
      console.error("Failed to remove idea:", err);
    }
  }

  // Date constraints
  const today = new Date().toISOString().split("T")[0];
  const maxDate =
    tier === "starter"
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : undefined;

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
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-4">
          <Link href={`/dashboard/${calendarId}`} className="p-2 hover:bg-zinc-50 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-medium tracking-tight">Create & Manage Plans</h1>
            <p className="text-xs text-zinc-400">{orgName}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {/* Create Plan Form */}
        <section className="border border-zinc-200 rounded-xl p-6 md:p-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-6">Create New Plan</h2>

          {success && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg mb-6 text-sm">
              <Check className="w-4 h-4" /> Plan created successfully!
            </div>
          )}

          <div className="space-y-5">
            {/* Plan type toggle */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">Plan Type</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsHosted(true)}
                  className={`flex-1 border rounded-lg p-4 text-left transition-all ${
                    isHosted ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">Upcoming Plan</span>
                  </div>
                  <p className="text-xs text-zinc-500">You host it, members RSVP</p>
                </button>
                <button
                  onClick={() => setIsHosted(false)}
                  className={`flex-1 border rounded-lg p-4 text-left transition-all ${
                    !isHosted ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm font-medium">Plan Idea</span>
                  </div>
                  <p className="text-xs text-zinc-500">Members can host this idea</p>
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
                placeholder="Plan title"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                placeholder="What's this plan about?"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Venue</label>
              <VenueSearch
                value={venueQuery}
                onChange={setVenueQuery}
                onSelect={(v) => { setSelectedVenue(v); setVenueQuery(v.name); }}
                className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
              />
              {selectedVenue && (
                <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {selectedVenue.address}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={today}
                  max={maxDate}
                  className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                />
                {tier === "starter" && (
                  <p className="text-[10px] text-amber-600 mt-1">Starter: 2 weeks ahead max</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Capacity (optional)</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 max-w-[120px]"
                placeholder="—"
                min="1"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={!title || !date || creating}
              className="w-full bg-zinc-900 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : isHosted ? "Create Upcoming Plan" : "Create Plan Idea"}
            </button>
          </div>
        </section>

        {/* Existing Plan Ideas */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 mb-4">
            Active Plan Ideas ({planIdeas.length})
          </h2>

          {loadingIdeas ? (
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
                  className="border border-zinc-200 rounded-xl p-4 flex items-start justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{idea.title}</h3>
                    {idea.description && (
                      <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">{idea.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                      {idea.date && (
                        <span>{new Date(idea.date).toLocaleDateString()}</span>
                      )}
                      {idea.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {idea.location.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveIdea(idea.objectId)}
                    className="p-2 text-zinc-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
