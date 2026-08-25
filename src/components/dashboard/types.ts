// Shared types for the redesigned org dashboard (Home / Calendars / Community /
// Grow / Inbox). `OrgDashboard` is the `getOrgDashboard` cloud-function payload
// and used to live inline in `app/dashboard/[calendarId]/page.tsx`; it moved
// here so the place components (HomeTab, CommunityTab, …) can type their props
// without importing the 3k-line page module.

export interface CalActivePlan {
  objectId: string;
  calendarId?: string;
  title: string;
  description: string;
  image: string | null;
  date: string;
  timezone: string | null;
  time: string | null;
  hostName: string;
  isVirtualHost?: boolean;
  virtualHostAvatarUrl?: string | null;
  leafHostState?: "leaf_hosted" | "leaf_arranging" | null;
  leafHostPersona?: { name: string; avatarUrl: string | null } | null;
  rsvpCount: number;
  location: { name: string; address: string; placeId?: string | null } | null;
  isPoll?: boolean;
  pollPostId?: string | null;
  pollOptionCount?: number;
  pollVoteCount?: number;
  pollClosesAt?: string | null;
  hideVenueUntilRsvp?: boolean;
  requireApproval?: boolean;
  planSeriesId?: string | null;
}

export interface OrgDashboardCalendar {
  objectId: string;
  name: string;
  description: string;
  shareId: string;
  city: string;
  isPrimary: boolean;
  isActive: boolean;
  role: "Owner" | "Host";
  calendarImage: string | null;
  hideVenueUntilRsvp: boolean;
  requireApprovalDefault: boolean;
  isPrivate: boolean;
  hidePlanIdeas: boolean;
  hideCustomPlans: boolean;
  hideDeals: boolean;
  merchantEventsOptOut: boolean;
  merchantEventsRequireApproval: boolean;
  pendingFollowerCount: number;
  isConciergeServiced?: boolean;
  /** Present on the wire but untyped upstream — upcoming plans per calendar. */
  activePlans?: CalActivePlan[];
  /** Home NEEDS YOU card: the most urgent idea still needing a host plus the
   *  follower most likely to say yes. Only sent for calendars that hide plan
   *  ideas — when ideas are public, followers can claim them unprompted. */
  host_candidate?: {
    idea: { objectId: string; title: string; date: string | null };
    candidate_user: {
      name: string;
      phone: string | null;
      membership_id: string;
    };
    reason: string;
  } | null;
  /** Home NEEDS YOU card: the soonest upcoming plan plus a follower to invite
   *  — someone who has never RSVP'd, or the best-matched follower who hasn't
   *  RSVP'd to that plan yet (`never_rsvpd` says which). */
  reengagement?: {
    plan: {
      objectId: string;
      title: string;
      date: string | null;
      /** Venue IANA zone — the day label must be formatted in it. */
      timezone: string | null;
    };
    target_user: {
      name: string;
      phone: string | null;
      membership_id: string;
    };
    never_rsvpd: boolean;
  } | null;
}

