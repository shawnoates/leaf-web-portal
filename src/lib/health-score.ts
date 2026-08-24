import type { OrgDashboard } from "@/components/dashboard/types";

// Community health — one 0–100 number for "how alive is this community",
// built from six pillars. Principles it encodes: engagement over follower
// count (followers are only ever a rate denominator), breadth over
// concentration, rates over counts so a small calendar isn't punished for
// being small, and — the load-bearing one — when attendance data doesn't
// exist, follow-through's weight RENORMALIZES across the other pillars rather
// than scoring zero. A gap we can't fill yet must never make the number lie.

export type HealthBand =
  | "thriving"
  | "healthy"
  | "attention"
  | "at-risk"
  | "warming-up";

export interface HealthScorePillars {
  participation: number;
  retention: number;
  breadth: number;
  activity: number;
  /** null until per-plan host identity is on the payload — renormalizes. */
  memberLed: number | null;
  /** null when no attendance data exists — triggers renormalization. */
  followThrough: number | null;
}

export interface HealthScoreResult {
  score: number;
  /** Δ points vs 30 days ago, or null with no comparable baseline. */
  trend: number | null;
  band: HealthBand;
  pillars: HealthScorePillars;
  hasAttendanceData: boolean;
}

/** Pillar weights. Config values on purpose: when reliable attendance
 *  collection ships (check-in, host "who came?" prompt, QR), raise
 *  followThrough toward 0.20–0.25 and every calendar rescores — no code
 *  change. The others are scaled down proportionally at that point. */
export const PILLAR_WEIGHTS = {
  participation: 0.28,
  retention: 0.22,
  breadth: 0.18,
  activity: 0.17,
  memberLed: 0.1,
  followThrough: 0.05,
} as const;

/** Targets a pillar is normalized against — hitting the target scores 100. */
const TARGETS = {
  /** Share of reach that participates at all in the window. */
  participationRate: 0.3,
  /** Share of active people who showed up for ≥2 plans. */
  repeatRate: 0.4,
  /** Share of RSVPs coming from the top decile. At or below this = 100. */
  topDecileShare: 0.25,
  /** Plans per month. */
  plansPerMonth: 4,
  /** Share of plans hosted by someone other than the owner. */
  memberLedRate: 0.3,
  /** Distinct non-owner hosts. Three different people hosting scores 100 —
   *  the point is that hosting isn't one deputy, it's a bench. */
  distinctHosts: 3,
  /** Attendance ÷ RSVP. */
  attendanceRate: 0.8,
} as const;

const clamp100 = (n: number) => Math.max(0, Math.min(100, n));

/** A person key that survives the fact that RSVPs carry either a phone or
 *  just a name. Phone wins when present — the same person RSVPing by phone
 *  and by name would otherwise count twice and inflate breadth. */
function personKey(p: { phone?: string | null; name: string }): string | null {
  if (p.phone) return p.phone;
  const name = p.name?.trim().toLowerCase();
  return name || null;
}

type Rsvp = OrgDashboard["rsvps"][number];

