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
    status: "active" | "paused";
    /** false once the owner turned Friend Mode off */
    enabled?: boolean;
    quorum: number;
    joinedCount: number;
    ownerId: string | null;
  };
  me: Member & { isOwner: boolean; token: string; rhythmDays?: number | null; smsOptIn?: boolean; hasPhone?: boolean; phoneLast4?: string | null; calendarSynced?: boolean };
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

export function rhythmLabel(days: number) {
  return RHYTHM_LABELS[days] || `Every ${days} days`;
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
