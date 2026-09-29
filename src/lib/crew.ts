/**
 * Friend Mode ("crew") types and helpers shared by the /crew pages and /me.
 * Mirrors the payloads of getCrewForMember / getCrewBook on the server
 * (leaflets-server cloud/friend-mode/friend-mode-functions.js).
 *
 * Every function here accepts either a member link token (SMS members) or
 * the signed-in session plus a crewId. `auth` carries whichever we have.
 */

import Parse from "@/lib/parse-client";

export type CrewAuth = { token: string } | { crewId: string };

export type DateOption = { date: string; time: string | null };

export type Venue = {
  name: string;
  address?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
  website?: string | null;
  phone?: string | null;
  /** The crew's own place (venue rotation off): a name like "Mom's", maybe an address. */
  fixed?: boolean;
};

export type CycleState = "picking" | "polling" | "locked" | "booked" | "done" | "skipped" | "cancelled";

export type CycleView = {
  cycleId: string;
  state: CycleState;
  trigger: "rhythm" | "member_ask" | "member_proposal" | "opportunity";
  venue: Venue | null;
  options: DateOption[];
  chosenOption: DateOption | null;
  startsAt: string | { iso: string } | null;
  pollClosesAt: string | { iso: string } | null;
  planId: string | null;
  sessionId: string | null;
  hostId: string | null;
  isHost: boolean;
  waitingForQuorum: boolean;
  /** false when this member sat the cycle out (their own pace); they can still answer from the page */
  invited?: boolean;
  votes: Record<string, number[]> | null;
  myVotes: number[] | null;
  /** Dates this person looks free for (synced calendar / Leaf plans); pre-selected, never auto-voted. */
  myFree?: number[] | null;
  /** Per option: members Leaf knows about that night, and how many look free. */
  fit?: { free: number; known: number }[] | null;
  /** Dates (by index) another crew with some of the same people already has a night. */
  clashes?: Record<string, { crewName: string; venue: string | null }>;
  /** Same place and time as another crew's night: the organizer can combine them. */
  combineOffer?: { crewName: string; venue: string | null; optionIndex: number } | null;
  rsvps: Record<string, "in" | "out">;
  myRsvp: "in" | "out" | null;
};

export type Member = {
  membershipId: string;
  userId: string | null;
  name: string;
  avatar: string | null;
  status: "invited" | "in" | "declined" | "left";
};

export type BookSpot = {
  spotId: string;
  locationId: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  category: string | null;
  photo: string | null;
  placeId: string | null;
  addedBy: string | null;
  addedByMe: boolean;
  upvotes: number;
  upvotedByMe: boolean;
  triedAt: string | { iso: string } | null;
  /** Set when the entry came from a dated event (an Eventbrite link, a post with a real date). */
  eventTitle?: string | null;
  eventDate?: string | { iso: string } | null;
  /** The event's day is over: the entry sits at the bottom and Leaf won't pick it for a night. */
  eventPassed?: boolean;
};

export type SavedPlace = {
  bookmarkId: string;
  locationId: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  category: string | null;
  photo: string | null;
  inBook: boolean;
};

export type CrewPage = {
  crew: {
    id: string;
    name: string;
    rhythmDays: number;
    /** "Just once": one night, then Friend Mode switches itself off. */
    oneTime?: boolean;
    status: "active" | "paused";
    /** false once the owner turned Friend Mode off */
    enabled?: boolean;
    quorum: number;
    joinedCount: number;
    ownerId: string | null;
    /** 'friends': started with Start a crew (its calendar is hidden). 'calendar': Friend Mode on a real calendar. */
    origin?: "friends" | "calendar";
    /** 'fixed': venue rotation off, the crew always meets at `fixedPlace`. */
    placeMode?: "book" | "fixed";
    fixedPlace?: { label: string; address: string | null } | null;
    /** Each round Leaf starts goes to the next member to host. */
    hostRotation?: boolean;
    /** A one-time crew after its night: offer "Do it again?". */
    lastOneTime?: { happened: boolean; venue: string | null; at: string | { iso: string } | null } | null;
  };
  me: Member & { isOwner: boolean; token: string; rhythmDays?: number | null; smsOptIn?: boolean; hasPhone?: boolean; phoneLast4?: string | null; calendarSynced?: boolean; inviteLink?: string | null; needsSeed?: boolean; needsPace?: boolean };
  members: Member[];
  names: Record<string, string>;
  open: CycleView[];
  past: { cycleId: string; venue: Venue | null; startsAt: string | { iso: string } | null; headcount: number; planId: string | null }[];
  book: BookSpot[];
};

export const RHYTHM_LABELS: Record<number, string> = {
  7: "Every week",
  14: "Every 2 weeks",
  21: "Every 3 weeks",
  28: "Every month",
  42: "Every 6 weeks",
  56: "Every 2 months",
};

/**
 * Where tapping a book entry goes. Inside the app the link is a leaf://
 * deep link the crew web view turns into the native place screen; on the
 * web it opens the place on Google Maps.
 */
