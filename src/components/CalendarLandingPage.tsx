"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import {
  Plus,
  Users,
  ArrowUpRight,
  Share2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Heart,
  Check,
  ArrowRight,
  Tag,
  Lock,
  Flag,
} from "lucide-react";

const SETUP_URL = "https://www.os.joinleaf.com/organizations/setup";

// --- Types ---

export interface Plan {
  id: string;
  title: string;
  daysFromNow: number;
  time: string;
  description: string;
  image: string;
  hostName: string;
  attendeeCount: number;
  location: string;
  /**
   * When set, the plan card shows a "Sponsored by {sponsoredBy}" badge
   * instead of (or alongside) the "Hosted by" line. Drives the
   * Sponsor-an-event callout on the merchant preview surface.
   */
  sponsoredBy?: string;
}

export interface PlanIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
}

export interface SampleDeal {
  id: string;
  businessName: string;
  title: string;
  description?: string;
  address?: string;
  promoCode?: string;
  imageUrl?: string;
  dealType: "public" | "exclusive";
  redeemWindowMinutes?: number;
  /**
   * Seed for the cosmetic interest count on the card. Optional — when
   * omitted the heart shows the "Interested" prompt instead.
   */
  interestCount?: number;
}

export interface LandingConfig {
  profileName: string;
  profilePhoto: string;
  brandColor: string;
  followerCount: number;
  pastPlanCount?: number;
  navLabel?: string;
  plansHeader?: string;
  ideasHeader?: string;
  ideasTitle?: string;
  ideasButtonLabel?: string;
  dealsHeader?: string;
  deals?: SampleDeal[];
  ctaTitle: string;
  ctaSubtitle: string;
  /**
   * Small print under the CTA buttons. Defaults to
   * "Free forever · No credit card required" for backwards-compat with
   * non-apartment landing pages. Apartment / org pages that don't actually
   * grant comped Pro to self-serve signups should override this with an
   * honest promise (e.g. "Free to get started · No credit card required").
   */
  ctaFootnote?: string;
  ctaButtonLabel: string;
  scrollPopupTitle: string;
  scrollPopupSubtitle: string;
  scrollPopupButton: string;
  bottomCtaText: string;
  plans: Plan[];
  planIdeas: PlanIdea[];
}

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

// --- Components ---

function SampleDealCard({
  deal,
  brandColor,
  onClick,
}: {
  deal: SampleDeal;
  brandColor: string;
  onClick?: () => void;
}) {
  // Mirrors the CompactDealCard used on real org pages (see
  // src/components/DealsStrip.tsx): same width/aspect/typography plus
  // an Interested heart + Report row in the footer. The footer
  // interactions are cosmetic on /apartment (it's a mock) — the heart
  // toggles local state without a Cloud call, and Report has no modal.
  const isExclusive = deal.dealType === "exclusive";
  const [interested, setInterested] = useState(false);
  const [interestCount, setInterestCount] = useState(deal.interestCount ?? 0);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="min-w-[160px] max-w-[180px] snap-start bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col text-left hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900"
    >
      <div className="relative">
        {deal.imageUrl ? (
          <div className="aspect-[16/10] bg-zinc-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={deal.imageUrl}
              alt={deal.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="aspect-[16/10] flex items-center justify-center"
            style={{ backgroundColor: `${brandColor}15` }}
          >
            <Tag className="w-5 h-5" style={{ color: brandColor }} />
          </div>
        )}
        {isExclusive && (
          <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-zinc-900/90 text-white backdrop-blur-sm">
            <Lock className="w-2 h-2" />
            Excl
          </span>
        )}
      </div>
      <div className="p-2.5 flex-1 flex flex-col gap-1">
        <p className="text-[9px] tracking-wider uppercase font-bold text-zinc-500 line-clamp-1">
          {deal.businessName}
        </p>
        <h3 className="text-xs font-medium tracking-tight leading-snug line-clamp-2">
          {deal.title}
        </h3>
        {deal.address && (
          <p className="text-[10px] text-zinc-400 mt-auto pt-0.5 line-clamp-1">
            {deal.address}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (interested) return;
              setInterested(true);
              setInterestCount((n) => n + 1);
            }}
            disabled={interested}
            className={`inline-flex items-center gap-1 text-[10px] font-medium transition-colors ${
              interested
                ? "text-red-600 cursor-default"
                : "text-zinc-500 hover:text-red-600"
            }`}
            aria-label={interested ? "You're interested" : "Mark as interested"}
          >
            <Heart
              className="w-3 h-3"
              fill={interested ? "currentColor" : "none"}
            />
            <span>
              {interestCount > 0 ? interestCount : ""}
              {interestCount === 0 && !interested && "Interested"}
              {interested && interestCount === 1 && " You"}
            </span>
          </button>
          <button
            onClick={(e) => e.stopPropagation()}
            className="text-[9px] text-zinc-300 hover:text-zinc-600 inline-flex items-center gap-0.5"
          >
            <Flag className="w-2 h-2" />
            Report
          </button>
        </div>
      </div>
    </div>
  );
}

