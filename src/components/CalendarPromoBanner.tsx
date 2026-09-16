"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { getVerifiedUserCookie } from "@/lib/verified-user";
import { Check, Copy, ExternalLink, Gift, Loader2, X } from "lucide-react";

// Partner thank-you banner. The server only returns a banner to people who
// follow the calendar or attended one of its plans, and it withholds the promo
// code until "Show code" is tapped, so this component never has to decide
// eligibility itself.
//
// Two modes, because two kinds of surface show it:
//   - a calendar is in context (/org/<shareId>, a recap) → that calendar's banner
//   - no calendar is in context (/me) → the server picks the best one across
//     every calendar this viewer follows or attended, and names it
interface ViewerBanner {
  objectId: string;
  brandName: string | null;
  headline: string;
  body: string | null;
  hasPromoCode: boolean;
  ctaLabel: string | null;
  ctaUrl: string | null;
  expiresAt: string | null;
  reason: "following" | "attended";
  /** Only set by getBannerForMe, where the calendar isn't already on screen. */
  calendarName?: string | null;
}

const DISMISS_PREFIX = "leaf_banner_dismissed_";

// Same identity lookup the calendar page uses for getOrgCalendarPage.
function viewerPhone(): string | undefined {
  if (typeof window === "undefined") return undefined;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem("leaf_follower_phone");
  } catch {
    /* storage blocked */
  }
  return stored || getVerifiedUserCookie()?.phone?.replace(/\D/g, "") || undefined;
}

function isDismissed(bannerId: string) {
  try {
    return localStorage.getItem(DISMISS_PREFIX + bannerId) === "1";
  } catch {
    return false;
  }
}

function formatEnds(isoString: string | null) {
  if (!isoString) return null;
  return new Date(isoString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CalendarPromoBanner({
  calendarId,
  isFollowing = false,
  brandColor,
  className = "max-w-6xl mx-auto px-6 pt-6",
  stacked = false,
}: {
  /** Omit to let the server pick across all of this viewer's calendars. */
  calendarId?: string | null;
  // Re-checked when it flips, so a visitor who follows from this page sees the
  // banner without a reload.
  isFollowing?: boolean;
  brandColor?: string | null;
  /** Outer spacing, which differs per surface. */
  className?: string;
  /** Keep the buttons under the copy at every width. /me renders this inside a
   *  narrow content column, where the wide-screen side-by-side row squeezes the
   *  headline into a ragged two or three lines. */
  stacked?: boolean;
}) {
  const [banner, setBanner] = useState<ViewerBanner | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const phoneNumber = viewerPhone();
    const request = calendarId
      ? Parse.Cloud.run("getCalendarBannerForViewer", { calendarId, phoneNumber })
      : Parse.Cloud.run("getBannerForMe", { phoneNumber });
    request
      .then((r: { banner: ViewerBanner | null }) => {
        if (cancelled) return;
        setBanner(r.banner && !isDismissed(r.banner.objectId) ? r.banner : null);
      })
      .catch(() => {
        // A banner is a nice-to-have; never surface an error for it.
      });
    return () => {
      cancelled = true;
    };
  }, [calendarId, isFollowing]);

  if (!banner) return null;

  const accent = brandColor || "#18181b";
  const ends = formatEnds(banner.expiresAt);

  const reveal = async () => {
    setRevealing(true);
    setRevealError(null);
    try {
      const r: { promoCode: string } = await Parse.Cloud.run("revealCalendarBannerCode", {
        bannerId: banner.objectId,
        phoneNumber: viewerPhone(),
      });
      setCode(r.promoCode);
    } catch (e) {
      setRevealError(e instanceof Error ? e.message : "Couldn't load the code.");
    } finally {
      setRevealing(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the code is still visible to copy by hand */
    }
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_PREFIX + banner.objectId, "1");
    } catch {
      /* storage blocked; hide for this visit only */
    }
    setBanner(null);
  };

  return (
    <div className={className}>
      <section
        aria-label={banner.brandName ? `Offer from ${banner.brandName}` : "Partner offer"}
        className={`relative border border-zinc-200 bg-white rounded-xl px-5 py-4 sm:px-6 sm:py-5 flex flex-col gap-4 ${stacked ? "" : "sm:flex-row sm:items-center"}`}
        style={{ borderLeft: `4px solid ${accent}` }}
      >
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-zinc-700"
          aria-label="Dismiss offer"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Spacing is gap, not margin: /me scopes a `.leafme p { margin: 0 }`
            reset that outranks Tailwind's mt-* utilities and would flatten
            this block. */}
        <div
          className={`min-w-0 pr-6 flex flex-col gap-1 ${stacked ? "" : "flex-1 sm:pr-0"}`}
        >
          <p className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase font-bold text-zinc-500">
            <Gift className="w-3.5 h-3.5" />
            {banner.brandName ? `A thank-you from ${banner.brandName}` : "A thank-you for our community"}
          </p>
          <p className="text-base font-medium text-zinc-900">{banner.headline}</p>
          {banner.body && <p className="text-sm text-zinc-600">{banner.body}</p>}
          <p className="text-[11px] text-zinc-400 pt-1">
            {banner.reason === "attended"
              ? banner.calendarName
                ? `Because you came out with ${banner.calendarName}`
                : "For people who came out"
              : banner.calendarName
                ? `Because you follow ${banner.calendarName}`
                : "For followers of this calendar"}
            {ends && ` · Ends ${ends}`}
          </p>
        </div>

        <div
          className={`flex flex-wrap items-center gap-2 ${stacked ? "" : "sm:justify-end sm:pr-6"}`}
        >
          {banner.hasPromoCode &&
            (code ? (
              <button
                onClick={copy}
                className="inline-flex items-center gap-2 font-mono text-sm bg-zinc-900 text-white px-3 py-2 rounded-lg"
                aria-label={`Copy code ${code}`}
              >
                {code}
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <button
                onClick={reveal}
                disabled={revealing}
                className="inline-flex items-center gap-1.5 text-white text-xs font-bold uppercase tracking-widest px-4 py-2.5 rounded-lg hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {revealing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Show code
              </button>
            ))}
          {banner.ctaUrl && (
            <a
              href={banner.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-zinc-700 border border-zinc-200 px-4 py-2.5 rounded-lg hover:bg-zinc-50"
            >
              {banner.ctaLabel || "Learn more"}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {revealError && <p className="w-full text-xs text-red-600">{revealError}</p>}
        </div>
      </section>
    </div>
  );
}