export function spotHref(s: { locationId: string; placeId: string | null; name: string; address: string | null }, inApp: boolean) {
  if (inApp) return `leaf://location/${s.locationId}`;
  if (s.placeId) return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(s.placeId)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, s.address].filter(Boolean).join(" "))}`;
}

export function rhythmLabel(days: number) {
  return RHYTHM_LABELS[days] || `Every ${days} days`;
}

/** "Just once" for a one-time crew, else its rhythm ("Every month"). */
export function cadenceLabel(crew: { rhythmDays: number; oneTime?: boolean }) {
  return crew.oneTime ? "Just once" : rhythmLabel(crew.rhythmDays);
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Thu, Oct 9" from a 'YYYY-MM-DD' calendar day (no time zone shift). */
export function dayLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAY[dt.getUTCDay()]}, ${MONTH[m - 1]} ${d}`;
}

/** "7pm" / "7:30pm" from 'HH:mm'. */
export function timeLabel(hhmm: string | null | undefined) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${ap}` : `${hh}${ap}`;
}

/** The pieces of a 'YYYY-MM-DD' day for date tiles: { dow: "Thu", month: "Oct", day: 9 }. */
export function dayParts(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { dow: WEEKDAY[dt.getUTCDay()], month: MONTH[m - 1], day: d };
}

export function optionLabel(o: DateOption) {
  return `${dayLabel(o.date)}${o.time ? ` · ${timeLabel(o.time)}` : ""}`;
}

export function toDate(v: string | { iso: string } | null | undefined): Date | null {
  if (!v) return null;
  const iso = typeof v === "string" ? v : v.iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function authParams(auth: CrewAuth) {
  return "token" in auth ? { token: auth.token } : { crewId: auth.crewId };
}

export function crewHref(auth: CrewAuth, sub = "") {
  const base = "token" in auth ? `/crew/${auth.token}` : `/crew/${auth.crewId}`;
  return sub ? `${base}/${sub}` : base;
}

export async function fetchCrew(auth: CrewAuth): Promise<CrewPage> {
  return (await Parse.Cloud.run("getCrewForMember", authParams(auth))) as CrewPage;
}

export async function run<T = unknown>(name: string, auth: CrewAuth, params: Record<string, unknown> = {}): Promise<T> {
  return (await Parse.Cloud.run(name, { ...authParams(auth), ...params })) as T;
}

/** Plain-English status for a cycle, used on the crew page and the /me rail. */
export function cycleStatusLine(c: CycleView, names: Record<string, string>): string {
  if (c.state === "picking") return c.waitingForQuorum ? "Waiting for more people to join" : "Leaf is picking a place";
  if (c.state === "polling") {
    const answered = c.votes ? Object.keys(c.votes).length : 0;
    return `Voting on dates · ${answered} answered`;
  }
  const going = Object.values(c.rsvps).filter((r) => r === "in").length;
  const when = c.chosenOption ? optionLabel(c.chosenOption) : "";
  const who = names[c.hostId || ""] || "the host";
  if (c.state === "locked") return `${when} · ${going} going · ${who} is booking`;
  if (c.state === "booked") return `${when} · ${going} going · booked ✓`;
  return c.state;
}

/** What `crewTellLeaf` gives back: what Leaf managed to take from the note. */
export type TellLeafResult = {
  received: boolean;
  understood?: boolean;
  preferDays?: number[];
  avoidDays?: number[];
  /** "HH:mm" the member wants nights to start ("daytime" reads as 12:00). */
  preferTime?: string | null;
  /** When a start can fall, "HH:mm" each end; either may be missing. */
  timeWindow?: { earliest: string | null; latest: string | null } | null;
  dislikedAdded?: number;
  /** What happened to this round's open poll: new dates, or left alone because people already voted. */
  pollDates?: "refreshed" | "others_voted" | "unchanged" | null;
};

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

function listDays(days: number[]): string {
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "weekdays";
  const names = days.map((d) => DAY_NAMES[d]).filter(Boolean);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "12:00" → "noon", "18:30" → "6:30 PM". */
function clockLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 12 && m === 0) return "noon";
  const hour = h % 12 || 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * The line shown after a note is sent. When Leaf took something concrete from
 * it, say so in the member's own terms — a silent "Got it" gives them no way
 * to notice it was read backwards.
 */
export function tellLeafReceipt(r: TellLeafResult): string {
  const w = r.timeWindow;
  const at = w && w.earliest && w.latest
    ? `starting between ${clockLabel(w.earliest)} and ${clockLabel(w.latest)}`
    : w?.earliest ? `starting no earlier than ${clockLabel(w.earliest)}`
      : w?.latest ? `starting by ${clockLabel(w.latest)}`
        : r.preferTime ? `around ${clockLabel(r.preferTime)}` : "";
  const prefer = r.preferDays?.length
    ? `I'll aim for ${listDays(r.preferDays)}${at ? `, ${at}` : ""}`
    : at ? `I'll aim for nights ${at}` : "";
  const avoid = r.avoidDays?.length ? `I'll steer clear of ${listDays(r.avoidDays)}` : "";
  const both = [prefer, avoid].filter(Boolean).join(", and ");
  const round = r.pollDates === "refreshed"
    ? " New dates are up for this round."
    : r.pollDates === "others_voted"
      ? " People already voted on this round's dates, so it starts with the next one."
      : "";
  if (both) return `Got it — ${both}.${round}`;
  return `Got it. Thanks.${round}`;
}
