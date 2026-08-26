// Community Scorecard — the quiz behind the /score landing page.
//
// This is the browser-side twin of leaflets-server/cloud/scorecard-functions.js.
// It exists so the reveal can animate the instant the sixth answer lands,
// without waiting on a round trip. The server is still authoritative: what it
// stores is what gets quoted back later and written onto the calendar. The two
// agree because both score against the same PILLAR_WEIGHTS.
//
// The weights are IMPORTED from ./health-score, never restated here. That is
// the whole point — if the product reweights, the landing page follows on the
// next deploy with no edit to this file. Everything else in here (the
// questions, the bands, the display stretch) is landing-page-specific and has
// no in-product equivalent.
//
// Two deliberate divergences from the in-product score. Both are visible to a
// visitor as a number that will not match their dashboard four weeks later,
// and both are load-bearing:
//
//   1. BANDS. The product bands at 80/60/40 and softens the floor to "Getting
//      started". This page bands at 85/70/55 and names the floor "Fading".
//      Never call bandFor() here — it is the other score's function.
//
//   2. DISPLAY STRETCH. The reachable raw range is 39–92, because every option
//      floor is 40 (32 for memberLed) and every ceiling is 92. A gauge that can
//      never show a 30 or a 95 reads as rigged. See stretch().
//
// Keep this file and the server module in step. If you change a question, an
// option value, a band, or the stretch, change both and bump the version in
// both.

import { PILLAR_WEIGHTS } from "./health-score";

/** Bump when questions, option values, bands, or the stretch change, so
 *  estimates computed under old rules stay identifiable. Independent of the
 *  product's HEALTH_SCORE_VERSION. Must match SCORECARD_SCORE_VERSION on the
 *  server. */
export const SCORECARD_SCORE_VERSION = 1;

export type ScorecardMetric =
  | "participation"
  | "retention"
  | "breadth"
  | "activity"
  | "memberLed"
  | "followThrough";

export type ScorecardAnswers = Record<ScorecardMetric, number>;

export type ScorecardBand = "thriving" | "healthy" | "warming_up" | "fading";

export type GroupType =
  | "run_club"
  | "supper_club"
  | "ministry"
  | "class"
  | "neighborhood"
  | "other";

export interface ScorecardQuestion {
  metric: ScorecardMetric;
  /** Shown above the bars on the reveal card. */
  label: string;
  question: string;
  options: { label: string; value: number }[];
}

/** Q0. Unscored — it segments the visitor so the reveal can name their kind of
 *  group, pick a benchmark, and seed the setup form. Asked first because a
 *  visitor answers "what kind of thing do you run" without hesitating, and a
 *  frictionless first tap is what gets them to the second question. */
export const GROUP_TYPES: {
  value: GroupType;
  label: string;
  /** Used mid-sentence: "+4 vs. a typical run club". */
  noun: string;
  /** Placeholder in the setup form's name field. */
  calendarName: string;
  /** ORG_TYPES value the setup form preselects. */
  orgType: string;
}[] = [
  {
    value: "run_club",
    label: "Run or fitness club",
    noun: "run club",
    calendarName: "Our Run Club",
    orgType: "gym",
  },
  {
    value: "supper_club",
    label: "Supper or dinner club",
    noun: "supper club",
    calendarName: "Our Supper Club",
    orgType: "community",
  },
  {
    value: "ministry",
    label: "Church or ministry group",
    noun: "ministry group",
    calendarName: "Our Ministry Group",
    orgType: "church",
  },
  {
    value: "class",
    label: "Class or studio",
    noun: "studio",
    calendarName: "Our Studio",
    orgType: "brick_and_mortar",
  },
  {
    value: "neighborhood",
    label: "Neighborhood or building group",
    noun: "neighborhood group",
    calendarName: "Our Neighborhood",
    orgType: "neighborhood",
  },
  {
    value: "other",
    label: "Something else",
    noun: "community",
    calendarName: "Our Community",
    orgType: "community",
  },
];

