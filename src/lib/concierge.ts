/**
 * Concierge state utilities — shared client-side logic.
 *
 * Surfaces a user's highest-priority Concierge state across their Calendars
 * so the CTAs on /organizations and the banners on /dashboard agree.
 */

import Parse from "./parse-client";

export type ConciergeEligibilityState =
  | "not_eligible"
  | "eligible"
  | "invited"
  | "enrolling"
  | "enrolled";

export type ConciergeSubscriptionStatus =
  | "pending"
  | "active"
  | "cancelling"
  | "past_due"
  | "paused"
  | "cancelled";

export interface CalendarConciergeState {
  calendarId: string;
  calendarName: string;
  eligibilityState: ConciergeEligibilityState;
  subscriptionStatus: ConciergeSubscriptionStatus | null;
  tier: "starter" | "pro" | "concierge";
  priorTier: "starter" | "pro" | null;
  welcomeCreditBalance: number;
}

export interface UserConciergeSummary {
  loading: boolean;
  loggedIn: boolean;
  calendars: CalendarConciergeState[];
  /** Highest-priority calendar to surface in CTAs. */
  primary: CalendarConciergeState | null;
}

/**
 * CTA precedence across Calendars (spec §3 multi-Calendar precedence):
 * enrolling > eligible/invited > paused > enrolled (concierge active)
 *   > cancelling > past_due > churned/not_eligible
 */
const STATE_PRIORITY: Record<string, number> = {
  enrolling: 100,
  invited: 90,
  eligible: 80,
  paused: 70,
  active: 60,
  cancelling: 50,
  past_due: 40,
  cancelled: 10,
  not_eligible: 0,
};

function scoreCalendar(cal: CalendarConciergeState): number {
  const elig = STATE_PRIORITY[cal.eligibilityState] ?? 0;
  const sub = STATE_PRIORITY[cal.subscriptionStatus ?? "not_eligible"] ?? 0;
  return Math.max(elig, sub);
}

/**
 * Loads all Calendars owned by the current user and projects their
 * Concierge state. Returns the highest-priority calendar as `primary`.
 */
export async function loadUserConciergeSummary(): Promise<UserConciergeSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ParseAny = Parse as any;
  const currentUser = ParseAny.User.current();
  if (!currentUser) {
    return { loading: false, loggedIn: false, calendars: [], primary: null };
  }

  const query = new ParseAny.Query("Groups");
  query.equalTo("owner", currentUser);
  query.equalTo("isOrganization", true);
  query.limit(50);
  const results = await query.find();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calendars: CalendarConciergeState[] = results.map((cal: any) => ({
    calendarId: cal.id,
    calendarName: cal.get("name") || cal.get("orgName") || "Untitled calendar",
    eligibilityState:
      (cal.get("conciergeEligibilityState") as ConciergeEligibilityState) ||
      "not_eligible",
    subscriptionStatus:
      (cal.get("conciergeSubscriptionStatus") as ConciergeSubscriptionStatus) ||
      null,
    tier: cal.get("orgSubscriptionTier") || "starter",
    priorTier: cal.get("priorTier") || null,
    welcomeCreditBalance: cal.get("welcomeCreditBalance") || 0,
  }));

  const primary = calendars.length
    ? calendars.reduce((best, c) => (scoreCalendar(c) > scoreCalendar(best) ? c : best))
    : null;

  return {
    loading: false,
    loggedIn: true,
    calendars,
    primary,
  };
}

/**
 * Decide the CTA (label + href) for the Concierge tier card on
 * /organizations. Routes are spec §3 / closing addendum.
 */
export function deriveConciergeCta(summary: UserConciergeSummary): {
  label: string;
  href: string;
  external: boolean;
} {
  // Not logged in OR no eligible calendars → existing demo flow
  const DEFAULT = {
    label: "Book a demo",
    href: "https://calendar.app.google/NCUYc6LUKSiwLUa67",
    external: true,
  };

  if (!summary.loggedIn) return DEFAULT;
  const cal = summary.primary;
  if (!cal) return DEFAULT;

  switch (cal.subscriptionStatus) {
    case "active":
      return { label: "Go to dashboard", href: `/dashboard/${cal.calendarId}`, external: false };
    case "cancelling":
      return { label: "Go to dashboard", href: `/dashboard/${cal.calendarId}`, external: false };
    case "paused":
      return { label: "Resume Concierge", href: `/dashboard/${cal.calendarId}?concierge=resume`, external: false };
    case "past_due":
      return { label: "Update payment", href: `/dashboard/${cal.calendarId}?concierge=billing`, external: false };
    case "cancelled":
      // Churned but Calendar still eligible → re-enroll path
      if (cal.eligibilityState !== "not_eligible") {
        return { label: "Re-enroll", href: `/organizations/enroll/${cal.calendarId}`, external: false };
      }
      return DEFAULT;
  }

  switch (cal.eligibilityState) {
    case "enrolling":
      return { label: "Resume enrollment", href: `/organizations/enroll/${cal.calendarId}`, external: false };
    case "eligible":
    case "invited":
      return { label: "Start enrollment", href: `/organizations/enroll/${cal.calendarId}`, external: false };
    case "enrolled":
      return { label: "Go to dashboard", href: `/dashboard/${cal.calendarId}`, external: false };
    default:
      return DEFAULT;
  }
}

/**
 * Helper: pretty subscription-status labels for dashboard banners.
 */
export function subscriptionStatusLabel(status: ConciergeSubscriptionStatus | null): string {
  switch (status) {
    case "active":
      return "Concierge is active";
    case "cancelling":
      return "Concierge ends at your next billing date";
    case "paused":
      return "Concierge is paused";
    case "past_due":
      return "Concierge billing needs attention";
    case "cancelled":
      return "Concierge ended";
    case "pending":
      return "Setting up Concierge…";
    default:
      return "";
  }
}