export interface OrgDashboard {
  objectId: string;
  name: string;
  description: string;
  shareId: string;
  orgType: string | null;
  tier: string;
  /** The single calendar the concierge host runs (null unless on concierge). */
  conciergeServicedCalendarId: string | null;
  subscriptionStatus: string | null;
  subscriptionCancelAt: number | null;
  billingInterval: string | null; // "month" or "year"
  isOwner: boolean;
  isOrgCoHost: boolean;
  /** Whether the viewer has linked the iOS app (functions.js: getOrgDashboard
   *  returns this off the requesting _User). Only ever used to flip the local
   *  flag on, never off — the auth effect seeds it from Parse.User.current(). */
  leafAppConnected?: boolean;
  conciergePersona?: { name: string; avatarUrl: string | null } | null;
  viewerCalendarRole: "Owner" | "Host" | null;
  calendarRoles: Record<string, "Owner" | "Host">;
  profilePhoto: string | null;
  bannerUrl: string | null;
  brandColor: string;
  daysOfWeek: number[];
  preferredTimes: string[];
  blacklistCategories: string[];
  excludeKeywords: string[];
  locationTypes: string[];
  cities: string[];
  planIdeasPerWeek: number;
  website: string;
  imageStyle: string;
  hidePlanIdeas: boolean;
  hideCustomPlans: boolean;
  hideDeals: boolean;
  memberCount: number;
  totalRsvpCount: number;
  rsvpLimit: number | null;
  rsvpsThisMonth: number;
  /** Calendar-month stat-tile counts with last-month counterparts for the
   *  month-over-month deltas. Optional until the getOrgDashboard deploy that
   *  adds them is live — HomeTab falls back to client-side counts. */
  rsvpsLastMonth?: number;
  plansThisMonth?: number;
  plansLastMonth?: number;
  newFollowersThisMonth?: number;
  newFollowersLastMonth?: number;
  planIdeaCount: number;
  upcomingPlanCount: number;
  followerCount: number;
  members: {
    membershipId: string | null;
    objectId: string | null;
    name: string;
    email: string | null;
    status: string;
    leafAppConnected?: boolean;
    joinedAt: string;
    pending?: boolean;
    scope?: {
      allCalendars: boolean;
      calendars: { id: string; name: string }[];
      membershipIds: string[];
    };
  }[];
  followers: {
    membershipId: string;
    objectId: string | null;
    name: string;
    phone: string | null;
    calendarId: string | null;
    calendarName: string | null;
    joinedAt: string;
  }[];
  rsvps: {
    objectId: string;
    eventGroupId: string | null;
    /** The calendar the plan sits on. Optional until the getOrgDashboard
     *  deploy that adds it is live — without it, counts fall back to org-wide. */
    calendarId?: string | null;
    name: string;
    phone: string | null;
    planTitle: string;
    /** When the RSVP was created — mostly mirrors when links were sent. */
    date: string;
    /** The plan's event date — the anchor for any "best day" claim.
     *  Optional until the getOrgDashboard deploy that adds it is live. */
    planDate?: string | null;
    source: string;
  }[];
  /** How far back `rsvps` reaches, in days — every per-person tally on the
   *  dashboard is bounded by it. Optional until the getOrgDashboard deploy
   *  that sends it is live; see RSVP_WINDOW_FALLBACK_DAYS. */
  rsvpWindowDays?: number;
  pendingFollowerCount: number;
  pendingFollowers: {
    membershipId: string;
    objectId: string | null;
    name: string;
    phone: string | null;
    calendarId: string | null;
    calendarName: string | null;
    requestedAt: string;
  }[];
  calendars: OrgDashboardCalendar[];
  calendarLimit: number | null;
  hostRequests: {
    planId: string;
    title: string;
    description: string;
    image: string | null;
    calendarName: string | null;
    calendarId: string | null;
    requesterName: string;
    requesterPhone: string | null;
    requestedDate: string | null;
    requestedNote: string | null;
    requestedVenue: { name: string; address: string; placeId?: string | null } | null;
    requestedCapacity: number | null;
    requestedRequireApproval: boolean;
    requestedAt: string | null;
  }[];
  pendingRsvpRequests: {
    notificationId: string;
    eventGroupId: string | null;
    name: string;
    phone: string | null;
    planTitle: string;
    planImage: string | null;
    rsvpNote: string | null;
    requestedAt: string;
  }[];
  recentPhotos: {
    objectId: string;
    url: string | null;
    uploadedAt: string;
    uploaderName: string;
    eventGroupId: string | null;
    eventTitle: string;
  }[];
}

export type DashboardTab =
  | "home"
  | "calendars"
  | "community"
  | "grow"
  | "inbox"
  | "settings";

export type GrowSection = "performance" | "marketplace" | "collabs" | "concierge";


/** How a follower-facing text should identify the sender: the specific
 *  calendar the person follows — which is also what the link in the text
 *  opens — falling back to the org name when the calendar is the org itself,
 *  can't be resolved, or a bulk send spans several calendars.
 *
 *  Signing with the org name regardless is wrong whenever an org's own name is
 *  an artifact ("Shawn's NYC Summer Happy Hour") while the child calendar is
 *  the identity people actually recognize ("11 Hoyt Hangouts") — the recipient
 *  would be greeted by one name and land on another. */
export function senderNameFor(
  dashboard: Pick<OrgDashboard, "name" | "calendars">,
  calendarId: string | null,
): string {
  const cal = calendarId
    ? dashboard.calendars.find((c) => c.objectId === calendarId)
    : null;
  if (cal && !cal.isPrimary && cal.name) return cal.name;
  return dashboard.name;
}

/** Day label for a plan inside a text message: always weekday AND date
 *  ("Saturday, Aug 30"). A bare weekday reads as "this coming Saturday" no
 *  matter how far out the plan actually is, which is exactly the ambiguity a
 *  recipient can't resolve. Formatted in the venue's timezone when known —
 *  the venue's wall clock is the source of truth for when a plan happens. */