function AvatarStack({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3 overflow-hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white">
          <Users className="w-3.5 h-3.5 text-zinc-500" />
        </div>
      </div>
      <span className="text-xs tracking-widest uppercase font-bold text-zinc-400">
        {count} Attending
      </span>
    </div>
  );
}

function CTAModal({
  config,
  onClose,
}: {
  config: LandingConfig;
  onClose: () => void;
}) {
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
            src={config.profilePhoto}
            alt={config.profileName}
            className="w-16 h-16 rounded-full object-cover mx-auto"
          />

          <div className="space-y-3">
            <h3 className="text-2xl md:text-3xl font-light tracking-tight">
              {config.ctaTitle}
            </h3>
            <p className="text-zinc-500 leading-relaxed text-sm md:text-base">
              {config.ctaSubtitle}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={SETUP_URL}
              className="block w-full text-white py-3.5 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 rounded-lg text-center"
              style={{ backgroundColor: config.brandColor }}
            >
              {config.ctaButtonLabel}
            </a>
            <a
              href="https://www.os.joinleaf.com"
              className="block w-full border border-zinc-200 py-3 text-xs uppercase tracking-wider font-bold text-center hover:bg-zinc-50 transition-colors rounded-lg"
            >
              Learn More
            </a>
          </div>

          <p className="text-[11px] text-zinc-400">
            {config.ctaFootnote ?? "Free forever · No credit card required"}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Main ---

type MerchantSection = "deal" | "host";

interface TourStep {
  section: MerchantSection;
  targetId: string;
  title: string;
  description: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    section: "deal",
    targetId: "local-deals",
    title: "Post a deal appears here",
    description:
      "Your offer lands in the neighborhood deals feed — free to add, instant, and self-serve.",
  },
  {
    section: "host",
    targetId: "host-plan",
    title: "Host an event appears here",
    description:
      "Your own event on the building's calendar. Residents RSVP, we promote it, you host.",
  },
];

/**
 * Renders the resident-facing calendar landing.
 *
 * `merchantPreview` is the /partners/preview switch — turns the page
 * into a two-step guided tour. A "Take the tour" trigger sits in the
 * bottom-right; tapping it starts the walkthrough. Each step dims the
 * rest of the page, spotlights the target placement, and floats a
 * callout with Back / Next / Skip controls. Finish or Skip returns
 * the page to normal.
 */