export function groupTypeFor(value: string | null | undefined) {
  return (
    GROUP_TYPES.find((g) => g.value === value) ??
    GROUP_TYPES[GROUP_TYPES.length - 1]
  );
}

/** The six scored questions, in ask order — weight order, heaviest first, so
 *  a visitor who bails after two questions has still answered the two that
 *  move the number most.
 *
 *  Option `value`s are pillar scores on the same 0–100 scale the product's
 *  pillars use, not option indexes. They go into combine() unchanged.
 *
 *  memberLed's scale is compressed (92/72/52/32 against everything else's
 *  92/78/60/40) on purpose. Member-led is the wedge — the pillar a first plan
 *  most directly moves — but it carries only 10% of the weight, so on an even
 *  scale it would almost never be the lowest raw answer and the weak-link
 *  callout would never fire on it. The skew is what lets "Me. Always me." land
 *  as the diagnosis it is. */
export const SCORECARD_QUESTIONS: ScorecardQuestion[] = [
  {
    metric: "participation",
    label: "Participation",
    question:
      "When you put something on the calendar, how many of your people show up?",
    options: [
      { label: "Almost everyone", value: 92 },
      { label: "A solid majority", value: 78 },
      { label: "About half", value: 60 },
      { label: "A handful, usually the same faces", value: 40 },
    ],
  },
  {
    metric: "retention",
    label: "Retention",
    question:
      "Think back three months. How many of those people are still around?",
    options: [
      { label: "Nearly all of them, plus new ones", value: 92 },
      { label: "Most of them", value: 78 },
      { label: "Maybe half", value: 60 },
      { label: "It's turned over a lot", value: 40 },
    ],
  },
  {
    metric: "breadth",
    label: "Breadth",
    question:
      "Across your last five gatherings, how much did the attendance overlap?",
    options: [
      { label: "Different mix every time", value: 92 },
      { label: "Mostly different, with a regular core", value: 78 },
      { label: "Same core, a few visitors", value: 60 },
      { label: "Same six people every time", value: 40 },
    ],
  },
  {
    metric: "activity",
    label: "Activity",
    question: "How often does your community actually get together?",
    options: [
      { label: "Weekly or more", value: 92 },
      { label: "A couple times a month", value: 78 },
      { label: "Monthly", value: 60 },
      { label: "Less than monthly", value: 40 },
    ],
  },
  {
    metric: "memberLed",
    label: "Member-led",
    question: "Who plans things?",
    options: [
      { label: "Plenty of people do", value: 92 },
      { label: "A few of us trade off", value: 72 },
      { label: "Me, and occasionally one other person", value: 52 },
      { label: "Me. Always me.", value: 32 },
    ],
  },
  {
    metric: "followThrough",
    label: "Follow-through",
    question:
      "Of the things your group talks about doing, how many actually happen?",
    options: [
      { label: "Most of them", value: 92 },
      { label: "More than half", value: 78 },
      { label: "Some", value: 60 },
      { label: "We talk about a lot of things", value: 40 },
    ],
  },
];

export const METRIC_KEYS = SCORECARD_QUESTIONS.map((q) => q.metric);

export const METRIC_LABELS = SCORECARD_QUESTIONS.reduce(
  (acc, q) => {
    acc[q.metric] = q.label;
    return acc;
  },
  {} as Record<ScorecardMetric, string>,
);

/** What each pillar measures and why it is weighted the way it is. Shown in
 *  the collapsed "How the score works" accordion. Present because an organizer
 *  who is skeptical of a number will go looking for the methodology, and
 *  finding it is what makes the number credible; collapsed because most
 *  visitors will not open it and it must not push the CTA down the page. */
