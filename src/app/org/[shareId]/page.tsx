"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import Link from "next/link";
import {
  Plus,
  Users,
  Clock,
  CheckCircle2,
  ArrowRight,
  Share2,
  Calendar,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Sparkles,
  Loader2,
  Lock,
  MapPin,
  Settings,
} from "lucide-react";

// --- Types ---

interface Plan {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
  image: string;
  hostName: string;
  hostAvatar: string | null;
  attendeeCount: number;
  location: {
    name: string;
    address: string;
  } | null;
}

interface PlanIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  date: string | null;
  icebreakerQuestion: string | null;
  suggestedCapacity: number | null;
  centroid: string | null;
}

interface NearbyVenue {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  photoUrl: string | null;
}

interface OrgData {
  objectId: string;
  name: string;
  description: string;
  profilePhoto: string | null;
  brandColor: string | null;
  orgType: string | null;
  orgCity: string | null;
  memberCount: number;
  rsvpLimitReached: boolean;
  isOwner: boolean;
  plans: Plan[];
  planIdeas: PlanIdea[];
}

// --- Helpers ---

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// --- Components ---

function AvatarStack({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3 overflow-hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white">
          <Users className="w-3.5 h-3.5 text-zinc-500" />
        </div>
      </div>
      <span className="text-[10px] tracking-widest uppercase font-bold text-zinc-400">
        {count} Attending
      </span>
    </div>
  );
}