export default function CalendarLandingPage({
  config,
  merchantPreview = false,
}: {
  config: LandingConfig;
  merchantPreview?: boolean;
}) {
  const [showCTA, setShowCTA] = useState(false);
  const [showScrollPopup, setShowScrollPopup] = useState(false);
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  // Auto-start the tour when merchantPreview is on so the merchant
  // lands directly on step 1 (Post a deal spotlit) instead of having
  // to click a "Take the tour" pill first.
  const [tourStep, setTourStep] = useState<number | null>(
    merchantPreview ? 0 : null,
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setShowScrollPopup(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const activeSection: MerchantSection | null =
    tourStep === null ? null : TOUR_STEPS[tourStep].section;

  // Walkthrough tour: each step scrolls its target into view + spotlights
  // it. Escape ends the tour early. Explicit Back / Next / Skip buttons
  // in the callout advance or exit — no click-outside dismiss (the
  // dimmed background is the whole point).
  useEffect(() => {
    if (tourStep === null) return;
    const step = TOUR_STEPS[tourStep];
    const target = document.getElementById(step.targetId);
    // block: "start" (with the section's scroll-mt-32) puts the target
    // near the top of the viewport, leaving the whole bottom half
    // clear for the floating callout — no arrow-overlaps-spotlight.
    target?.scrollIntoView({ behavior: "smooth", block: "start" });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTourStep(null);
      if (e.key === "ArrowRight") {
        setTourStep((s) =>
          s === null || s >= TOUR_STEPS.length - 1 ? null : s + 1,
        );
      }
      if (e.key === "ArrowLeft") {
        setTourStep((s) => (s === null || s <= 0 ? s : s - 1));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tourStep]);

  const startTour = () => setTourStep(0);
  const nextTourStep = () =>
    setTourStep((s) =>
      s === null || s >= TOUR_STEPS.length - 1 ? null : s + 1,
    );
  const prevTourStep = () =>
    setTourStep((s) => (s === null || s <= 0 ? s : s - 1));
  const endTour = () => setTourStep(null);

  // Style object that turns its element into the spotlight "hero" — a
  // dimming inset shadow extends 9999px outward, simulating a backdrop
  // without needing a separate fixed overlay element. The element pops
  // above its surroundings via z-index.
  // Spotlight = the target lifts above a 9999px inset shadow that dims
  // the rest of the page. 20px white halo + 24px inner padding on the
  // section together give the placement enough breathing room that the
  // section header, right-side meta, and card edges never crowd the
  // white edge.
  const spotlightStyle = (active: boolean): CSSProperties =>
    active
      ? {
          position: "relative",
          zIndex: 50,
          borderRadius: 20,
          boxShadow:
            "0 0 0 9999px rgba(0,0,0,0.65), 0 0 0 20px white, 0 25px 60px rgba(0,0,0,0.35)",
          transition: "box-shadow 0.35s ease",
        }
      : { transition: "box-shadow 0.35s ease" };

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -320 : 320,
      behavior: "smooth",
    });
  };

  const handleShare = async (planId: string, title: string) => {
    const url = window.location.href;
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

  const navLabel = config.navLabel ?? "Calendar";
  const plansHeader = config.plansHeader ?? "Upcoming Plans";
  const ideasHeader = config.ideasHeader ?? "Get Involved";
  const ideasTitle = config.ideasTitle ?? "Host Something for the Community";
  const ideasButtonLabel = config.ideasButtonLabel ?? "Host This";

  return (
    <div className="min-h-screen">
      {merchantPreview && tourStep === null && (
        <MerchantTourTrigger onStart={startTour} />
      )}
      {merchantPreview && tourStep !== null && (
        <MerchantTourCallout
          step={tourStep}
          totalSteps={TOUR_STEPS.length}
          content={TOUR_STEPS[tourStep]}
          onNext={nextTourStep}
          onPrev={prevTourStep}
          onSkip={endTour}
        />
      )}

      {/* Navigation */}
      <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-zinc-100 px-6 py-6 md:py-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center gap-3">
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            <img
              src={config.profilePhoto}
              alt={config.profileName}
              className="w-9 h-9 rounded-lg object-cover shrink-0"
            />
            <h1 className="text-sm md:text-2xl font-light tracking-[0.1em] md:tracking-wider uppercase line-clamp-2 md:truncate">
              {config.profileName}
            </h1>
            <div className="h-4 w-px bg-zinc-200 hidden md:block" />
            <span className="text-xs tracking-wider uppercase text-zinc-400 font-bold hidden md:block">
              {navLabel}
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs tracking-wider uppercase font-bold text-zinc-400 hidden sm:inline">
              {config.followerCount} followers
              {config.pastPlanCount !== undefined && config.pastPlanCount > 0 && (
                <>
                  <span className="mx-1.5 text-zinc-300">·</span>
                  {config.pastPlanCount} past plan{config.pastPlanCount === 1 ? "" : "s"}
                </>
              )}
            </span>
            <button
              onClick={() => setShowCTA(true)}
              className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 px-3 py-1.5 rounded-full"
            >
              <Heart className="w-3.5 h-3.5" />
              Follow
            </button>
          </div>
        </div>
      </nav>

      {/* Stream Header — plans lead the page. Local deals (when present)
          appear below as a supporting benefit. Matches the live render on
          /org/[shareId]. */}
      <div
        id={merchantPreview ? "upcoming-plans" : undefined}
        className="max-w-6xl mx-auto px-6 pt-12 pb-6 flex justify-between items-end border-b border-zinc-100 scroll-mt-32"
      >
        <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
          {plansHeader}
        </p>
      </div>

      {/* Plans Stream */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="space-y-32">
          {(() => {
            // In preview mode the first plan in the stream becomes the
            // "host-plan" anchor so the tour's step 2 has a target to
            // scroll to and spotlight.
            const firstHostIndex = merchantPreview ? 0 : -1;
            return config.plans.map((plan, index) => {
            const date = futureDate(plan.daysFromNow);
            const isHostTarget = merchantPreview && index === firstHostIndex;
            const isSpotlit = activeSection === "host" && isHostTarget;
            const cardId = isHostTarget ? "host-plan" : undefined;
            const card = (
              <article
                key={plan.id}
                id={merchantPreview ? cardId : undefined}
                style={merchantPreview ? spotlightStyle(isSpotlit) : undefined}
                className={`group flex flex-col md:flex-row gap-12 md:items-center scroll-mt-32 ${
                  isSpotlit ? "p-12 md:p-14 bg-white rounded-2xl" : ""
                } ${
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
                    <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400">
                      {formatDate(date)} &bull; {plan.time}
                    </p>
                    <h3 className="text-3xl font-light tracking-tight group-hover:italic transition-all">
                      {plan.title}
                    </h3>
                    <div className="pt-2 space-y-1.5">
                      <p className="text-xs tracking-wider uppercase text-zinc-900 font-bold flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: config.brandColor }}
                        />
                        Hosted by {plan.hostName}
                      </p>
                      {plan.sponsoredBy && (
                        <p className="text-xs tracking-wider uppercase font-bold flex items-center gap-2 text-amber-700">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          Sponsored by {plan.sponsoredBy}
                        </p>
                      )}
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
                        style={{ backgroundColor: config.brandColor }}
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
            return card;
            });
          })()}
        </div>

        {/* Local Deals — supporting benefit between plans and the
            engagement levers below. Eyebrow reads "Procured for residents"
            to reinforce the manager-pitch promise (we lined these up on
            their behalf). */}
        {config.deals && config.deals.length > 0 && (
          <section
            id="local-deals"
            style={
              merchantPreview
                ? spotlightStyle(activeSection === "deal")
                : undefined
            }
            className={`max-w-6xl mx-auto px-0 pt-12 pb-1 scroll-mt-32 ${
              activeSection === "deal" ? "p-12 md:p-14 bg-white rounded-2xl" : ""
            }`}
          >
            <div className="flex items-center justify-between pb-3 mb-3">
              <p className="text-[11px] tracking-wider uppercase text-zinc-400 font-bold">
                {config.dealsHeader ?? "Nearby deals"}
              </p>
              <p className="text-[10px] text-zinc-400 hidden sm:block">
                {config.deals.length} {config.deals.length === 1 ? "deal" : "deals"} from nearby businesses
              </p>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2">
              {config.deals.map((deal) => (
                <SampleDealCard
                  key={deal.id}
                  deal={deal}
                  brandColor={config.brandColor}
                  onClick={() => setShowCTA(true)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Plan Ideas Carousel */}
        {config.planIdeas.length > 0 && (
        <section className="mt-48 mb-24 space-y-12">
          <div className="flex justify-between items-end border-b border-zinc-100 pb-8">
            <div className="space-y-2">
              <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
                {ideasHeader}
              </p>
              <h2 className="text-4xl font-light tracking-tight italic">
                {ideasTitle}
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
            {config.planIdeas.map((idea) => (
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
                    <span className="bg-white px-6 py-3 text-xs tracking-wider uppercase font-bold shadow-xl">
                      {ideasButtonLabel}
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
                    <p className="text-xs tracking-wider uppercase font-bold text-emerald-700">
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
        )}

        {/* Bottom CTA */}
        <div className="text-center py-16 border-t border-zinc-100">
          <button
            onClick={() => setShowCTA(true)}
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            {config.bottomCtaText}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* CTA Modal */}
      {showCTA && <CTAModal config={config} onClose={() => setShowCTA(false)} />}

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
                src={config.profilePhoto}
                alt={config.profileName}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">
                  {config.scrollPopupTitle}
                </p>
                <p className="text-xs text-zinc-500">
                  {config.scrollPopupSubtitle}
                </p>
              </div>
            </div>
            <a
              href={SETUP_URL}
              className="block w-full py-2.5 text-xs font-bold uppercase tracking-widest text-white rounded-lg transition-opacity hover:opacity-90 text-center"
              style={{ backgroundColor: config.brandColor }}
            >
              {config.scrollPopupButton}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Merchant preview helpers (rendered only on /partners/preview) ───

/**
 * Floating pill that appears bottom-right when the merchant lands on
 * the preview page. Clicking it starts the guided walkthrough.
 */
function MerchantTourTrigger({ onStart }: { onStart: () => void }) {
  return (
    <button
      onClick={onStart}
      className="fixed bottom-5 right-5 z-[70] inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 rounded-full shadow-2xl px-4 py-3 text-sm font-bold transition-colors"
    >
      <span
        aria-hidden="true"
        className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[11px] flex items-center justify-center shrink-0"
      >
        1
      </span>
      Take the merchant tour
    </button>
  );
}

/**
 * Floating callout for each step of the walkthrough. Blue tooltip
 * anchored to the bottom-center of the viewport with a small triangle
 * pointing up toward the spotlit placement, Back / Next / Skip
 * controls, and a step counter. Modeled after the Humanity /
 * ShiftPlanning tutorial pattern the user referenced.
 */
function MerchantTourCallout({
  step,
  totalSteps,
  content,
  onNext,
  onPrev,
  onSkip,
}: {
  step: number;
  totalSteps: number;
  content: { title: string; description: string };
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;
  // Inline styles rather than Tailwind classes so nothing in the site
  // globals.css (typography plugin, h3 defaults, etc.) can override
  // the callout copy back to a dark color. The bubble is a fixed
  // brand-forest so text has to stay explicitly white to be legible.
  const titleStyle: CSSProperties = { color: "#ffffff" };
  const descStyle: CSSProperties = { color: "rgba(255,255,255,0.92)" };
  const eyebrowStyle: CSSProperties = { color: "#e8a33d" };
  const skipStyle: CSSProperties = { color: "rgba(255,255,255,0.75)" };
  return (
    <div
      id="merchant-tour-callout"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] w-[92vw] max-w-sm"
    >
      {/* Forest / amber palette matches the /partners landing brand.
          Up-pointing arrow triangle re-added so the callout reads as
          anchored to whatever's spotlit above. */}
      <div
        className="relative rounded-2xl shadow-2xl px-6 py-5"
        style={{ backgroundColor: "#1b4332" }}
      >
        <span
          aria-hidden="true"
          className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 rounded-sm"
          style={{ backgroundColor: "#1b4332" }}
        />
        <button
          onClick={onSkip}
          className="absolute top-2 right-2 p-1 hover:opacity-100"
          style={{ color: "rgba(255,255,255,0.75)" }}
          aria-label="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>
        <p
          className="text-[10px] tracking-widest uppercase font-bold mb-2"
          style={eyebrowStyle}
        >
          Step {step + 1} of {totalSteps}
        </p>
        <h3
          className="text-base sm:text-lg font-semibold leading-tight mb-2 pr-6"
          style={titleStyle}
        >
          {content.title}
        </h3>
        <p className="text-sm leading-relaxed mb-4" style={descStyle}>
          {content.description}
        </p>
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onSkip}
            className="text-xs font-medium hover:opacity-100"
            style={skipStyle}
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {!isFirst && (
              <button
                onClick={onPrev}
                className="px-3.5 py-1.5 border border-white/40 rounded-full text-xs font-bold hover:bg-white/10 transition-colors"
                style={titleStyle}
              >
                Back
              </button>
            )}
            <button
              onClick={onNext}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
              style={{ backgroundColor: "#e8a33d", color: "#1c1304" }}
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ArrowRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
