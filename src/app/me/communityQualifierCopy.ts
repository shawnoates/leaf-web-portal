// String catalog for the community qualifier card on /me. Every user-facing
// string in that flow lives here so the banned-word rule (spec §11) is checked
// against one object rather than by review.

export type Q1Key = "yes" | "not_really";
export type Q2Key = "ten_plus" | "handful" | "almost_none";
export type Q3Key = "yes" | "maybe" | "no";

export const COPY = {
  progress: (step: number) => `Quick question · ${step} of 3`,
  back: "Back",
  q1: {
    prompt: "Do you have another community you're part of?",
    sub: "A church, a club, a team, a standing Thursday thing.",
    options: [
      { key: "yes", label: "Yes" },
      { key: "not_really", label: "Not really" },
    ] as { key: Q1Key; label: string }[],
  },
  q2: {
    prompt: "How many people there do you already know by name?",
    options: [
      { key: "ten_plus", label: "Ten or more" },
      { key: "handful", label: "A handful" },
      { key: "almost_none", label: "Almost nobody yet" },
    ] as { key: Q2Key; label: string }[],
  },
  q3: {
    prompt: "Would you want to be the one who puts things on the calendar for them?",
    options: [
      { key: "yes", label: "Yes" },
      { key: "maybe", label: "Maybe, tell me more" },
      { key: "no", label: "No, I just want to show up" },
    ] as { key: Q3Key; label: string }[],
  },
  unqualified: {
    lead: "Then start by showing up to one. Here's what's near you this week.",
    empty: "Nothing on your calendars this week yet. Find one worth following.",
    browse: "Find a calendar",
    open: "Open",
  },
  ready: {
    title: (name: string) => `${name} is ready.`,
    assurance:
      "Let's create your first plan and get your community off the ground. As people join, we'll keep a short list of what's worth doing next — the table, the day-of details — so you're never guessing. Nothing goes out without you.",
    selfServe: "Let's create your first plan and get your community off the ground.",
    rename: "Rename",
    renameSave: "Save",
    renameCancel: "Cancel",
    placeholder: "What's the first one? Say it however you'd say it out loud.",
    hint: "Or start from one of these.",
    go: "Start it",
    closer: "Pick a day. Pick your people.",
  },
  done: {
    title: (planTitle: string) => `${planTitle} is on the calendar.`,
    // The plan is done; the room is the thing that still needs people. Sharing
    // the calendar earns every plan after this one, sharing the plan earns one.
    lead: "Send people the calendar. They'll see this plan and everything you put up after it.",
    share: "Copy the calendar link",
    shared: "Copied",
    viewCalendar: "See it live",
    manage: "Manage your plans",
    planLink: "Or copy just this plan's link",
    planLinkCopied: "Plan link copied",
    close: "Close",
    closer: "Pick a day. Pick your people.",
  },
  error: "Something went wrong. Give it another go.",
};

// Spec §11 banned-word list. The last entry is the messaging-thread phrase the
// spec bans by description rather than by name.
const BANNED = [
  /\bsurvey\b/i,
  /\bfeedback\b/i,
  /\bresearch\b/i,
  /\bambassador\b/i,
  /\bgame-?changer\b/i,
  /\bobsessed\b/i,
  /\bcurated experiences?\b/i,
  /\bseamlessly\b/i,
  /\bgroup ?chat\b/i,
];

function flatten(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (typeof v === "function") out.push(String((v as (s: string) => string)("X")));
  else if (Array.isArray(v)) v.forEach((x) => flatten(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => flatten(x, out));
  return out;
}

export function findBannedCopy(): string[] {
  return flatten(COPY).filter((s) => BANNED.some((re) => re.test(s)));
}

// Fails the dev build loudly rather than waiting for a reviewer to notice.
if (process.env.NODE_ENV !== "production") {
  const hits = findBannedCopy();
  if (hits.length) throw new Error(`communityQualifierCopy: banned word in ${JSON.stringify(hits)}`);
}
