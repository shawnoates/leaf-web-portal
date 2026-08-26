// Scorecard funnel tracking.
//
// One helper rather than the per-route trackXEvent functions elsewhere in the
// app, because this funnel spans three routes (/score, /organizations/setup,
// and the dashboard's first-plan path) and the events have to line up across
// all of them to be readable.
//
// Fans out to every destination that is actually installed:
//   • window.dataLayer — the house idiom. CREATES the array if absent, like
//     the trackCalendarsEvent family does and unlike the marketing-landing
//     [data-cta] listener, which drops clicks silently when GTM is missing.
//     GTM is not installed today; pushing anyway means the events are already
//     there the day it is.
//   • window.oaiq — OpenAI Ads, the one pixel actually in the root layout.
//   • window.fbq / window.ttq — Meta and TikTok. NOT installed yet. The calls
//     are guarded and inert until someone adds the tags, at which point the
//     conversion events start reporting with no code change.
//
// The event that matters is `first_plan_created`. Optimizing either ad
// platform on `scorecard_view` or even `calendar_created` buys cheap clicks
// from people who never build anything — the whole point of carrying the sid
// through to plan creation is to be able to bid on the far end of the funnel.

type Props = Record<string, unknown>;

export type ScorecardEvent =
  | "scorecard_view"
  | "scorecard_start"
  | "scorecard_question_answered"
  | "scorecard_abandoned"
  | "scorecard_revealed"
  | "scorecard_cta_click"
  | "setup_started_from_scorecard"
  | "calendar_created"
  | "first_plan_created"
  | "first_member_post";

/** Events worth reporting to the ad platforms as conversions. Everything else
 *  is funnel diagnostics and stays in the analytics layer — a pixel firing on
 *  every question answered trains the optimizer on noise. */
const PIXEL_EVENTS: Partial<Record<ScorecardEvent, string>> = {
  scorecard_revealed: "ScorecardRevealed",
  setup_started_from_scorecard: "ScorecardSetupStarted",
  calendar_created: "ScorecardCalendarCreated",
  // The primary conversion. This is the one to optimize on.
  first_plan_created: "ScorecardFirstPlan",
};

interface TrackingWindow extends Window {
  dataLayer?: Props[];
  oaiq?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  ttq?: { track?: (name: string, props?: Props) => void };
}

export function trackScorecard(event: ScorecardEvent, props: Props = {}) {
  if (typeof window === "undefined") return;
  const w = window as TrackingWindow;

  try {
    if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
    w.dataLayer.push({ event, ...props });
  } catch {
    /* analytics must never break the page */
  }

  const pixelName = PIXEL_EVENTS[event];
  if (!pixelName) return;

  try {
    w.oaiq?.(pixelName, props);
  } catch {
    /* ignore */
  }
  try {
    w.fbq?.("trackCustom", pixelName, props);
  } catch {
    /* ignore */
  }
  try {
    w.ttq?.track?.(pixelName, props);
  } catch {
    /* ignore */
  }
}

/** The four UTM fields the funnel reports on, read straight off the URL.
 *  Returns {} for direct traffic — the page must work identically with no
 *  campaign attached, so nothing downstream may treat an empty object as an
 *  error state. */
export function readUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const key of ["source", "medium", "campaign", "content"]) {
      const value = params.get(`utm_${key}`);
      if (value) out[key] = value.slice(0, 120);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Coarse device bucket for the view event. The page is built mobile-first on
 *  the assumption that 80%+ of ad traffic is a phone in portrait; this is how
 *  that assumption gets checked rather than trusted. */
export function readDevice(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}
