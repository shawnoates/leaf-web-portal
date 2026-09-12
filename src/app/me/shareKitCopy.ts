// Share kit copy (handoff 2026-09-10, turns 4–5). Four notes a follower can
// pass on, written in the follower's voice and sent from their own apps. Every
// user-facing string lives here so the banned-word rule is checked at build.

export type ShareKitOptionId = "email" | "chat" | "text" | "flyer";

export interface ShareKitContext {
  calendarName: string;
  url: string;
  firstName: string;
}

export interface ShareKitOption {
  id: ShareKitOptionId;
  label: string;
  subtitle: string;
  primary: string;
  /** Underlined text link beside the primary button; null = none. */
  secondary: string | null;
  subject?: (ctx: ShareKitContext) => string;
  /** Editable note. Absent = the row opens to a `note` line instead (flyer:
   *  the printed page has its own copy, so an editable box here would lie). */
  body?: (ctx: ShareKitContext) => string;
  note?: string;
}

// Mirrors CC_EMAIL in leaflets-server/cloud/building-intro-functions.js — the
// manager email copies the team so a reply lands somewhere.
export const CC_EMAIL = "team@getleaflets.co";

const signoff = ({ firstName }: ShareKitContext) => (firstName ? `\n\n${firstName}` : "");

export const COPY = {
  // /me card eyebrow is the calendar's name; this is the fallback only.
  eyebrow: "Your neighborhood calendar",
  headline: "Bring a few neighbors along",
  // Mobile sheet breaks the headline by hand so it never wraps mid-phrase.
  headlineLines: ["Bring a few", "neighbors along"],
  introPostFollow: "You're following. Know anyone else who'd want in? We wrote the notes, you just send them.",
  introMe: "Know anyone who'd want in? We wrote the notes, you just send them.",
  maybeLater: "Maybe later",
  copied: "Copied",

  options: [
    {
      id: "email",
      label: "Email your building's resident manager",
      subtitle: "For the resident newsletter",
      primary: "Open Mail",
      secondary: "Copy text",
      subject: ({ calendarName }) => `${calendarName} for the resident newsletter`,
      body: (ctx) =>
        `Hi,\n\nI live in the building. There's a neighborhood calendar, ${ctx.calendarName}, that a few of us have been using to find things to do nearby, mostly small stuff, a walk, a table at a bar a few blocks away.\n\n${ctx.url}\n\nWould you put it in the resident newsletter? It's free, there's no app, and nobody has to sign anything.${signoff(ctx)}`,
    },
    {
      id: "chat",
      label: "Post in your neighbors' chat group",
      subtitle: "WhatsApp, the building group, or the board",
      primary: "Copy",
      secondary: null,
      body: (ctx) =>
        `There's a neighborhood calendar, ${ctx.calendarName}, that a few of us have been using to find things to do nearby, mostly small stuff, a walk, a table at a bar a few blocks away.\n\n${ctx.url}\n\nIt's free, there's no app, and nobody has to sign anything. Follow it if you want a heads up on what's coming.${signoff(ctx)}`,
    },
    {
      id: "text",
      label: "Text a friend",
      subtitle: "Someone who would come along",
      primary: "Open Messages",
      secondary: "Copy text",
      body: ({ url }) =>
        `hey, been using this neighborhood calendar for small stuff nearby, walks, a table at a bar. thought you'd want it: ${url}`,
    },
    {
      id: "flyer",
      label: "Print a flyer",
      subtitle: "One page with a QR code",
      primary: "Print",
      secondary: "Download PDF",
      note: "Letter size, with a QR code that opens the calendar. Tape it by the mailboxes.",
    },
  ] satisfies ShareKitOption[],
};

const BANNED = [
  /\bgame-?changer\b/i,
  /\bobsessed\b/i,
  /\bgroup ?chat\b/i,
  /\bcurated experiences?\b/i,
  /\bseamlessly\b/i,
];

const SAMPLE: ShareKitContext = { calendarName: "Sample Calendar", url: "https://example.com/org/x", firstName: "Sam" };

function flatten(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (typeof v === "function") out.push(String((v as (c: ShareKitContext) => string)(SAMPLE)));
  else if (Array.isArray(v)) v.forEach((x) => flatten(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => flatten(x, out));
  return out;
}

export function findBannedCopy(): string[] {
  return flatten(COPY).filter((s) => BANNED.some((re) => re.test(s)));
}

if (process.env.NODE_ENV !== "production") {
  const hits = findBannedCopy();
  if (hits.length) throw new Error(`shareKitCopy: banned word in ${JSON.stringify(hits)}`);
}