export function formatPlanDay(
  dateISO: string | null | undefined,
  timezone?: string | null,
): string {
  if (!dateISO) return "";
  try {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "long",
      month: "short",
      day: "numeric",
    };
    if (timezone) opts.timeZone = timezone;
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(dateISO));
  } catch {
    return "";
  }
}

/** Shortest safe form of a plan/idea title for interpolation into a sentence.
 *  Titles carry stray whitespace often enough that "X  on Saturday" shows up
 *  in real drafts. */
export function tidyTitle(title: string | null | undefined): string {
  return String(title || "").replace(/\s+/g, " ").trim();
}

/** Mirrors PLAN_WINDOW_MS in getOrgDashboard. Only used until the deploy that
 *  sends `rsvpWindowDays` is live — read the payload value, not this. */
export const RSVP_WINDOW_FALLBACK_DAYS = 90;

export function rsvpWindowDays(dashboard: {
  rsvpWindowDays?: number;
}): number {
  return dashboard.rsvpWindowDays || RSVP_WINDOW_FALLBACK_DAYS;
}

/** "the last 90 days" — the qualifier every RSVP tally on the dashboard needs.
 *  The window is anchored on plan date and has no upper bound, so it also
 *  sweeps in upcoming plans; "last N days" is the honest short form because
 *  what it rules out is older history, which is what a reader would otherwise
 *  assume is included. */
export function rsvpWindowLabel(dashboard: { rsvpWindowDays?: number }): string {
  return `the last ${rsvpWindowDays(dashboard)} days`;
}

/** Per-person RSVP tallies, keyed by phone number (preferred) or lowercased
 *  name. Powers the "Never RSVP'd" segments on Home, Community and Grow.
 *
 *  Tallied two ways because the dashboard is org-scoped: `byCalendar` answers
 *  "how many times has this person RSVP'd to THIS calendar" — what a follower
 *  row needs, since a follower belongs to one calendar — while `all` answers
 *  it org-wide, which is the right frame for members, who have access across
 *  calendars. Sets, not counters: one person can only attend a plan once, so
 *  the twin Accepted rows the joinOpenInvite race leaves behind must not
 *  double-count. */
export interface RsvpCountIndex {
  all: Map<string, Set<string>>;
  byCalendar: Map<string, Set<string>>;
  /** False until the getOrgDashboard deploy that stamps `calendarId` on RSVP
   *  rows is live. Calendar-scoped lookups fall back to the org-wide tally
   *  while it is false — otherwise every follower would score 0 and the whole
   *  community would land in "Never RSVP'd". */
  hasCalendarIds: boolean;
}

const CAL_KEY_SEP = " ";

export function buildRsvpCountIndex(
  rsvps: OrgDashboard["rsvps"],
): RsvpCountIndex {
  const all = new Map<string, Set<string>>();
  const byCalendar = new Map<string, Set<string>>();
  let hasCalendarIds = false;
  const add = (map: Map<string, Set<string>>, key: string, plan: string) => {
    const set = map.get(key);
    if (set) set.add(plan);
    else map.set(key, new Set([plan]));
  };
  for (const r of rsvps) {
    const key = r.phone || r.name.trim().toLowerCase();
    if (!key) continue;
    // Fall back to the row id so an RSVP with no plan pointer still counts
    // once rather than collapsing every such row into a single tally.
    const plan = r.eventGroupId || r.objectId;
    add(all, key, plan);
    if (r.calendarId) {
      hasCalendarIds = true;
      add(byCalendar, `${r.calendarId}${CAL_KEY_SEP}${key}`, plan);
    }
  }
  return { all, byCalendar, hasCalendarIds };
}

/** Pass `calendarId` to scope the tally to one calendar (follower rows);
 *  omit it for an org-wide tally (members, who span calendars). */
export function rsvpCountForPerson(
  index: RsvpCountIndex,
  person: { phone?: string | null; name: string },
  calendarId?: string | null,
): number {
  const scoped = Boolean(calendarId) && index.hasCalendarIds;
  const map = scoped ? index.byCalendar : index.all;
  const prefix = scoped ? `${calendarId}${CAL_KEY_SEP}` : "";
  // Phone is the trustworthy key; fall through to name when this person has
  // no phone on file, or none of their rows carried one.
  if (person.phone) {
    const byPhone = map.get(`${prefix}${person.phone}`);
    if (byPhone) return byPhone.size;
  }
  return map.get(`${prefix}${person.name.trim().toLowerCase()}`)?.size || 0;
}