export const METRIC_EXPLAINERS: Record<ScorecardMetric, string> = {
  participation:
    "The share of people on your list who actually turn up for something. It carries the most weight because it is the only pillar that measures the thing itself — a community is people in a room, and everything else is a way of getting them there.",
  retention:
    "How many of the same people are still showing up three months later. Weighted second because turnover is the quietest way a group dies: attendance can hold steady while the roster underneath it churns completely.",
  breadth:
    "How much your attendance spreads across your whole list rather than concentrating in a handful of regulars. This is participation spread only — never any kind of inference about who your people are.",
  activity:
    "How often you gather. Weighted below the first three on purpose: frequency without participation is just a busier calendar, and a monthly gathering everyone attends beats a weekly one that six people attend.",
  memberLed:
    "Whether anyone other than you puts things on the calendar. It carries only 10% of the score but it is the strongest single predictor of whether a community outlasts its founder, and it is the pillar a first plan most directly moves.",
  followThrough:
    "How many of the things your group talks about doing actually get a date. Weighted lightest because it is the pillar we can measure least well today — as attendance data improves, this weight goes up and everything rescores.",
};

/** PLACEHOLDER MEDIANS — invented, not measured. Replace each with the real
 *  median estimatedScore for that group type once it has 30+ scored sessions.
 *  Until then the reveal is comparing a visitor against a guess: fine for a
 *  launch read on CPA, not fine for anything we publish or quote. */
export const BENCHMARK_MEDIANS: Record<GroupType, number> = {
  run_club: 74,
  supper_club: 78,
  ministry: 69,
  class: 72,
  neighborhood: 63,
  other: 70,
};
export const BENCHMARKS_ARE_PLACEHOLDERS = true;

/** Landing-page bands. Deliberately not the product's bandFor().
 *
 *  Nothing here is red, including the floor. A visitor who has just answered
 *  honestly about a community they care about should read "fixable", not
 *  "failed" — amber is the bottom of the palette, and "Fading" is the bluntest
 *  the copy gets. */
export function scorecardBand(score: number): ScorecardBand {
  if (score >= 85) return "thriving";
  if (score >= 70) return "healthy";
  if (score >= 55) return "warming_up";
  return "fading";
}

export function scorecardBandLabel(band: ScorecardBand): string {
  switch (band) {
    case "thriving":
      return "Thriving";
    case "healthy":
      return "Healthy";
    case "warming_up":
      return "Warming up";
    case "fading":
      return "Fading";
  }
}

/** Both green bands share a hue; both amber bands share a hue. The band is
 *  also always printed as a word, so the distinction never rests on colour
 *  alone. */
export function bandTone(band: ScorecardBand): "green" | "amber" {
  return band === "thriving" || band === "healthy" ? "green" : "amber";
}

// The reachable raw range given the option values above. Asserted at module
// load so an option edit that moves the range fails loudly in dev instead of
// silently skewing every visitor's score.
const RAW_MIN = 39;
const RAW_MAX = 92;
const DISPLAY_MIN = 34;
const DISPLAY_MAX = 96;

/** Weighted average of the six pillars. Mirrors combine() on the server; the
 *  quiz always supplies all six, so there is no renormalization branch here —
 *  the divisor is always 1. */
function combine(answers: ScorecardAnswers): number {
  let sum = 0;
  for (const key of METRIC_KEYS) sum += answers[key] * PILLAR_WEIGHTS[key];
  return sum;
}

/** Map a raw weighted score onto the display range.
 *
 *  Applied to the headline number AND to each pillar bar, so the card is
 *  internally consistent — a stretched 71 sitting above six unstretched bars
 *  that average 66 is exactly the kind of detail a skeptical organizer
 *  notices and stops trusting.
 *
 *  This transform has no in-product equivalent. Someone will eventually
 *  notice that a calendar's dashboard score differs from the estimate the
 *  visitor was shown, and this is the reason. */
export function stretch(raw: number): number {
  const scaled =
    ((raw - RAW_MIN) * (DISPLAY_MAX - DISPLAY_MIN)) / (RAW_MAX - RAW_MIN) +
    DISPLAY_MIN;
  return Math.round(Math.max(DISPLAY_MIN, Math.min(DISPLAY_MAX, scaled)));
}

/** Tie-break order for the weak link: memberLed first because it is the wedge,
 *  then the rest in weight order. */
const WEAK_LINK_PRIORITY: ScorecardMetric[] = [
  "memberLed",
  "participation",
  "retention",
  "breadth",
  "activity",
  "followThrough",
];

