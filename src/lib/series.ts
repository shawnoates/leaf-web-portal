// Series hosts — shared shapes and small helpers for the dashboard (Community
// tab sheet, Plans rows, Create-plan Repeats) and the no-login /series host
// page. `SeriesSummary` is what the server's serializeSeries (cloud/series-host.js)
// returns; keep the two in step.

export type SeriesRule = {
  freq: "monthly" | "monthlyNthWeekday" | "hostPicks" | "weekly" | "biweekly" | null;
  dayOfMonth: number | null;
  nth: number | null;
  weekday: number | null;
  wallTime: string;
  timeZone: string;
  label: string | null;
};

export type SeriesProposal = {
  proposedAt: string | null;
  wallClock: string | null;
  whenLabel: string | null;
  monthLabel: string | null;
  finalAt: string | null;
  skipAt: string | null;
  skipDateLabel: string | null;
};

export type SeriesOccurrence = {
  id: string;
  startsAt: string;
  wallClock: string;
  whenLabel: string;
  rsvps: number;
  capacity: number | null;
  shareUrl: string;
  attendeeFirstNames?: string[];
};

export type SeriesSummary = {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  calendarId: string | null;
  calendarName: string;
  rule: SeriesRule;
  venue: { id: string; name: string | null; address: string | null } | null;
  capacity: number | null;
  requireApproval: boolean;
  hideVenueUntilRsvp: boolean;
  hostManaged: boolean;
  hostStatus: "invited" | "accepted" | "declined" | null;
  setupStatus: "complete" | "needsDetails" | null;
  pausedReason: "noHost" | "repeatedSkips" | "hostDeclined" | null;
  invitedFrom: "plans" | "community" | null;
  inviteNote: string | null;
  isActive: boolean;
  endedBy: "host" | "owner" | null;
  host: { id: string; name: string; firstName: string } | null;
  ownerFirstName: string;
  hostPhoneHint?: string;
  hostInvitedAt: string | null;
  hostAcceptedAt: string | null;
  proposal: SeriesProposal | null;
  nextRuleAt: string | null;
  cycleOpensAt: string | null;
  consecutiveSkips: number;
  skippedCycles: { ruleAt: string | null; skippedAt: string | null; monthLabel: string | null }[];
  upcoming: { ruleAt: string; label: string; skipped: boolean }[];
  nextOccurrence: SeriesOccurrence | null;
  occurrencesMaterialized: number;
  setupDraft?: Record<string, unknown> | null;
  minWallClock: string;
  maxWallClock: string;
};

/** Parse.Error code the server throws when a Starter calendar is at its series-host limit. */
export const SERIES_HOST_LIMIT_CODE = 9031;

export function isSeriesLimitError(e: unknown): e is { code: number; message: string } {
  return typeof e === "object" && e !== null && (e as { code?: number }).code === SERIES_HOST_LIMIT_CODE;
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const NTH_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "last" };

export function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

export type RuleOption = {
  key: "weekly" | "biweekly" | "monthlyDay" | "monthlyNth" | "monthlyLast" | "hostPicks";
  label: string;
  freq: "weekly" | "biweekly" | "monthly" | "monthlyNthWeekday" | "hostPicks";
  dayOfMonth?: number;
  nth?: number;
  weekday?: number;
};

/**
 * Repeat rules a chosen first date supports, labelled from that date —
 * mirrors ruleOptionsForDate in cloud/series-schedule.js. `ymd` is "YYYY-MM-DD".
 */
export function monthlyRuleOptionsForDate(ymd: string): RuleOption[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return [];
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
  const nth = Math.floor((day - 1) / 7) + 1;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const out: RuleOption[] = [{ key: "monthlyDay", label: `Monthly on the ${ordinal(day)}`, freq: "monthly", dayOfMonth: day }];
  if (nth <= 4) {
    out.push({ key: "monthlyNth", label: `Monthly on the ${NTH_LABELS[nth]} ${WEEKDAY_NAMES[weekday]}`, freq: "monthlyNthWeekday", nth, weekday });
  }
  if (day > daysInMonth - 7) {
    out.push({ key: "monthlyLast", label: `Monthly on the last ${WEEKDAY_NAMES[weekday]}`, freq: "monthlyNthWeekday", nth: -1, weekday });
  }
  return out;
}

export function ruleLabel(rule: Pick<SeriesRule, "freq" | "nth" | "weekday" | "dayOfMonth">): string {
  if (rule.freq === "hostPicks") return "host picks each date";
  if (rule.freq === "monthlyNthWeekday" && rule.nth != null && rule.weekday != null) {
    return `${NTH_LABELS[rule.nth]} ${WEEKDAY_NAMES[rule.weekday]} monthly`;
  }
  if (rule.freq === "monthly") return rule.dayOfMonth ? `the ${ordinal(rule.dayOfMonth)} monthly` : "monthly";
  if (rule.freq === "weekly") return "weekly";
  if (rule.freq === "biweekly") return "every other week";
  return "";
}

export const PAUSED_REASON_LABEL: Record<string, string> = {
  noHost: "no host",
  repeatedSkips: "no reply",
  hostDeclined: "declined",
};

const SKIP_CHIP_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;

/** Dashboard status chip for a host-managed series. */
export function seriesStatusChip(s: SeriesSummary): { label: string; tone: "zinc" | "amber" | "green" | "red" } {
  if (!s.isActive) return { label: "Ended", tone: "zinc" };
  if (s.pausedReason) return { label: `Paused: ${PAUSED_REASON_LABEL[s.pausedReason] || s.pausedReason}`, tone: "red" };
  if (s.hostStatus === "invited") return { label: "Invite sent", tone: "zinc" };
  if (s.hostStatus === "accepted" && s.setupStatus === "needsDetails") return { label: "Setting up", tone: "zinc" };
  if (s.proposal) {
    return { label: s.proposal.monthLabel ? `Waiting on ${s.proposal.monthLabel} date` : "Waiting on a date", tone: "amber" };
  }
  const lastSkip = s.skippedCycles[s.skippedCycles.length - 1];
  if (
    !s.nextOccurrence &&
    lastSkip?.skippedAt &&
    Date.now() - new Date(lastSkip.skippedAt).getTime() < SKIP_CHIP_WINDOW_MS
  ) {
    return { label: lastSkip.monthLabel ? `Skipped ${lastSkip.monthLabel}` : "Skipped a cycle", tone: "amber" };
  }
  return { label: "Active", tone: "green" };
}

/** True while the series occupies a Starter calendar's single series-host slot. */
export function seriesCountsTowardLimit(s: SeriesSummary): boolean {
  return s.hostManaged && s.isActive && !s.pausedReason && (s.hostStatus === "invited" || s.hostStatus === "accepted");
}