function RsvpModal({
  plan,
  onClose,
}: {
  plan: Plan;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"form" | "submitting" | "success" | "error">("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6)
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep("submitting");
    try {
      await Parse.Cloud.run("rsvpToPlanViaWeb", {
        phoneNumber: phone.replace(/\D/g, ""),
        name,
        eventGroupId: plan.id,
      });
      setStep("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to RSVP. Please try again.");
      setStep("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-none p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>

        {step === "form" || step === "submitting" ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-light tracking-tight">
                RSVP for {plan.title}
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                {plan.date} at {plan.time}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full border-b border-zinc-300 py-3 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                  Phone Number
                </label>
                <div className="flex items-center border-b border-zinc-300 focus-within:border-zinc-900 transition-colors">
                  <Phone className="w-4 h-4 text-zinc-400 mr-2" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="555-555-5555"
                    className="w-full py-3 text-lg font-light focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={step === "submitting"}
                className="w-full bg-zinc-900 text-white py-3.5 text-xs uppercase tracking-[0.2em] font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {step === "submitting" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Confirm RSVP <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        ) : step === "error" ? (
          <div className="py-8 text-center space-y-6">
            <p className="text-red-600 text-sm">{errorMsg}</p>
            <button
              onClick={() => setStep("form")}
              className="text-sm text-zinc-500 hover:text-zinc-900 underline"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="py-8 text-center space-y-6">
            <div className="w-16 h-16 border border-zinc-900 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-2xl font-light mb-2">You&apos;re in!</h4>
              <p className="text-sm text-zinc-500">
                We&apos;ll send a confirmation to your phone.
              </p>
            </div>
            <div className="pt-4 space-y-3">
              <a
                href="https://apps.apple.com/app/leaf"
                className="block w-full border border-zinc-200 py-3 text-xs uppercase tracking-[0.2em] font-bold text-center hover:bg-zinc-50 transition-colors"
              >
                Open in Leaf App
              </a>
              <button
                onClick={onClose}
                className="text-sm text-zinc-400 hover:text-zinc-900"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function OrgCalendarPage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Plan | null>(null);
  const [rsvpPlan, setRsvpPlan] = useState<Plan | null>(null);
  const [hostingIdea, setHostingIdea] = useState<PlanIdea | null>(null);
  const [hostSuccess, setHostSuccess] = useState(false);
  const [hostSubmitting, setHostSubmitting] = useState(false);
  const [hostNote, setHostNote] = useState("");
  const [nearbyVenues, setNearbyVenues] = useState<NearbyVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<NearbyVenue | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchOrg = useCallback(async () => {
    try {
      setLoading(true);
      const result = await Parse.Cloud.run("getOrgCalendarPage", { shareId });

      // Transform API response to our OrgData shape
      const plans: Plan[] = (result.plans || []).map((p: Record<string, unknown>) => ({
        id: p.objectId as string,
        title: p.title as string || "Untitled Plan",
        date: p.expiryDate ? formatDate(p.expiryDate as string) : "",
        time: p.expiryDate ? formatTime(p.expiryDate as string) : "",
        description: p.description as string || "",
        image: p.image as string || "",
        hostName: (p.host as Record<string, string>)?.name || "Community Member",
        hostAvatar: (p.host as Record<string, string>)?.profilePictureUrl || null,
        attendeeCount: (p.rsvpCount as number) || 0,
        location: p.location ? {
          name: (p.location as Record<string, string>).name || "",
          address: (p.location as Record<string, string>).address || "",
        } : null,
      }));

      const planIdeas: PlanIdea[] = (result.planIdeas || []).map((idea: Record<string, unknown>) => ({
        id: idea.objectId as string,
        title: idea.title as string || "Plan Idea",
        description: idea.description as string || "",
        category: idea.category as string || "Activity",
        image: idea.image as string || "",
        date: idea.date as string || null,
        icebreakerQuestion: idea.icebreakerQuestion as string || null,
        suggestedCapacity: idea.suggestedCapacity as number || null,
        centroid: idea.centroid as string || null,
      }));

      setOrg({
        objectId: result.objectId,
        name: result.name || "Organization",
        description: result.description || "",
        profilePhoto: result.profilePhoto || null,
        brandColor: result.orgBrandColor || "#18181b",
        orgType: result.orgType || null,
        orgCity: result.orgCity || null,
        memberCount: result.memberCount || 0,
        rsvpLimitReached: result.rsvpLimitReached || false,
        isOwner: result.isOwner || false,
        plans,
        planIdeas,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    if (shareId) fetchOrg();
  }, [shareId, fetchOrg]);

  // Fetch nearby venues when host modal opens
  useEffect(() => {
    if (!hostingIdea || !org) return;
    setNearbyVenues([]);
    setSelectedVenue(null);
    setVenuesLoading(true);

    const searchCity = hostingIdea.centroid || org.orgCity || "";
    const query = `${hostingIdea.category} in ${searchCity}`;

    // Load Google Maps if not already loaded, then search
    const doSearch = async () => {
      try {
        // Wait for Google Maps to be available
        if (!window.google?.maps?.places) {
          const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (!key) { setVenuesLoading(false); return; }
          // Check if already loading
          if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
            await new Promise<void>((resolve) => {
              (window as unknown as Record<string, unknown>).__venueSearchCallback = () => resolve();
              const script = document.createElement("script");
              script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__venueSearchCallback`;
              script.async = true;
              document.head.appendChild(script);
            });
          } else {
            // Script exists, wait for it
            await new Promise<void>((resolve) => {
              const check = setInterval(() => {
                if (window.google?.maps?.places) { clearInterval(check); resolve(); }
              }, 100);
            });
          }
        }

        const service = new window.google.maps.places.PlacesService(
          document.createElement("div")
        );

        service.textSearch(
          { query, type: "establishment" },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              const venues: NearbyVenue[] = results.slice(0, 5).map((place) => ({
                placeId: place.place_id || "",
                name: place.name || "",
                address: place.formatted_address || "",
                rating: place.rating || null,
                photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
              }));
              setNearbyVenues(venues);
            }
            setVenuesLoading(false);
          }
        );
      } catch {
        setVenuesLoading(false);
      }
    };

    doSearch();
  }, [hostingIdea, org]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth / 2
          : scrollLeft + clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  const handleHostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostingIdea) return;
    setHostSubmitting(true);

    const form = e.target as HTMLFormElement;
    const dateInput = form.querySelector('input[type="date"]') as HTMLInputElement;

    try {
      await Parse.Cloud.run("hostPlanIdea", {
        calendarPlanId: hostingIdea.id,
        date: dateInput.value,
        capacity: hostingIdea.suggestedCapacity || 20,
        hostNote: hostNote.trim() || undefined,
        venue: selectedVenue ? {
          placeId: selectedVenue.placeId,
          name: selectedVenue.name,
          address: selectedVenue.address,
          photoUrl: selectedVenue.photoUrl,
          rating: selectedVenue.rating,
        } : undefined,
      });
      setHostSuccess(true);
      setHostNote("");
      setSelectedVenue(null);
      // Refresh data to show the new plan
      fetchOrg();
      setTimeout(() => {
        setHostingIdea(null);
        setHostSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to host plan idea:", err);
      setHostSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-zinc-400" />
          <p className="text-sm text-zinc-400 uppercase tracking-widest">Loading calendar...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-light">Calendar not found</h2>
          <p className="text-zinc-500 text-sm">{error || "This calendar doesn't exist or is no longer available."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-zinc-100 px-6 py-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            {org.profilePhoto && (
              <img
                src={org.profilePhoto}
                alt={org.name}
                className="w-9 h-9 rounded-full object-cover"
              />
            )}
            <h1 className="text-2xl font-light tracking-[0.2em] uppercase">
              {org.name}
            </h1>
            <div className="h-4 w-px bg-zinc-200 hidden md:block" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold hidden md:block">
              Calendar
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
              {org.memberCount} followers
            </span>
            {org.isOwner && (
              <Link
                href={`/dashboard/${org.objectId}`}
                className="flex items-center gap-1.5 text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 px-3 py-1.5 rounded-full"
              >
                <Settings className="w-3.5 h-3.5" />
                Manage
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Stream Header */}
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-6 flex justify-between items-end border-b border-zinc-100">
        <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold">
          Upcoming Plans
        </p>
      </div>

      {/* Plans Stream */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {org.plans.length === 0 ? (
          <div className={`${org.planIdeas.length > 0 ? "py-12" : "py-24"} text-center space-y-4`}>
            <Calendar className="w-12 h-12 text-zinc-300 mx-auto" />
            <h3 className="text-xl font-light">No upcoming plans yet</h3>
            <p className="text-zinc-400 text-sm">
              {org.planIdeas.length > 0
                ? "Browse curated plan ideas below and host one for your community."
                : `Check back soon for new events from ${org.name}.`}
            </p>
          </div>
        ) : (
          <div className="space-y-32">
            {org.plans.map((plan, index) => (
              <article
                key={plan.id}
                className={`group flex flex-col md:flex-row gap-12 md:items-center ${
                  index % 2 !== 0 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div
                  className="w-full md:w-3/5 aspect-[16/10] overflow-hidden cursor-pointer bg-zinc-100 shadow-sm"
                  onClick={() => setSelectedEvent(plan)}
                >
                  {plan.image ? (
                    <img
                      src={plan.image}
                      alt={plan.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="w-16 h-16 text-zinc-300" />
                    </div>
                  )}
                </div>

                <div className="w-full md:w-2/5 space-y-6">
                  <div className="space-y-2">
                    <p className="text-[11px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                      {plan.date} &bull; {plan.time}
                    </p>
                    <h3 className="text-3xl font-light tracking-tight group-hover:italic transition-all">
                      {plan.title}
                    </h3>
                    <div className="pt-2">
                      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-900 font-bold flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-900" />
                        Hosted by {plan.hostName}
                      </p>
                    </div>
                    {plan.location && (
                      <p className="text-xs text-zinc-400">
                        {plan.location.name}
                      </p>
                    )}
                  </div>

                  <p className="text-zinc-500 leading-relaxed font-light text-lg line-clamp-3">
                    {plan.description}
                  </p>

                  <div className="pt-2 flex flex-col gap-6">
                    <AvatarStack count={plan.attendeeCount} />
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        onClick={() => setSelectedEvent(plan)}
                        className="bg-zinc-900 text-white px-6 py-3 text-xs uppercase tracking-widest font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                      >
                        View Details <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <button className="border border-zinc-200 px-5 py-3 hover:bg-zinc-50 transition-colors">
                        <Share2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Plan Ideas Carousel */}
        {org.planIdeas.length > 0 && (
          <section className={`${org.plans.length > 0 ? "mt-48" : "mt-8"} mb-24 space-y-12`}>
            <div className="flex justify-between items-end border-b border-zinc-100 pb-8">
              <div className="space-y-2">
                <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" /> Start Something New
                </p>
                <h2 className="text-4xl font-light tracking-tight italic">
                  Curated Plan Ideas
                </h2>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => scroll("left")}
                  className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-all active:scale-90"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => scroll("right")}
                  className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-all active:scale-90"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {org.rsvpLimitReached && (
              <div className="flex items-center gap-3 bg-zinc-100 border border-zinc-200 px-6 py-4">
                <Lock className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <p className="text-sm text-zinc-500">
                  This calendar has reached its RSVP limit. New RSVPs and hosting are temporarily paused. Please contact the organization administrator.
                </p>
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex gap-8 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-8"
            >
              {org.planIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className={`min-w-[280px] max-w-[300px] snap-start group ${org.rsvpLimitReached ? "cursor-default" : "cursor-pointer"}`}
                  onClick={() => {
                    if (org.rsvpLimitReached) return;
                    setHostingIdea(idea);
                    setHostSubmitting(false);
                    setHostNote("");
                    setSelectedVenue(null);
                  }}
                >
                  <div className="aspect-[4/5] overflow-hidden bg-zinc-100 mb-4 relative">
                    {idea.image ? (
                      <img
                        src={idea.image}
                        className={`w-full h-full object-cover transition-transform duration-700 ${org.rsvpLimitReached ? "grayscale opacity-60" : "group-hover:scale-110"}`}
                        alt={idea.title}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className={`w-12 h-12 ${org.rsvpLimitReached ? "text-zinc-200" : "text-zinc-300"}`} />
                      </div>
                    )}
                    <div className={`absolute inset-0 transition-all duration-300 flex items-center justify-center ${
                      org.rsvpLimitReached
                        ? "bg-black/10 opacity-100"
                        : "bg-black/0 group-hover:bg-black/20 opacity-0 group-hover:opacity-100"
                    }`}>
                      {org.rsvpLimitReached ? (
                        <span className="bg-white/90 px-6 py-3 text-[10px] tracking-[0.3em] uppercase font-bold shadow-xl flex items-center gap-2 text-zinc-400">
                          <Lock className="w-3.5 h-3.5" /> Host This
                        </span>
                      ) : (
                        <span className="bg-white px-6 py-3 text-[10px] tracking-[0.3em] uppercase font-bold shadow-xl">
                          Host This
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className={`text-base font-medium tracking-tight ${org.rsvpLimitReached ? "text-zinc-400" : "group-hover:italic"}`}>
                      {idea.title}
                    </h4>
                    <p className="text-sm text-zinc-500 font-light line-clamp-2 leading-relaxed">
                      {idea.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Plan Detail Overlay */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl md:h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/20 text-white md:text-zinc-900 md:bg-transparent"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="hidden md:block w-1/2 h-full bg-zinc-100">
              {selectedEvent.image ? (
                <img
                  src={selectedEvent.image}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Calendar className="w-20 h-20 text-zinc-300" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-12">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-light tracking-tighter">
                  {selectedEvent.title}
                </h2>
                <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                  Hosted by {selectedEvent.hostName}
                </p>
                <div className="flex gap-6 text-sm text-zinc-500 font-light border-y border-zinc-100 py-6">
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {selectedEvent.date} at {selectedEvent.time}
                  </span>
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> {selectedEvent.attendeeCount} attending
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-xl font-light leading-relaxed text-zinc-600">
                  {selectedEvent.description}
                </p>
                {selectedEvent.location && (
                  <div className="space-y-2">
                    <h4 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                      Location
                    </h4>
                    <p className="text-sm text-zinc-700">{selectedEvent.location.name}</p>
                    <p className="text-sm text-zinc-500">{selectedEvent.location.address}</p>
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-zinc-100 flex flex-col gap-4">
                {org.rsvpLimitReached ? (
                  <div className="space-y-3">
                    <button
                      disabled
                      className="w-full bg-zinc-300 text-zinc-500 py-3 text-xs uppercase tracking-[0.2em] font-bold cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" /> RSVPs Paused
                    </button>
                    <p className="text-xs text-zinc-400 text-center">
                      This calendar has reached its RSVP limit. Please contact the organization administrator.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setRsvpPlan(selectedEvent);
                        setSelectedEvent(null);
                      }}
                      className="flex-1 bg-zinc-900 text-white py-3 text-xs uppercase tracking-[0.2em] font-bold hover:bg-zinc-800 transition-colors"
                    >
                      I&apos;m Attending
                    </button>
                    <button className="border border-zinc-200 px-5 hover:bg-zinc-50 transition-colors">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RSVP Modal */}
      {rsvpPlan && (
        <RsvpModal plan={rsvpPlan} onClose={() => setRsvpPlan(null)} />
      )}

      {/* Host Plan Idea Overlay */}
      {hostingIdea && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl md:h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => {
                setHostingIdea(null);
                setHostSuccess(false);
              }}
              className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/20 text-white md:text-zinc-900 md:bg-transparent"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="hidden md:block w-1/2 h-full bg-zinc-100">
              {hostingIdea.image ? (
                <img
                  src={hostingIdea.image}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Sparkles className="w-20 h-20 text-zinc-300" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-8">
              {hostSuccess ? (
                <div className="py-20 text-center space-y-6">
                  <div className="w-20 h-20 border border-zinc-900 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-light">
                    Your plan is scheduled.
                  </h4>
                  <p className="text-zinc-400 uppercase tracking-widest text-[10px]">
                    Closing...
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[10px] tracking-[0.4em] uppercase font-bold text-zinc-400 mb-3">
                      {hostingIdea.category}
                    </p>
                    <h3 className="text-3xl font-light mb-2 italic">
                      Host this event
                    </h3>
                    <p className="text-zinc-500 font-light">
                      Bring &ldquo;{hostingIdea.title}&rdquo; to your community.
                    </p>
                  </div>

                  {/* Venue Carousel */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                      Choose a Venue
                    </h4>
                    {venuesLoading ? (
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div key={i} className="min-w-[160px] h-[180px] bg-zinc-100 rounded-xl animate-pulse shrink-0" />
                        ))}
                      </div>
                    ) : nearbyVenues.length > 0 ? (
                      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                        {nearbyVenues.map((venue) => (
                          <button
                            key={venue.placeId}
                            type="button"
                            onClick={() => setSelectedVenue(selectedVenue?.placeId === venue.placeId ? null : venue)}
                            className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left ${
                              selectedVenue?.placeId === venue.placeId
                                ? "border-zinc-900 shadow-lg"
                                : "border-zinc-200 hover:border-zinc-300"
                            }`}
                          >
                            <div className="h-[100px] bg-zinc-100">
                              {venue.photoUrl ? (
                                <img src={venue.photoUrl} className="w-full h-full object-cover" alt={venue.name} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <MapPin className="w-6 h-6 text-zinc-300" />
                                </div>
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-bold truncate">{venue.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {venue.rating && (
                                  <span className="text-[10px] text-zinc-500">{venue.rating.toFixed(1)} &#9733;</span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400 truncate mt-0.5">{venue.address}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-400 italic">No venues found nearby.</p>
                    )}
                    {selectedVenue && (
                      <p className="text-xs text-zinc-600 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {selectedVenue.name} &mdash; {selectedVenue.address}
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleHostSubmit} className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                        Preferred Date
                      </label>
                      <input
                        type="date"
                        required
                        defaultValue={hostingIdea.date ? new Date(hostingIdea.date).toISOString().split("T")[0] : ""}
                        className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                        Host&apos;s Note
                      </label>
                      <textarea
                        value={hostNote}
                        onChange={(e) => setHostNote(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="w-full border border-zinc-200 rounded-lg p-4 text-sm font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                        placeholder="Add a personal note for attendees (optional)"
                      />
                      <p className="text-[10px] text-zinc-400 text-right">{hostNote.length}/500</p>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] tracking-[0.3em] uppercase font-bold">
                        Visibility
                      </label>
                      <div className="p-6 border border-zinc-900 bg-zinc-50">
                        <span className="block font-bold text-xs uppercase tracking-widest mb-1">
                          Public Stream
                        </span>
                        <span className="text-sm font-light text-zinc-500">
                          Visible to all community members.
                        </span>
                      </div>
                    </div>
                    <div className="pt-8 flex gap-4">
                      <button
                        type="button"
                        onClick={() => setHostingIdea(null)}
                        className="flex-1 text-xs uppercase tracking-widest font-medium text-zinc-500 hover:text-zinc-900 py-3"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={hostSubmitting}
                        className="flex-1 bg-zinc-900 text-white py-3.5 text-xs uppercase tracking-[0.2em] font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {hostSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Confirm Launch"
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-4">
            <span className="text-xl font-light tracking-[0.3em] uppercase">
              {org.name}
            </span>
            <p className="text-zinc-400 text-sm font-light max-w-xs leading-relaxed">
              {org.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-4">
              <h5 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-900">
                Platform
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <a href="#">About</a>
                <a href="#">Safety</a>
                <a href="#">Privacy</a>
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-900">
                Connect
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <a href="#">Instagram</a>
                <a href="#">Contact</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
