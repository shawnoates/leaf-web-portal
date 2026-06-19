"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Tag, Lock, Flag, Heart, ChevronRight, X } from "lucide-react";
import ReportDealModal from "@/components/ReportDealModal";

const CAROUSEL_LIMIT = 6;

export interface Deal {
  objectId: string;
  title: string;
  description: string | null;
  terms: string | null;
  discountType: string;
  discountValue: number | null;
  promoCode: string | null;
  imageUrl: string | null;
  imageAttribution: { displayName: string | null; uri: string | null } | null;
  dealType: "public" | "exclusive";
  redeemRadiusMeters: number;
  redeemWindowMinutes: number;
  isLastMinute: boolean;
  interestCount: number;
  // Only populated when the strip is fetched with sortBy=popular90d.
  interestCount90d?: number;
  business: {
    objectId: string;
    googlePlaceId: string | null;
    name: string;
    category: string | null;
    formattedAddress: string | null;
  } | null;
}

// Two-state segment control for the strip header. Trending = unique
// interest count in the past 90 days; Newest = createdAt DESC (default).
function SortToggle({
  value,
  onChange,
  size = "regular",
}: {
  value: "recent" | "popular90d";
  onChange: (v: "recent" | "popular90d") => void;
  size?: "compact" | "regular";
}) {
  const base = size === "compact" ? "text-[10px]" : "text-[11px]";
  const pad = size === "compact" ? "px-2 py-0.5" : "px-2.5 py-1";
  return (
    <div className={`inline-flex items-center gap-0.5 bg-zinc-100 rounded-full p-0.5 ${base}`}>
      <button
        type="button"
        onClick={() => onChange("popular90d")}
        className={`${pad} rounded-full font-medium transition-colors ${
          value === "popular90d" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
        }`}
      >
        Trending
      </button>
      <button
        type="button"
        onClick={() => onChange("recent")}
        className={`${pad} rounded-full font-medium transition-colors ${
          value === "recent" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900"
        }`}
      >
        Newest
      </button>
    </div>
  );
}

// Small caption shown under deal images sourced from Google Places. Required
// by the Places TOS when displaying their photos. Renders nothing when the
// deal has no attribution (CSV-supplied imageUrl or no image at all).
function PhotoCredit({ attribution }: { attribution: Deal["imageAttribution"] }) {
  if (!attribution || !attribution.displayName) return null;
  return (
    <p className="px-2.5 pt-1 text-[9px] text-zinc-400 leading-tight line-clamp-1">
      Photo:{" "}
      {attribution.uri ? (
        <a
          href={attribution.uri}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="underline hover:text-zinc-600"
        >
          {attribution.displayName}
        </a>
      ) : (
        attribution.displayName
      )}
      {" "}/ Google
    </p>
  );
}

// ─── Interest tracking (anonymous, cookie-based) ─────────────────────────
// One opaque cookie per visitor; we never associate it with anything
// identifying. localStorage tracks which deals THIS visitor has already
// interested in so the heart shows filled across reloads.

const INTEREST_COOKIE_KEY = "leaf_interest_cookie";
const INTERESTED_DEALS_KEY = "leaf_interested_deals";

function getOrCreateInterestCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`${INTEREST_COOKIE_KEY}=([^;]+)`)
  );
  if (match) return match[1];
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  document.cookie = `${INTEREST_COOKIE_KEY}=${random}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
  return random;
}

function isLocallyInterested(dealId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(INTERESTED_DEALS_KEY);
    if (!raw) return false;
    const ids: string[] = JSON.parse(raw);
    return Array.isArray(ids) && ids.includes(dealId);
  } catch {
    return false;
  }
}

function rememberInterest(dealId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(INTERESTED_DEALS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(dealId)) {
      ids.push(dealId);
      localStorage.setItem(INTERESTED_DEALS_KEY, JSON.stringify(ids));
    }
  } catch {
    /* localStorage blocked / quota */
  }
}

interface ListResponse {
  deals?: Deal[];
}

// Eyebrow framing: state the audience without claiming procurement. Most
// deals here are publicly available offers sourced from nearby businesses,
// not Leaf-negotiated exclusives — "Procured" would over-claim. The
// individual <Excl> badge on each card carries the "exclusive" signal
// where it's actually true.
function dealsEyebrow(audienceName?: string | null): string {
  const trimmed = audienceName?.trim();
  if (trimmed && trimmed.length <= 18) {
    return `Nearby deals for ${trimmed} residents`;
  }
  return "Nearby deals for residents";
}

export default function DealsStrip({
  calendarId,
  brandColor,
  compact = false,
  audienceName,
  onCreatePlanFromDeal,
  onLoaded,
}: {
  calendarId: string;
  brandColor?: string | null;
  /**
   * Compact layout — matches the apartment landing page design. Smaller
   * cards, no public-deal copy code button, exclusive badge overlaid on the
   * image, tighter section header. Used on apartment-type org calendars.
   */
  compact?: boolean;
  /**
   * Building / calendar name. When short enough to fit in the eyebrow,
   * shown as "Procured for {audienceName} residents". Otherwise the
   * generic "Procured for residents" is used.
   */
  audienceName?: string | null;
  /**
   * When provided, tapping a card pre-fills the org page's custom-plan
   * modal with this deal's title/description/venue (instead of any
   * deal-specific schedule flow). The "Interested" heart still works as
   * the lightweight solo signal.
   */
  onCreatePlanFromDeal?: (deal: Deal) => void;
  /**
   * Fires once per fetch with the loaded deal count. Lets the host page
   * (e.g. org/[shareId]) reference the count in its own UI — for example,
   * a "browse N deals" lifeline in the empty-plans state.
   */
  onLoaded?: (count: number) => void;
}) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"recent" | "popular90d">("recent");

  useEffect(() => {
    if (!calendarId) return;
    setLoaded(false);
    Parse.Cloud.run("listDealsForCalendar", { calendarId, sortBy })
      .then((r: ListResponse) => {
        const list = r.deals || [];
        setDeals(list);
        onLoaded?.(list.length);
      })
      .catch(() => {
        setDeals([]);
        onLoaded?.(0);
      })
      .finally(() => setLoaded(true));
  }, [calendarId, sortBy, onLoaded]);

  if (!loaded || deals.length === 0) return null;

  const eyebrow = dealsEyebrow(audienceName);

  const visibleDeals = deals.slice(0, CAROUSEL_LIMIT);
  const overflowCount = deals.length - CAROUSEL_LIMIT;

  if (compact) {
    return (
      <section id="local-deals" className="max-w-6xl mx-auto px-6 pt-5 pb-1">
        <div className="flex items-center justify-between pb-3 mb-3 gap-2">
          <p className="text-[11px] tracking-wider uppercase text-zinc-400 font-bold">
            {eyebrow}
          </p>
          <div className="flex items-center gap-2">
            <SortToggle value={sortBy} onChange={setSortBy} size="compact" />
            {overflowCount > 0 ? (
              <button
                onClick={() => setViewAllOpen(true)}
                className="inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
              >
                View all <span className="text-zinc-400">({deals.length})</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : (
              <p className="text-[10px] text-zinc-400 hidden sm:block">
                {deals.length} {deals.length === 1 ? "deal" : "deals"} from nearby
                businesses
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-6 px-6">
          {visibleDeals.map((deal) => (
            <CompactDealCard
              key={deal.objectId}
              deal={deal}
              brandColor={brandColor}
              onCreatePlanFromDeal={onCreatePlanFromDeal}
            />
          ))}
        </div>
        {viewAllOpen && (
          <AllDealsModal
            deals={deals}
            brandColor={brandColor}
            onCreatePlanFromDeal={onCreatePlanFromDeal}
            onClose={() => setViewAllOpen(false)}
          />
        )}
      </section>
    );
  }

  return (
    <section id="local-deals" className="max-w-6xl mx-auto px-6 pt-12 pb-2">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-6 mb-6 gap-3">
        <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
          {eyebrow}
        </p>
        <div className="flex items-center gap-3">
          <SortToggle value={sortBy} onChange={setSortBy} />
          {overflowCount > 0 ? (
            <button
              onClick={() => setViewAllOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
            >
              View all <span className="text-zinc-400">({deals.length})</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          ) : (
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              {deals.length} {deals.length === 1 ? "deal" : "deals"} from nearby
              businesses
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 -mx-6 px-6">
        {visibleDeals.map((deal) => (
          <DealCard
            key={deal.objectId}
            deal={deal}
            brandColor={brandColor}
            onCreatePlanFromDeal={onCreatePlanFromDeal}
          />
        ))}
      </div>
      {viewAllOpen && (
        <AllDealsModal
          deals={deals}
          brandColor={brandColor}
          onCreatePlanFromDeal={onCreatePlanFromDeal}
          onClose={() => setViewAllOpen(false)}
        />
      )}
    </section>
  );
}

// ─── Full-screen "View all deals" modal ──────────────────────────────────
// Grid of CompactDealCard regardless of context — vertical density beats
// per-card detail when you're scanning 10+ deals. Same hover, tap, and
// Interested behaviors as the carousel version.
function AllDealsModal({
  deals,
  brandColor,
  onCreatePlanFromDeal,
  onClose,
}: {
  deals: Deal[];
  brandColor?: string | null;
  onCreatePlanFromDeal?: (deal: Deal) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full md:max-w-5xl md:h-[90vh] h-full md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <p className="text-[10px] tracking-wider uppercase font-bold text-zinc-500">
              Local Deals
            </p>
            <h2 className="text-lg font-semibold tracking-tight">
              {deals.length} {deals.length === 1 ? "deal" : "deals"} nearby
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-900"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns:
                "repeat(auto-fill, minmax(160px, 1fr))",
            }}
          >
            {deals.map((deal) => (
              <CompactDealCard
                key={deal.objectId}
                deal={deal}
                brandColor={brandColor}
                onCreatePlanFromDeal={(d) => {
                  onCreatePlanFromDeal?.(d);
                  onClose();
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Compact card (apartment-only) ───────────────────────────────────────
// Mirrors the SampleDealCard on /apartment: smaller width, badge overlaid
// on image, no copy-code button for public deals (address is the
// redemption hint). Keeps ScheduleDealModal for exclusive deals + the
// Report flow.
function CompactDealCard({
  deal,
  brandColor,
  onCreatePlanFromDeal,
}: {
  deal: Deal;
  brandColor?: string | null;
  onCreatePlanFromDeal?: (deal: Deal) => void;
}) {
  const isExclusive = deal.dealType === "exclusive";
  const [reportOpen, setReportOpen] = useState(false);
  const [interested, setInterested] = useState(false);
  const [interestCount, setInterestCount] = useState(deal.interestCount || 0);

  useEffect(() => {
    setInterested(isLocallyInterested(deal.objectId));
  }, [deal.objectId]);

  const markInterested = async () => {
    if (interested) return;
    const cookie = getOrCreateInterestCookie();
    // Optimistic — keep UX snappy even on slow networks.
    setInterested(true);
    setInterestCount((n) => n + 1);
    rememberInterest(deal.objectId);
    try {
      const r: { interestCount?: number; deduped?: boolean } =
        await Parse.Cloud.run("markDealInterest", {
          dealId: deal.objectId,
          cookie,
        });
      if (typeof r.interestCount === "number") setInterestCount(r.interestCount);
    } catch {
      // Roll back the optimistic bump on failure (but keep "interested"
      // local state — they've expressed intent).
      setInterestCount((n) => Math.max(0, n - 1));
    }
  };

  // Tapping the card body routes through the org page's custom-plan modal
  // (pre-filled venue / title / description). Both public and exclusive deals
  // use the same flow now. Footer buttons (Interested, Report) stop
  // propagation so they don't double-fire.
  const openPlanFromDeal = () => onCreatePlanFromDeal?.(deal);

  return (
    <div
      onClick={openPlanFromDeal}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPlanFromDeal();
        }
      }}
      className="min-w-[160px] max-w-[180px] snap-start bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col text-left hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900"
    >
      <div className="relative">
        {deal.imageUrl ? (
          <div className="aspect-[16/10] bg-zinc-100 overflow-hidden">
            <img
              src={deal.imageUrl}
              alt={deal.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="aspect-[16/10] flex items-center justify-center"
            style={{
              backgroundColor: brandColor ? `${brandColor}15` : "#fafafa",
            }}
          >
            <Tag
              className="w-5 h-5"
              style={{ color: brandColor || "#a1a1aa" }}
            />
          </div>
        )}
        {isExclusive && (
          <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-zinc-900/90 text-white backdrop-blur-sm">
            <Lock className="w-2 h-2" />
            Excl
          </span>
        )}
      </div>
      {deal.imageUrl && <PhotoCredit attribution={deal.imageAttribution} />}
      <div className="p-2.5 flex-1 flex flex-col gap-1">
        <p className="text-[9px] tracking-wider uppercase font-bold text-zinc-500 line-clamp-1">
          {deal.business?.name ?? "Local Business"}
        </p>
        <h3 className="text-xs font-medium tracking-tight leading-snug line-clamp-2">
          {deal.title}
        </h3>
        {deal.business?.formattedAddress && (
          <p className="text-[10px] text-zinc-400 mt-auto pt-0.5 line-clamp-1">
            {deal.business.formattedAddress}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              markInterested();
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
            onClick={(e) => {
              e.stopPropagation();
              setReportOpen(true);
            }}
            className="text-[9px] text-zinc-300 hover:text-zinc-600 inline-flex items-center gap-0.5"
          >
            <Flag className="w-2 h-2" />
            Report
          </button>
        </div>
      </div>

      {reportOpen && (
        <ReportDealModal
          dealId={deal.objectId}
          dealTitle={deal.title}
          businessName={deal.business?.name ?? null}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

function DealCard({
  deal,
  brandColor,
  onCreatePlanFromDeal,
}: {
  deal: Deal;
  brandColor?: string | null;
  onCreatePlanFromDeal?: (deal: Deal) => void;
}) {
  const isExclusive = deal.dealType === "exclusive";
  const [reportOpen, setReportOpen] = useState(false);
  const [interested, setInterested] = useState(false);
  const [interestCount, setInterestCount] = useState(deal.interestCount || 0);

  useEffect(() => {
    setInterested(isLocallyInterested(deal.objectId));
  }, [deal.objectId]);

  const markInterested = async () => {
    if (interested) return;
    const cookie = getOrCreateInterestCookie();
    setInterested(true);
    setInterestCount((n) => n + 1);
    rememberInterest(deal.objectId);
    try {
      const r: { interestCount?: number; deduped?: boolean } =
        await Parse.Cloud.run("markDealInterest", {
          dealId: deal.objectId,
          cookie,
        });
      if (typeof r.interestCount === "number") setInterestCount(r.interestCount);
    } catch {
      setInterestCount((n) => Math.max(0, n - 1));
    }
  };

  const openPlanFromDeal = () => onCreatePlanFromDeal?.(deal);

  return (
    <div
      onClick={openPlanFromDeal}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPlanFromDeal();
        }
      }}
      className="min-w-[280px] max-w-[320px] snap-start bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col relative text-left hover:border-zinc-300 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900"
    >
      <div className="relative">
        {deal.imageUrl ? (
          <div className="aspect-[4/3] bg-zinc-100 overflow-hidden">
            <img
              src={deal.imageUrl}
              alt={deal.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="aspect-[4/3] flex items-center justify-center"
            style={{
              backgroundColor: brandColor ? `${brandColor}10` : "#fafafa",
            }}
          >
            <Tag
              className="w-8 h-8"
              style={{ color: brandColor || "#a1a1aa" }}
            />
          </div>
        )}
        {isExclusive && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900/90 text-white backdrop-blur-sm">
            <Lock className="w-2.5 h-2.5" />
            Exclusive
          </span>
        )}
      </div>
      {deal.imageUrl && <PhotoCredit attribution={deal.imageAttribution} />}

      <div className="p-4 flex-1 flex flex-col gap-2">
        <p className="text-[10px] tracking-wider uppercase font-bold text-zinc-500 line-clamp-1">
          {deal.business?.name ?? "Local Business"}
        </p>

        <h3 className="text-base font-medium tracking-tight leading-snug line-clamp-2">
          {deal.title}
        </h3>

        {deal.description && (
          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
            {deal.description}
          </p>
        )}

        {deal.business?.formattedAddress && (
          <p className="text-[11px] text-zinc-400 mt-auto pt-1 line-clamp-1">
            {deal.business.formattedAddress}
          </p>
        )}

        {deal.terms && (
          <p className="text-[10px] text-zinc-400 italic line-clamp-1">
            {deal.terms}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={(e) => {
              e.stopPropagation();
              markInterested();
            }}
            disabled={interested}
            className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
              interested
                ? "text-red-600 cursor-default"
                : "text-zinc-500 hover:text-red-600"
            }`}
            aria-label={interested ? "You're interested" : "Mark as interested"}
          >
            <Heart
              className="w-3.5 h-3.5"
              fill={interested ? "currentColor" : "none"}
            />
            <span>
              {interestCount > 0 ? interestCount : ""}
              {interestCount === 0 && !interested && "Interested"}
              {interested && interestCount === 1 && " You"}
            </span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setReportOpen(true);
            }}
            className="text-[10px] text-zinc-400 hover:text-zinc-700 inline-flex items-center gap-1"
          >
            <Flag className="w-2.5 h-2.5" />
            Report
          </button>
        </div>
      </div>

      {reportOpen && (
        <ReportDealModal
          dealId={deal.objectId}
          dealTitle={deal.title}
          businessName={deal.business?.name ?? null}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

