import type { OrgDashboard } from "@/components/dashboard/types";

export interface HealthScorePillars {
  participation: number;
  retention: number;
  breadth: number;
  activity: number;
  memberLed: number;
  followThrough: number | null;
}

export interface HealthScoreResult {
  score: number;
  trend: number | null; // Delta vs 30 days ago
  band: "thriving" | "healthy" | "attention" | "at-risk" | "warming-up";
  pillars: HealthScorePillars;
  hasAttendanceData: boolean;
}

// Config-driven targets for normalization
const TARGETS = {
  participation: 0.3, // 30% of reach
  retention: 0.4, // 40% active on ≥2 plans
  breadth: 0.1, // Top 10% should have ≤10% of total RSVPs
  activity: 0.5, // 50% of target cadence
  memberLed: 0.3, // 30% of plans by non-owners
  followThrough: 0.8, // 80% attendance rate
};

/** Participation: unique RSVP/interest/reaction ÷ reach */
function calculateParticipation(
  rsvps: OrgDashboard["rsvps"],
  members: OrgDashboard["members"],
): number {
  if (members.length === 0) return 0;
  // Unique RSVP'd members
  const rsvpedMembers = new Set<string>();
  for (const r of rsvps) {
    if (r.phone || r.name) {
      rsvpedMembers.add(r.phone || r.name.toLowerCase());
    }
  }
  const reach = members.length;
  const participation = rsvpedMembers.size / reach;
  // Normalize to 0-100 against target
  return Math.min(100, (participation / TARGETS.participation) * 100);
}

/** Retention: % active on ≥2 plans in 90 days */
function calculateRetention(rsvps: OrgDashboard["rsvps"]): number {
  if (rsvps.length === 0) return 0;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentRsvps = rsvps.filter((r) => new Date(r.date) >= ninetyDaysAgo);

  const personRsvpCount = new Map<string, number>();
  for (const r of recentRsvps) {
    const key = r.phone || r.name.toLowerCase();
    personRsvpCount.set(key, (personRsvpCount.get(key) || 0) + 1);
  }

  // Count people with ≥2 RSVPs
  const repeatRsvpers = Array.from(personRsvpCount.values()).filter(
    (count) => count >= 2,
  ).length;

  const retention = personRsvpCount.size > 0 ? repeatRsvpers / personRsvpCount.size : 0;
  return Math.min(100, (retention / TARGETS.retention) * 100);
}

/** Breadth: concentration from top ~10% should be lower */
function calculateBreadth(rsvps: OrgDashboard["rsvps"]): number {
  if (rsvps.length === 0) return 100;

  const personRsvpCount = new Map<string, number>();
  for (const r of rsvps) {
    const key = r.phone || r.name.toLowerCase();
    personRsvpCount.set(key, (personRsvpCount.get(key) || 0) + 1);
  }

  const sorted = Array.from(personRsvpCount.values()).sort((a, b) => b - a);
  const topTenPercent = Math.max(1, Math.ceil(sorted.length * 0.1));
  const topShare = sorted
    .slice(0, topTenPercent)
    .reduce((sum, count) => sum + count, 0);

  const totalRsvps = rsvps.length;
  const concentration = totalRsvps > 0 ? topShare / totalRsvps : 0;

  // Lower concentration is better — invert: (1 - concentration)
  // Normalize so that target 10% (0.1) = 100
  const breadth = 1 - concentration;
  return Math.min(100, (breadth / (1 - TARGETS.breadth)) * 100);
}

/** Activity: based on upcoming plans and recent plan count */
function calculateActivity(plans: number, recentRsvpCount: number): number {
  // Simple heuristic: upcoming plans + recent activity level
  // Target = 0.5 = 50% of some baseline (12 plans/year = 1/mo)
  const monthlyRate = Math.max(plans / 1, recentRsvpCount / 30); // Activity per month
  const activity = Math.min(monthlyRate, TARGETS.activity * 2); // Cap at 2x target
  return Math.min(100, (activity / TARGETS.activity) * 100);
}

