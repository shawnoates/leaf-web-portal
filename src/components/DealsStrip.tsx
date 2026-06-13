"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { Check, Copy, Tag, MapPin, Clock, Lock } from "lucide-react";
import ScheduleDealModal from "@/components/ScheduleDealModal";

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
  business: {
    objectId: string;
    name: string;
    category: string | null;
    formattedAddress: string | null;
  } | null;
}

interface ListResponse {
  deals?: Deal[];
}

export default function DealsStrip({
  calendarId,
  brandColor,
}: {
  calendarId: string;
  brandColor?: string | null;
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

function DealCard({
  deal,
  brandColor,
}: {
  deal: Deal;
  brandColor?: string | null;
}) {
  const isExclusive = deal.dealType === "exclusive";

  return (
    <div className="min-w-[280px] max-w-[320px] snap-start bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col">
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
      </div>
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
