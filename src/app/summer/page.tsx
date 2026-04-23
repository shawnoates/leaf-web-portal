"use client";

import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Users,
  Clock,
  ArrowUpRight,
  Share2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Heart,
  Check,
  ArrowRight,
} from "lucide-react";

// --- Helpers ---

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// --- Types ---

interface Plan {
  id: string;
  title: string;
  daysFromNow: number;
  time: string;
  description: string;
  image: string;
  hostName: string;
  attendeeCount: number;
  location: string;
}

interface PlanIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
}

// --- Fake Data ---

const BRAND_COLOR = "#2563eb";
const PROFILE_NAME = "Matt's Summer '26";
const PROFILE_PHOTO = "https://randomuser.me/api/portraits/men/32.jpg";
const FOLLOWER_COUNT = 47;
const SETUP_URL = "https://www.os.joinleaf.com/organizations/setup";

const PLANS: Plan[] = [
  {
    id: "1",
    title: "Rooftop Sunset Cocktails",
    daysFromNow: 7,
    time: "7:00 PM",
    description:
      "Grab a drink and watch the sun set over the Manhattan skyline from a Williamsburg rooftop. Craft cocktails, good music, and great company.",
    image:
      "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=80",
    hostName: "Matt",
    attendeeCount: 12,
    location: "Williamsburg, Brooklyn",
  },
  {
    id: "2",
    title: "Central Park Volleyball",
    daysFromNow: 14,
    time: "10:00 AM",
    description:
      "Saturday morning pickup volleyball on the Great Lawn. All skill levels welcome — we'll split into teams. Bring water and sunscreen!",
    image:
      "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80",
    hostName: "Maya",
    attendeeCount: 8,
    location: "Great Lawn, Central Park",
  },
  {
    id: "3",
    title: "Brooklyn Bridge Sunset Walk",
    daysFromNow: 25,
    time: "6:30 PM",
    description:
      "Walk across the Brooklyn Bridge at golden hour, then grab ice cream in DUMBO. Perfect for catching up with friends old and new.",
    image:
      "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80",
    hostName: "Matt",
    attendeeCount: 15,
    location: "Brooklyn Bridge",
  },
  {
    id: "4",
    title: "Comedy Night at the Cellar",
    daysFromNow: 38,
    time: "8:00 PM",
    description:
      "Live standup at one of NYC's most iconic comedy clubs. We've got a group reservation — expect surprise headliners and a lot of laughs.",
    image:
      "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&q=80",
    hostName: "Jake",
    attendeeCount: 6,
    location: "Comedy Cellar, Greenwich Village",
  },
  {
    id: "5",
    title: "Beach Day at Rockaway",
    daysFromNow: 52,
    time: "9:00 AM",
    description:
      "Full beach day at Rockaway Beach. Waves, boardwalk tacos, spikeball, and good vibes. We'll claim a spot early — look for the Leaf flag.",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    hostName: "Sarah",
    attendeeCount: 20,
    location: "Rockaway Beach, Queens",
  },
  {
    id: "6",
    title: "Outdoor Movie Night",
    daysFromNow: 66,
    time: "7:30 PM",
    description:
      "Bring a blanket and join us for a classic film under the stars at Brooklyn Bridge Park. Popcorn and snacks provided.",
    image:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80",
    hostName: "Matt",
    attendeeCount: 10,
    location: "Brooklyn Bridge Park",
  },
];

const PLAN_IDEAS: PlanIdea[] = [
  {
    id: "i1",
    title: "Kayaking on the Hudson",
    description:
      "Paddle along the Hudson River with skyline views. No experience needed — guided group session.",
    category: "Adventure",
    image:
      "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=800&q=80",
  },
  {
    id: "i2",
    title: "Smorgasburg Food Tour",
    description:
      "Sample the best street food vendors at Brooklyn's legendary outdoor food market.",
    category: "Food & Drink",
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
  },
  {
    id: "i3",
    title: "Jazz in the Park",
    description:
      "Catch a free live jazz set in one of NYC's parks. Bring a picnic blanket and enjoy the vibes.",
    category: "Music",
    image:
      "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80",
  },
  {
    id: "i4",
    title: "Pottery Workshop",
    description:
      "Hands-on pottery class in a cozy Brooklyn studio. Make a mug, bowl, or whatever inspires you.",
    category: "Creative",
    image:
      "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80",
  },
];

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

function CTAModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 md:p-10 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-6">
          <img
            src={PROFILE_PHOTO}
            alt={PROFILE_NAME}
            className="w-16 h-16 rounded-full object-cover mx-auto"
          />

          <div className="space-y-3">
            <h3 className="text-2xl md:text-3xl font-light tracking-tight">
              Plan Your Summer with Friends
            </h3>
            <p className="text-zinc-500 leading-relaxed text-sm md:text-base">
              Create your own free summer calendar. Share plans, invite friends,
              and make it happen.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={SETUP_URL}
              className="block w-full text-white py-3.5 text-xs uppercase tracking-[0.2em] font-bold transition-opacity hover:opacity-90 rounded-lg text-center"
              style={{ backgroundColor: BRAND_COLOR }}
            >
              Create Your Summer Calendar
            </a>
            <a
              href="https://www.os.joinleaf.com"
              className="block w-full border border-zinc-200 py-3 text-xs uppercase tracking-[0.2em] font-bold text-center hover:bg-zinc-50 transition-colors rounded-lg"
            >
              Learn More
            </a>
          </div>

          <p className="text-[11px] text-zinc-400">
            Free forever &middot; No credit card required
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function SummerCalendarPage() {
  const [showCTA, setShowCTA] = useState(false);
  const [showScrollPopup, setShowScrollPopup] = useState(false);
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll-triggered popup after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowScrollPopup(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  const handleShare = async (planId: string, title: string) => {
    const url = `${window.location.origin}/summer`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopiedPlanId(planId);
      setTimeout(() => setCopiedPlanId(null), 2000);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-zinc-100 px-6 py-6 md:py-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            <img
              src={PROFILE_PHOTO}
              alt={PROFILE_NAME}
              className="w-9 h-9 rounded-lg object-cover shrink-0"
            />
            <h1 className="text-sm md:text-2xl font-light tracking-[0.1em] md:tracking-[0.2em] uppercase line-clamp-2 md:truncate">
              {PROFILE_NAME}
            </h1>
            <div className="h-4 w-px bg-zinc-200 hidden md:block" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold hidden md:block">
              Calendar
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400 hidden sm:inline">
              {FOLLOWER_COUNT} followers
            </span>
            <button
              onClick={() => setShowCTA(true)}
              className="flex items-center gap-1.5 text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 px-3 py-1.5 rounded-full"
            >
              <Heart className="w-3.5 h-3.5" />
              Follow
            </button>
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
        <div className="space-y-32">
          {PLANS.map((plan, index) => {
            const date = futureDate(plan.daysFromNow);
            return (
              <article
                key={plan.id}
                className={`group flex flex-col md:flex-row gap-12 md:items-center ${
                  index % 2 !== 0 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div
                  className="w-full md:w-3/5 aspect-[16/10] overflow-hidden cursor-pointer bg-zinc-100 shadow-sm"
                  onClick={() => setShowCTA(true)}
                >
                  <img
                    src={plan.image}
                    alt={plan.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>

                <div className="w-full md:w-2/5 space-y-6">
                  <div className="space-y-2">
                    <p className="text-[11px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                      {formatDate(date)} &bull; {plan.time}
                    </p>
                    <h3 className="text-3xl font-light tracking-tight group-hover:italic transition-all">
                      {plan.title}
                    </h3>
                    <div className="pt-2">
                      <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-900 font-bold flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: BRAND_COLOR }}
                        />
                        Hosted by {plan.hostName}
                      </p>
                    </div>
                  </div>

                  <p className="text-zinc-500 leading-relaxed font-light text-lg line-clamp-3">
                    {plan.description}
                  </p>

                  <div className="pt-2 flex flex-col gap-6">
                    <AvatarStack count={plan.attendeeCount} />
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button
                        onClick={() => setShowCTA(true)}
                        className="text-white px-6 py-3 text-xs uppercase tracking-widest font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                        style={{ backgroundColor: BRAND_COLOR }}
                      >
                        View Details <ArrowUpRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShare(plan.id, plan.title)}
                        className="border border-zinc-200 px-5 py-3 hover:bg-zinc-50 transition-colors relative flex items-center justify-center gap-2"
                      >
                        {copiedPlanId === plan.id ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Share2 className="w-5 h-5" />
                        )}
                        <span className="text-xs font-bold uppercase tracking-widest">
                          Share
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Plan Ideas Carousel */}
        <section className="mt-48 mb-24 space-y-12">
          <div className="flex justify-between items-end border-b border-zinc-100 pb-8">
            <div className="space-y-2">
              <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> Get Involved
              </p>
              <h2 className="text-4xl font-light tracking-tight italic">
                Host Something for the Community
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

          <div
            ref={scrollRef}
            className="flex gap-8 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-8"
          >
            {PLAN_IDEAS.map((idea) => (
              <div
                key={idea.id}
                className="min-w-[280px] max-w-[300px] snap-start group cursor-pointer"
                onClick={() => setShowCTA(true)}
              >
                <div className="aspect-[4/5] overflow-hidden bg-zinc-100 mb-4 relative">
                  <img
                    src={idea.image}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    alt={idea.title}
                  />
                  <div className="absolute inset-0 transition-all duration-300 flex items-center justify-center bg-black/0 group-hover:bg-black/20 opacity-0 group-hover:opacity-100">
                    <span className="bg-white px-6 py-3 text-[10px] tracking-[0.3em] uppercase font-bold shadow-xl">
                      Host This
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-base font-medium tracking-tight group-hover:italic">
                    {idea.title}
                  </h4>
                  <p className="text-sm text-zinc-500 font-light line-clamp-2 leading-relaxed">
                    {idea.description}
                  </p>
                </div>
              </div>
            ))}

            {/* Suggest a Plan card */}
            <div
              className="min-w-[280px] max-w-[300px] snap-start group cursor-pointer"
              onClick={() => setShowCTA(true)}
            >
              <div className="aspect-[4/5] overflow-hidden mb-4 relative rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white transition-all group-hover:shadow-lg group-hover:border-emerald-300">
                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Plus className="w-7 h-7" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] tracking-[0.3em] uppercase font-bold text-emerald-700">
                      Your Idea
                    </p>
                    <h4 className="text-lg font-medium tracking-tight text-zinc-900">
                      Suggest a Plan
                    </h4>
                    <p className="text-xs text-zinc-500 leading-relaxed font-light">
                      Have something in mind? Share your idea and we&apos;ll
                      review it.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-medium tracking-tight group-hover:italic">
                  Custom Plan
                </h4>
                <p className="text-sm text-zinc-500 font-light line-clamp-2 leading-relaxed">
                  Pitch a date, venue, and details — pending organizer approval.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <div className="text-center py-16 border-t border-zinc-100">
          <button
            onClick={() => setShowCTA(true)}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Create a free summer calendar
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* CTA Modal */}
      {showCTA && <CTAModal onClose={() => setShowCTA(false)} />}

      {/* Scroll-triggered CTA Popup */}
      {showScrollPopup && !showCTA && (
        <div
          className="fixed bottom-6 right-6 left-6 md:left-auto md:w-80 z-40"
          style={{ animation: "slideUp 0.3s ease-out" }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 p-4">
            <button
              onClick={() => setShowScrollPopup(false)}
              className="absolute top-3 right-3 p-1 text-zinc-300 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-3 pr-6">
              <img
                src={PROFILE_PHOTO}
                alt={PROFILE_NAME}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">
                  Summer plans, sorted
                </p>
                <p className="text-xs text-zinc-500">
                  Create your own free calendar
                </p>
              </div>
            </div>
            <a
              href={SETUP_URL}
              className="block w-full py-2.5 text-xs font-bold uppercase tracking-widest text-white rounded-lg transition-opacity hover:opacity-90 text-center"
              style={{ backgroundColor: BRAND_COLOR }}
            >
              Get Started — Free
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