/** Member-led: % of plans by non-owners. For now, estimate from diversity */
function calculateMemberLed(followers: OrgDashboard["followers"]): number {
  // Proxy: diversity of followers = higher member engagement potential
  // This would ideally come from plan host data (not in this payload)
  // For now, use follower count as proxy: more followers = more potential member-led plans
  const followerCount = followers.length;
  const target = 10; // Target 10+ followers for good engagement
  const memberLed = Math.min(followerCount / target, 1);
  return Math.min(100, (memberLed / (TARGETS.memberLed / 0.5)) * 100);
}

/** Follow-through: attendance ÷ RSVP. Returns null when no data */
function calculateFollowThrough(): number | null {
  // This would come from attendance data which is not yet reliably available
  // Return null to trigger renormalization
  return null;
}

/** Calculate pillars and overall health score */
export function calculateHealthScore(
  dashboard: OrgDashboard,
  previousMonthData?: { rsvpCount: number; followerCount: number },
): HealthScoreResult {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get RSVPs from last 30 days
  const recentRsvps = dashboard.rsvps.filter(
    (r) => new Date(r.date) >= thirtyDaysAgo,
  );

  const pillars: HealthScorePillars = {
    participation: calculateParticipation(dashboard.rsvps, dashboard.members),
    retention: calculateRetention(dashboard.rsvps),
    breadth: calculateBreadth(dashboard.rsvps),
    activity: calculateActivity(
      dashboard.upcomingPlanCount,
      recentRsvps.length,
    ),
    memberLed: calculateMemberLed(dashboard.followers),
    followThrough: calculateFollowThrough(),
  };

  // Renormalize if no follow-through data
  const hasAttendanceData = pillars.followThrough !== null;
  const baselineWeights = {
    participation: 0.28,
    retention: 0.22,
    breadth: 0.18,
    activity: 0.17,
    memberLed: 0.1,
    followThrough: 0.05,
  };

  let score: number;

  if (hasAttendanceData) {
    score =
      pillars.participation * baselineWeights.participation +
      pillars.retention * baselineWeights.retention +
      pillars.breadth * baselineWeights.breadth +
      pillars.activity * baselineWeights.activity +
      pillars.memberLed * baselineWeights.memberLed +
      (pillars.followThrough || 0) * baselineWeights.followThrough;
  } else {
    // Follow-through's weight renormalizes across the pillars we do have, so a
    // calendar with no attendance data is never penalized for the gap.
    const weighted =
      pillars.participation * baselineWeights.participation +
      pillars.retention * baselineWeights.retention +
      pillars.breadth * baselineWeights.breadth +
      pillars.activity * baselineWeights.activity +
      pillars.memberLed * baselineWeights.memberLed;
    const availableWeight = 1 - baselineWeights.followThrough;
    score = weighted / availableWeight;
  }

  score = Math.round(score);

  // Determine band
  let band: "thriving" | "healthy" | "attention" | "at-risk" | "warming-up";
  const minDataThreshold = 5; // Minimum of 5 data points to stop warning-up

  if (dashboard.rsvps.length < minDataThreshold && dashboard.followers.length < minDataThreshold) {
    band = "warming-up";
    score = Math.round(Math.min(score, 70)); // Cap score during warming-up
  } else if (score >= 80) {
    band = "thriving";
  } else if (score >= 60) {
    band = "healthy";
  } else if (score >= 40) {
    band = "attention";
  } else {
    band = "at-risk";
  }

  // Calculate trend (delta vs 30 days ago)
  let trend: number | null = null;
  if (previousMonthData) {
    const previousMonthScore = Math.round(
      (previousMonthData.rsvpCount / Math.max(1, previousMonthData.followerCount)) * 100,
    );
    trend = score - previousMonthScore;
  }

  return {
    score,
    trend,
    band,
    pillars,
    hasAttendanceData,
  };
}

export function getBandLabel(
  band: "thriving" | "healthy" | "attention" | "at-risk" | "warming-up",
  isAdmin: boolean = false,
): string {
  switch (band) {
    case "thriving":
      return "Thriving";
    case "healthy":
      return "Healthy";
    case "attention":
      return "Needs attention";
    case "at-risk":
      return isAdmin ? "At risk" : "Getting started";
    case "warming-up":
      return "Warming up";
  }
}
