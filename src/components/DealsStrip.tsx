"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Copy, Tag, MapPin, Clock, Lock, Flag, Heart } from "lucide-react";
import ScheduleDealModal from "@/components/ScheduleDealModal";
import ReportDealModal from "@/components/ReportDealModal";

interface Deal {
  objectId: string;
  title: string;
  description: string | null;
  terms: string | null;
  discountType: string;
  discountValue: number | null;
  promoCode: string | null;
  imageUrl: string | null;
  dealType: "public" | "exclusive";
  redeemRadiusMeters: number;
  redeemWindowMinutes: number;
  isLastMinute: boolean;
  interestCount: number;
  business: {
    objectId: string;
    name: string;
    category: string | null;
    formattedAddress: string | null;
  } | null;
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

export default function DealsStrip({
  calendarId,
  brandColor,
  compact = false,
}: {
  calendarId: string;
  brandColor?: string | null;
  /**
   * Compact layout — matches the apartment landing page design. Smaller
   * cards, no public-deal copy code button, exclusive badge overlaid on the
   * image, tighter section header. Used on apartment-type org calendars.
   */
  compact?: boolean;
}) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!calendarId) return;
    Parse.Cloud.run("listDealsForCalendar", { calendarId })
      .then((r: ListResponse) => setDeals(r.deals || []))
      .catch(() => setDeals([]))
      .finally(() => setLoaded(true));
  }, [calendarId]);

  if (!loaded || deals.length === 0) return null;

  if (compact) {
    return (
      <section className="max-w-6xl mx-auto px-6 pt-5 pb-1">
        <div className="flex items-center justify-between pb-3 mb-3">
          <p className="text-[11px] tracking-wider uppercase text-zinc-400 font-bold">
            Local Deals
          </p>
          <p className="text-[10px] text-zinc-400 hidden sm:block">
            {deals.length} {deals.length === 1 ? "deal" : "deals"} from nearby
            businesses
          </p>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-6 px-6">
          {deals.map((deal) => (
            <CompactDealCard
              key={deal.objectId}
              deal={deal}
              brandColor={brandColor}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-6 pt-12 pb-2">
      <div className="flex items-center justify-between border-b border-zinc-100 pb-6 mb-6">
        <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
          Local Deals
        </p>
        <p className="text-[11px] text-zinc-400 hidden sm:block">
          {deals.length} {deals.length === 1 ? "deal" : "deals"} from nearby
          businesses
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 -mx-6 px-6">
        {deals.map((deal) => (
          <DealCard key={deal.objectId} deal={deal} brandColor={brandColor} />
        ))}
      </div>
    </section>
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
}: {
  deal: Deal;
  brandColor?: string | null;
}) {
  const isExclusive = deal.dealType === "exclusive";
  const [scheduleOpen, setScheduleOpen] = useState(false);
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

  return (
    <div className="min-w-[160px] max-w-[180px] snap-start bg-white border border-zinc-200 rounded-lg overflow-hidden flex flex-col">
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
      <div className="p-2.5 flex-1 flex flex-col gap-1">
        <p className="text-[9px] tracking-wider uppercase font-bold text-zinc-500 line-clamp-1">
          {deal.business?.name ?? "Local Business"}
        </p>
        <h3 className="text-xs font-medium tracking-tight leading-snug line-clamp-2">
          {deal.title}
        </h3>
        {deal.business?.formattedAddress && (
          <div className="flex items-center gap-1 text-[10px] text-zinc-400 mt-auto pt-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            <span className="line-clamp-1">
              {deal.business.formattedAddress}
            </span>
          </div>
        )}
        {isExclusive && (
          <button
            onClick={() => setScheduleOpen(true)}
            className="mt-1 w-full px-2 py-1 rounded text-white text-[10px] font-bold uppercase tracking-wider text-center transition-opacity hover:opacity-90"
            style={{ backgroundColor: brandColor || "#18181b" }}
          >
            Schedule to redeem
          </button>
        )}
        <div className="mt-1 flex items-center justify-between">
          <button
            onClick={markInterested}
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
            onClick={() => setReportOpen(true)}
            className="text-[9px] text-zinc-300 hover:text-zinc-600 inline-flex items-center gap-0.5"
          >
            <Flag className="w-2 h-2" />
            Report
          </button>
        </div>
      </div>

      {scheduleOpen && (
        <ScheduleDealModal
          deal={{
            objectId: deal.objectId,
            title: deal.title,
            redeemWindowMinutes: deal.redeemWindowMinutes,
            business: deal.business,
          }}
          brandColor={brandColor}
          onClose={() => setScheduleOpen(false)}
          onScheduled={() => {
            /* modal owns success */
          }}
        />
      )}
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
}: {
  deal: Deal;
  brandColor?: string | null;
}) {
  const isExclusive = deal.dealType === "exclusive";
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="min-w-[280px] max-w-[320px] snap-start bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col relative">
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

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] tracking-wider uppercase font-bold text-zinc-500 line-clamp-1">
            {deal.business?.name ?? "Local Business"}
          </p>
          {isExclusive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 text-white">
              <Lock className="w-2.5 h-2.5" />
              Exclusive
            </span>
          ) : (
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
              Public
            </span>
          )}
        </div>

        <h3 className="text-base font-medium tracking-tight leading-snug line-clamp-2">
          {deal.title}
        </h3>

        {deal.description && (
          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
            {deal.description}
          </p>
        )}

        {deal.business?.formattedAddress && (
          <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-auto pt-1">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="line-clamp-1">
              {deal.business.formattedAddress}
            </span>
          </div>
        )}

        {deal.terms && (
          <p className="text-[10px] text-zinc-400 italic line-clamp-1">
            {deal.terms}
          </p>
        )}

        {isExclusive ? (
          <ExclusiveCta deal={deal} brandColor={brandColor} />
        ) : (
          <PublicCta deal={deal} />
        )}

        <button
          onClick={() => setReportOpen(true)}
          className="mt-2 self-end text-[10px] text-zinc-400 hover:text-zinc-700 inline-flex items-center gap-1"
        >
          <Flag className="w-2.5 h-2.5" />
          Report
        </button>
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

function PublicCta({ deal }: { deal: Deal }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!deal.promoCode) return;
    try {
      await navigator.clipboard.writeText(deal.promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  if (!deal.promoCode) {
    return (
      <p className="mt-2 text-[11px] text-zinc-400 text-center py-2 border-t border-zinc-100">
        Visit the business to redeem
      </p>
    );
  }

  return (
    <button
      onClick={copy}
      className="mt-2 inline-flex items-center justify-center gap-2 w-full px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold uppercase tracking-wider rounded-md transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Code: {deal.promoCode}
        </>
      )}
    </button>
  );
}

function ExclusiveCta({
  deal,
  brandColor,
}: {
  deal: Deal;
  brandColor?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 w-full px-3 py-2 rounded-md text-white text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
        style={{ backgroundColor: brandColor || "#18181b" }}
      >
        Schedule to redeem
      </button>
      <p className="text-[10px] text-zinc-500 mt-1 inline-flex items-center gap-1">
        <Clock className="w-2.5 h-2.5" />
        ±{deal.redeemWindowMinutes}min window at the business
      </p>
      {open && (
        <ScheduleDealModal
          deal={{
            objectId: deal.objectId,
            title: deal.title,
            redeemWindowMinutes: deal.redeemWindowMinutes,
            business: deal.business,
          }}
          brandColor={brandColor}
          onClose={() => setOpen(false)}
          onScheduled={() => {
            // Modal handles its own success state; nothing for the strip to do.
          }}
        />
      )}
    </>
  );
}