function rsvpCountsByPerson(rsvps: Rsvp[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rsvps) {
    const key = personKey(r);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

/** Participation — unique people who engaged, over reach. Reach is the
 *  follower base; followers appear here ONLY as a denominator, never as a
 *  score in their own right. */
function participationPillar(rsvps: Rsvp[], reach: number): number {
  if (reach <= 0) return 0;
  const engaged = rsvpCountsByPerson(rsvps).size;
  return clamp100((engaged / reach / TARGETS.participationRate) * 100);
}

/** Retention — of the people who engaged at all, how many came back. */
function retentionPillar(rsvps: Rsvp[]): number {
  const counts = rsvpCountsByPerson(rsvps);
  if (counts.size === 0) return 0;
  const repeat = Array.from(counts.values()).filter((c) => c >= 2).length;
  return clamp100((repeat / counts.size / TARGETS.repeatRate) * 100);
}

/** Breadth — participation spread, measured as how much of the RSVP volume
 *  the top decile accounts for. Lower concentration is healthier. This is
 *  spread ONLY; it is never any kind of demographic inference. */
function breadthPillar(rsvps: Rsvp[]): number {
  const counts = rsvpCountsByPerson(rsvps);
  if (counts.size === 0) return 0;

  const sorted = Array.from(counts.values()).sort((a, b) => b - a);
  const total = sorted.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  const topDecileSize = Math.max(1, Math.ceil(sorted.length * 0.1));
  const topShare =
    sorted.slice(0, topDecileSize).reduce((a, b) => a + b, 0) / total;

  // With few enough people the top decile is one person and their share is
  // mechanically huge — that's small-sample noise, not concentration.
  if (counts.size < 5) return 50;

  if (topShare <= TARGETS.topDecileShare) return 100;
  // Degrade from 100 at target down to 0 when the top decile owns everything.
  const excess =
    (topShare - TARGETS.topDecileShare) / (1 - TARGETS.topDecileShare);
  return clamp100((1 - excess) * 100);
}

/** Activity — is anything actually on the calendar. */
function activityPillar(plansPerMonth: number): number {
  return clamp100((plansPerMonth / TARGETS.plansPerMonth) * 100);
}

/** Member-led — two halves, weighted evenly: what SHARE of plans a non-owner
 *  runs, and how MANY different people those are. Share alone can't tell a
 *  community where hosting has spread from one where a single deputy runs
 *  everything, and the second is a bus-factor-of-one dressed up as health. */
function memberLedPillar(
  input: { memberLedRate: number; distinctHosts: number } | null,
): number | null {
  if (input == null) return null;
  const share = clamp100((input.memberLedRate / TARGETS.memberLedRate) * 100);
  const diversity = clamp100(
    (input.distinctHosts / TARGETS.distinctHosts) * 100,
  );
  return share * 0.5 + diversity * 0.5;
}

/** Who is hosting, across the plans we can see. Leaf-hosted and virtual-host
 *  plans are excluded from both halves — neither is the community hosting
 *  itself, and counting them would let a calendar look member-led purely
 *  because Leaf is filling its gaps. */
export function hostMixFor(
  plans: { hostName: string; isVirtualHost?: boolean; leafHostState?: string | null }[],
  ownerNames: string[],
): { memberLedRate: number; distinctHosts: number } | null {
  const ownerSet = new Set(
    ownerNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
  );

  const communityHosted = plans.filter(
    (p) => !p.isVirtualHost && !p.leafHostState,
  );
  // Too small a sample to make a claim about how hosting is distributed.
  if (communityHosted.length < 3) return null;

  const nonOwnerHosts = new Set<string>();
  let nonOwnerPlans = 0;
  for (const p of communityHosted) {
    const host = p.hostName?.trim().toLowerCase();
    if (!host || ownerSet.has(host)) continue;
    nonOwnerPlans++;
    nonOwnerHosts.add(host);
  }

  return {
    memberLedRate: nonOwnerPlans / communityHosted.length,
    distinctHosts: nonOwnerHosts.size,
  };
}

export function bandFor(score: number): Exclude<HealthBand, "warming-up"> {
  if (score >= 80) return "thriving";
  if (score >= 60) return "healthy";
  if (score >= 40) return "attention";
  return "at-risk";
}

/** Weighted sum of the pillars that have data. Pillars scoring null are
 *  dropped and their weight is redistributed across the rest. */
function combine(pillars: HealthScorePillars): number {
  const entries: [number | null, number][] = [
    [pillars.participation, PILLAR_WEIGHTS.participation],
    [pillars.retention, PILLAR_WEIGHTS.retention],
    [pillars.breadth, PILLAR_WEIGHTS.breadth],
    [pillars.activity, PILLAR_WEIGHTS.activity],
    [pillars.memberLed, PILLAR_WEIGHTS.memberLed],
    [pillars.followThrough, PILLAR_WEIGHTS.followThrough],
  ];

  const available = entries.filter(
    (e): e is [number, number] => e[0] != null,
  );
  const availableWeight = available.reduce((sum, [, w]) => sum + w, 0);
  if (availableWeight === 0) return 0;
  const weighted = available.reduce((sum, [v, w]) => sum + v * w, 0);
  return weighted / availableWeight;
}

interface Snapshot {
  rsvps: Rsvp[];
  reach: number;
  plansPerMonth: number;
  hostMix: { memberLedRate: number; distinctHosts: number } | null;
  attendanceRate: number | null;
}

function pillarsFor(snapshot: Snapshot): HealthScorePillars {
  return {
    participation: participationPillar(snapshot.rsvps, snapshot.reach),
    retention: retentionPillar(snapshot.rsvps),
    breadth: breadthPillar(snapshot.rsvps),
    activity: activityPillar(snapshot.plansPerMonth),
    memberLed: memberLedPillar(snapshot.hostMix),
    followThrough:
      snapshot.attendanceRate == null
        ? null
        : clamp100(
            (snapshot.attendanceRate / TARGETS.attendanceRate) * 100,
          ),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum signal before a score means anything. Below this the calendar is
 *  "warming up" — it gets a faint arc and no number, never a scary low score
 *  that reads as a verdict on a community that hasn't started yet. */
const MIN_RSVPS_FOR_SCORE = 5;

export function calculateHealthScore(
  dashboard: OrgDashboard,
): HealthScoreResult {
  const now = Date.now();
  const windowStart = now - 90 * DAY_MS;
  const priorWindowStart = now - 120 * DAY_MS;
  const priorWindowEnd = now - 30 * DAY_MS;

  const rsvpTime = (r: Rsvp) => {
    const t = new Date(r.date).getTime();
    return isNaN(t) ? null : t;
  };

  const currentRsvps = dashboard.rsvps.filter((r) => {
    const t = rsvpTime(r);
    return t != null && t >= windowStart;
  });

  const reach = Math.max(dashboard.followerCount, dashboard.followers.length);

  // Attendance is not collected reliably yet, so follow-through has no data
  // and renormalizes away. RSVP depth (repeat RSVPs, breadth of distinct
  // RSVPers) carries the commitment signal in the meantime.
  const attendanceRate: number | null = null;

  // Host mix comes from upcoming plans — the only ones carrying host identity
  // on this payload. That makes it forward-looking rather than a 90-day
  // history, and it renormalizes away entirely when there are too few plans
  // to say anything about how hosting is distributed.
  const hostMix = hostMixFor(
    dashboard.calendars.flatMap((c) => c.activePlans ?? []),
    [dashboard.name, ...dashboard.calendars.map((c) => c.name)],
  );

  const pillars = pillarsFor({
    rsvps: currentRsvps,
    reach,
    plansPerMonth: dashboard.plansThisMonth ?? 0,
    hostMix,
    attendanceRate,
  });

  const score = Math.round(combine(pillars));

  // Prior score, rewound 30 days: the same pillars over the RSVP window as it
  // stood then. Activity uses last month's plan count. Only produced when
  // both windows carry enough RSVPs for the comparison to mean anything.
  const priorRsvps = dashboard.rsvps.filter((r) => {
    const t = rsvpTime(r);
    return t != null && t >= priorWindowStart && t < priorWindowEnd;
  });

  let trend: number | null = null;
  if (
    currentRsvps.length >= MIN_RSVPS_FOR_SCORE &&
    priorRsvps.length >= MIN_RSVPS_FOR_SCORE &&
    dashboard.plansLastMonth != null
  ) {
    const priorScore = Math.round(
      combine(
        pillarsFor({
          rsvps: priorRsvps,
          reach,
          plansPerMonth: dashboard.plansLastMonth,
          // Host mix can't be rewound — upcoming plans are the only ones
          // carrying host identity — so it's held constant and contributes
          // nothing to the delta rather than inventing a prior value.
          hostMix,
          attendanceRate,
        }),
      ),
    );
    trend = score - priorScore;
  }

  const band: HealthBand =
    currentRsvps.length < MIN_RSVPS_FOR_SCORE ? "warming-up" : bandFor(score);

  return {
    score,
    trend,
    band,
    pillars,
    hasAttendanceData: pillars.followThrough != null,
  };
}

/** Owner-facing labels soften the bottom band — an owner reading "At risk"
 *  on a calendar they just started reads it as a verdict. Admin keeps the
 *  blunt label, because it drives outreach and the monetization gate. */
export function getBandLabel(band: HealthBand, isAdmin = false): string {
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