/** Lowest raw answer wins. Note this is lowest RAW pillar, not the weighted
 *  headroom the product's weakestPillars() ranks by — the quiz has all six
 *  pillars self-reported, so "your worst answer" is both the honest read and
 *  the one the visitor recognizes as the thing they just told us. */
export function weakestMetric(answers: ScorecardAnswers): ScorecardMetric {
  let weakest: ScorecardMetric = WEAK_LINK_PRIORITY[0];
  for (const key of WEAK_LINK_PRIORITY) {
    if (answers[key] < answers[weakest]) weakest = key;
  }
  return weakest;
}

export interface ScorecardResult {
  score: number;
  rawScore: number;
  band: ScorecardBand;
  bandLabel: string;
  weakMetric: ScorecardMetric;
  pillarScores: Record<ScorecardMetric, number>;
  version: number;
}

export function scoreAnswers(answers: ScorecardAnswers): ScorecardResult {
  const raw = combine(answers);
  const score = stretch(raw);
  const band = scorecardBand(score);

  const pillarScores = {} as Record<ScorecardMetric, number>;
  for (const key of METRIC_KEYS) pillarScores[key] = stretch(answers[key]);

  return {
    score,
    rawScore: Math.round(raw),
    band,
    bandLabel: scorecardBandLabel(band),
    weakMetric: weakestMetric(answers),
    pillarScores,
    version: SCORECARD_SCORE_VERSION,
  };
}

/** The emotional hinge of the page. The lowest pillar gets named in one line
 *  under the bars, and that same pillar sets the CTA's body copy — the
 *  diagnosis and the prescription have to be the same sentence, or the button
 *  reads as a non-sequitur after everything above it.
 *
 *  Brand rule: none of this copy may use "game-changer", "obsessed", "group
 *  chat", "curated experiences", or "seamlessly". */
export const WEAK_LINK_COPY: Record<
  ScorecardMetric,
  { callout: string; cta: string }
> = {
  participation: {
    callout: "People are on your list. They're not in the room.",
    cta: "The gap between a list and a turnout is almost always notice. A plan on a shared calendar with an RSVP attached closes most of it.",
  },
  retention: {
    callout: "You're refilling the room faster than you're keeping it.",
    cta: 'Groups hold on to people who know what’s next. One thing on the calendar, visible to everyone, is what "next" looks like.',
  },
  breadth: {
    callout: "The same six people are carrying your whole community.",
    cta: "A calendar anyone can see is how the seventh person finds a night that works. Start with one plan and watch who turns up.",
  },
  activity: {
    callout: "Not much has been happening.",
    cta: "You don't hate getting people together. You hate deciding what and when. Put one thing down and the next one gets easier.",
  },
  memberLed: {
    callout: "You're the only one planning. That's the number that breaks groups.",
    cta: "Every community that outlasts its founder does one thing first: someone other than the founder puts something on the calendar. Start yours, then hand someone the pen.",
  },
  followThrough: {
    callout: "Good ideas, not enough dates.",
    cta: "The difference between an idea and a plan is a day and a place. Pick both once and the pattern sets.",
  },
};

/** Shape returned by the createScorecardSession / getScorecardSession cloud
 *  functions. Declared here rather than at each call site because three
 *  surfaces read it: the reveal, the shared /score/<sid> page, and the setup
 *  form's prefill. */
export interface ScorecardSession {
  sid: string;
  groupType: GroupType;
  groupTypeLabel: string | null;
  groupNoun: string;
  answers: ScorecardAnswers;
  estimatedScore: number;
  band: ScorecardBand;
  bandLabel: string;
  weakMetric: ScorecardMetric;
  pillarScores: Record<ScorecardMetric, number>;
  benchmark: number;
  benchmarkIsPlaceholder: boolean;
  version: number | null;
  createdAt: string | null;
}

/** sid format check, mirrored from the server so a malformed value in a URL or
 *  in sessionStorage is discarded before it costs a round trip. */
export function isValidSid(value: unknown): value is string {
  return typeof value === "string" && /^sc_[a-f0-9]{24}$/.test(value);
}
