// Shape returned by the `getOrgAnalytics` cloud function.
//
// Lives in its own module (rather than in the dashboard page or in
// AnalyticsTab.tsx) so the page can hold `OrgAnalytics` state without importing
// anything from the lazily-loaded analytics chunk. A type-only import would be
// erased anyway, but keeping the boundary explicit means nobody accidentally
// re-couples the page to recharts by adding a value export to the same file.

export interface AnalyticsSeriesPoint {
  date: string;
  value: number;
}

export interface OrgAnalytics {
  range: string;
  generatedAt: string;
  growth: {
    followerCount: number;
    followersInRange: number;
    followerDeltaPct: number;
    memberCount: number;
    membersInRange: number;
    rsvpsInRange: number;
    rsvpDeltaPct: number;
    pageViewCount: number;
    pageViewsInRange: number;
    pageViewDeltaPct: number;
    followerSeries: AnalyticsSeriesPoint[];
    rsvpSeries: AnalyticsSeriesPoint[];
    pageViewSeries: AnalyticsSeriesPoint[];
  };
  engagement: {
    rsvpCount: number;
    planCount: number;
    rsvpRate: number;
    attendanceCount: number;
    attendanceRate: number;
    repeatAttendeeCount: number;
    uniqueRsvpUsersInRange: number;
    repeatRate: number;
    topPlans: { id: string; title: string; category: string; rsvpCount: number }[];
  };
  whatsWorking: {
    weekdayDistribution: { day: string; value: number }[];
    timeOfDayDistribution: { bucket: string; value: number }[];
    topCategories: { category: string; plans: number; rsvps: number }[];
    leadTimeDistribution?: { bucket: string; label: string; plans: number; rsvps: number; avgRsvps: number }[];
    rsvpArrival?: { sampleSize: number; medianLeadDays: number; withinTwoDaysPct: number } | null;
  };
  insights: {
    type: string;
    message: string;
    actionLabel?: string;
    actionDayIndex?: number;
    actionTimeBucket?: string;
    actionLeadBucket?: string;
  }[];
}

export type AnalyticsRange = "7d" | "30d" | "90d" | "all";
