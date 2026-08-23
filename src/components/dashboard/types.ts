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
  /** Host candidate for most-urgent idea needing a host (if hidePlanIdeas && ideas exist). */
  host_candidate?: {
    idea: { objectId: string; title: string };
    candidate_user: { name: string; phone: string | null };
    reason: string;
  };
  /** Re-engagement target: upcoming plan + never-RSVP'd follower to invite. */
  reengagement?: {
    plan: { objectId: string; title: string; date: string };
    target_user: { name: string; phone: string | null };
    draft_message: string;
  };
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


/** Per-person RSVP counts, keyed by phone number (preferred) or lowercased
 *  name. Powers the "Never RSVP'd" segments on Home, Community and Grow. */
export function buildRsvpCountIndex(
  rsvps: OrgDashboard["rsvps"],
): Map<string, number> {
  const index = new Map<string, number>();
  for (const r of rsvps) {
    const key = r.phone || r.name.trim().toLowerCase();
    if (!key) continue;
    index.set(key, (index.get(key) || 0) + 1);
  }
  return index;
}

export function rsvpCountForPerson(
  index: Map<string, number>,
  person: { phone?: string | null; name: string },
): number {
  if (person.phone && index.has(person.phone)) return index.get(person.phone)!;
  const nameKey = person.name.trim().toLowerCase();
  return index.get(nameKey) || 0;
}
