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
  /** Somewhere just for this round ("Somewhere else"): it can change again. */
  custom?: boolean;
};

/** A crew's one place: a name, maybe a real place or one of the organizer's own (custom: Home). */
export type FixedPlace = { label: string; address: string | null; locationId?: string | null; custom?: boolean; photo?: string | null };

/** A place's weather rule, or an event the crew watches for (crew-triggers.js on the server). */
export type WeatherTrigger =
  | { kind: "weather"; minF: number; noRain: boolean; days: number[]; time: string; everyDays?: number }
  | { kind: "event"; query: string };

/** Leaf's offer of one night with another crew that shares someone. */
export type MeetupOffer = {
  id: string;
  withCrew: string;
  /** First names of the people in both crews. */
  bridge: string[];
  /** This crew's answer, and the other crew's (null: not yet). */
  mine: boolean | null;
  theirs: boolean | null;
  /** This crew's round is the one the other joins. */
  hosting: boolean;
  expiresAt: string | { iso: string } | null;
};

export type EventMatch = {
  spotId: string; query: string | null; title: string; date: string; time: string | null;
  venueName: string; address: string | null; url: string | null; image: string | null; free: boolean;
  /** An away game: the crew watches it at a place from the book. */
  watchParty?: boolean;
};

export type CycleState = "picking" | "polling" | "locked" | "booked" | "done" | "skipped" | "cancelled";

export type CycleView = {
  cycleId: string;
  state: CycleState;
  trigger: "rhythm" | "member_ask" | "member_proposal" | "opportunity" | "weather" | "event" | "birthday" | "free";
  /** A birthday round: whose birthday. */
  birthdayOfId?: string | null;
  /** A "when we're free" round: how many were free that date. */
  freeCount?: number | null;
  venue: Venue | null;
  /** The place's Leaf id: opens its place page (the app's location detail). */
  venueLocationId?: string | null;
  /** A movie or event from the book: its days ('YYYY-MM-DD'), so the dates stay inside them. */
  eventWindow?: { start: string; end: string; kind: "movie" | "event"; title: string | null } | null;
  /** A movie night's real showtime and booking link, by date. */
  showtimes?: Record<string, { time: string; bookingUrl: string | null }> | null;
  /** Waiting on a place: where Leaf suggests (been there together, or fits the crew's name). */
  placeSuggestion?: { name: string; address: string | null; locationId?: string; placeId?: string | null; lat?: number; lng?: number; why: "history" | "name" } | null;
  /** A set night: this person's invite on its plan, for the plan chat link (/c/<id>). */
  myInviteId?: string | null;
  /** Voting, nobody has voted, and a place was added since: offer it instead. */
  swapOffer?: { spotId: string; name: string } | null;
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
  /** While voting: members who are in but sitting this round out on their own pace, by name. */
  sittingOut?: string[];
  /** A theme night: the theme that picked this night's place ("Drinks under $10"). */
  theme?: { label: string; special?: string | null } | null;
  /** A shared night with another crew: its name ("Date Night"). */
  withCrew?: string | null;
  /** A set night's date vote ("Let the crew vote instead"): the current date first, then the others. */
  redate?: {
    options: { date: string; time: string; current: boolean; votes: number; free?: number | null; known?: number | null; weather?: { temp: string | null; text: string | null; icon: string | null; rain: number | null } | null }[];
    myVotes: number[] | null;
    voters: number;
    byName: string | null;
    closesAt: string;
  } | null;
  /** While voting: the forecast at the place for each date option (within ~10 days), by 'YYYY-MM-DD'. */
  weather?: Record<string, { temp: string | null; text: string | null; icon: string | null; rain: number | null }>;
  votes: Record<string, number[]> | null;
  myVotes: number[] | null;
  /** Dates this person looks free for (synced calendar / Leaf plans); pre-selected, never auto-voted. */
  myFree?: number[] | null;
  /** Per option: members Leaf knows about that night, and how many look free. */
  fit?: { free: number; known: number }[] | null;
  /** The host said this night's place takes no bookings. */
  noBookingNeeded?: boolean;
  /** Dates (by index) another crew with some of the same people already has a night. */
  clashes?: Record<string, { crewName: string; venue: string | null }>;
  /** Same place and time as another crew's night: the organizer can combine them. */
  combineOffer?: { crewName: string; venue: string | null; optionIndex: number } | null;
  rsvps: Record<string, "in" | "out">;
  myRsvp: "in" | "out" | null;
};

export type ThemeVote = { label: string; votes: number; myVote: boolean; byName: string | null };

export type Member = {
  membershipId: string;
  userId: string | null;
  name: string;
  avatar: string | null;
  status: "invited" | "in" | "declined" | "left";
  /** Their own pace when it's slower than the crew's (days), else null. */
  paceDays?: number | null;
};

export type BookSpot = {
  spotId: string;
  /** Null for a shared plan that has no place yet (needsPlace). */
  locationId: string | null;
  needsPlace?: boolean;
  /** A rule on this place ("when it's 80°+"), BETA. */
  trigger?: WeatherTrigger | null;
  triggerLabel?: string | null;
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
  /** A movie or event's days, 'YYYY-MM-DD' (start = end for one night). */
  eventStart?: string | null;
  eventEnd?: string | null;
  eventKind?: "movie" | "event" | null;
  /** A shared post's date: read off its flyer ('image'), its caption, both, or set by a member; and whether caption and flyer disagreed. */
  eventDateFrom?: "image" | "caption" | "both" | "member" | null;
  eventDateCheck?: boolean;
  /** A plan someone shared into the book: its own title, description, video, cover and link. */
  /** A shared post that repeats weekly: "Every Tue · 9 PM–close" (no date to ask for). */
  planRepeats?: string | null;
  /** Filter tags for the book's pills ("Happy hours", "Drinks", "Rooftops"…). */
  tags?: string[];
  plan?: { title: string | null; description: string | null; videoUrl: string | null; imageUrl: string | null; sourceUrl: string | null } | null;
  /** Which row it belongs in: Places ("place") or Happenings (the rest). */
  kind?: BookKind;
  /** The shared import it came from: one object for every crew and calendar it went to. */
  importedEventId?: string | null;
  /** A watched event (kind "watch"): what Leaf looks for, and the next date it found. */
  query?: string | null;
  next?: WatchItem["next"];
  addedAt?: string | { iso: string } | null;
};

export type BookKind = "place" | "plan" | "event" | "movie" | "watch";

/** One-tap ideas for the book (server: discoverForCrew). */
export type DiscoverItem = {
  placeId: string | null;
  /** A Leaf place (a member's save); null for one only Google knows yet. */
  locationId?: string | null;
  name: string;
  address: string | null;
  shortAddress: string | null;
  category: string | null;
  photo?: string | null;
  lat: number | null;
  lng: number | null;
  /** Why it's here: a member saved it, it's like a place the crew has been, it's popular nearby, or it's an event nearby. */
  why: "saved" | "like" | "popular" | "event";
  reason: string;
  /** For an event nearby: when and where, and its ticket page. */
  event?: { date: string; time: string | null; venueName: string | null; url: string | null } | null;
  isNew?: boolean;
  rating?: number | null;
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
    /** On a trigger (BETA): no rhythm rounds; places with a rule start them. */
    triggerOnly?: boolean;
    /** Birthdays (BETA): the round nearest a member's birthday is theirs. */
    birthdays?: boolean;
    /** When we're free (BETA): a night when enough of the crew (a share) are free the same day. */
    freeTrigger?: FreeRule | null;
    freeTriggerLabel?: string | null;
    /** When the crew meets before a round sets it ("09:00" for a morning crew). */
    usualTime?: string | null;
    placeMode?: "book" | "fixed";
    fixedPlace?: FixedPlace | null;
    /** Each round Leaf starts goes to the next member to host. */
    hostRotation?: boolean;
    /** Leaf suggests shared nights with crews that share someone. */
    meetups?: boolean;
    /** Theme nights: the leading theme for the next night, the themes with upvotes, and Leaf's ideas (from the crew's name and history). */
    nextTheme?: { label: string } | null;
    themeVotes?: ThemeVote[];
    themeIdeas?: string[];
    /** Themes the book itself can fill, with how many of its places fit ("Sushi night · 3 places"). */
    bookThemes?: { label: string; count: number }[];
    /** A member's birthday around the next night, as a theme idea ("Shawn's Birthday Celebration", "Sat, Nov 8"). */
    birthdayThemes?: { userId: string; label: string; date: string }[];
    /** When Leaf starts the next round on its own (recurring crews that are on). */
    nextRoundAt?: string | null;
    /** A one-time crew after its night: offer "Do it again?". */
    lastOneTime?: { happened: boolean; venue: string | null; at: string | { iso: string } | null } | null;
  };
  me: Member & { isOwner: boolean; token: string; rhythmDays?: number | null; smsOptIn?: boolean; hasPhone?: boolean; phoneLast4?: string | null; calendarSynced?: boolean; inviteLink?: string | null; needsSeed?: boolean; needsPace?: boolean; hiddenTips?: string[];
    /** Birthdays on: their own "where do you want to go?" (pickBirthdayPlace), and whether Leaf knows their birthday. */
    birthdayAsk?: { date: string } | null; needsBirthday?: boolean;
    /** When we're free is on and Leaf can't see their calendar: ask them to sync. */
    needsCalendarForFree?: boolean };
  members: Member[];
  names: Record<string, string>;
  /** Tell Leaf pills: what the crew has said so far, with counts (never who). */
  prefPills?: PrefPill[];
  open: CycleView[];
  past: { cycleId: string; venue: Venue | null; startsAt: string | { iso: string } | null; headcount: number; planId: string | null }[];
  /** The newest few in the book (the crew page's row). */
  book: BookSpot[];
  /** The book's rows for the crew page: Places, Happenings, and Discover (one tap adds). */
  bookPlaces?: BookSpot[];
  bookHappenings?: BookSpot[];
  bookHappeningsTotal?: number;
  discover?: DiscoverItem[];
  /** How many places the whole book holds. */
  bookTotal?: number;
  /** Crew Pulse: rings, score and stats from the last 90 days (null if it couldn't be worked out). */
  pulse?: CrewPulse | null;
  /** Split the bill for the latest night that ended this week (null when there's none). */
  split?: CrewSplit | null;
  /** A set night's cost to collect, by cycle id. */
  costs?: Record<string, CrewSplit | null>;
  /** Something to split for a night: each set night's, plus a past one this person still has to settle. */
  addOns?: CrewAddOn[];
  /** The night that just happened, for a day and a half: the crew page's Last night card. */
  lastNight?: LastNight | null;
  /** Events the crew watches for (BETA), above the places. */
  watching?: WatchItem[];
  /** Watched events that found a date, waiting on the organizer's "It's a go?". */
  eventMatches?: EventMatch[];
  /** A shared night offered with another crew, for the organizer to answer. */
  meetupOffer?: MeetupOffer | null;
};

export type LastNight = {
  cycleId: string;
  venue: Venue | null;
  startsAt: string | { iso: string } | null;
  chosenOption: DateOption | null;
  planId: string | null;
  myInviteId: string | null;
  went: { userId: string; name: string }[];
  iWent: boolean;
  myRating: "up" | "down" | null;
  ratings: { up: number; down: number };
  /** "Did you make it?": their answer, or null before they say. */
  myAttendance?: "yes" | "no" | null;
  /** The night's photos (same store as the recap page), newest first. */
  photos?: import("@/components/recap/types").Photo[];
  /** Within 7 days of the night: members can still add photos. */
  uploadsOpen?: boolean;
  photoLimits?: { maxPerAttendee: number; maxPerEvent: number; maxBytes: number };
};

type Paid = { at: string; method: string | null; confirmed: boolean };

/** Split something for the night (server: crew-addons.js, crewAddOnView). Cents. */
export type CrewAddOn = {
  cycleId: string;
  venue: string;
  startsAt: string | { iso: string } | null;
  /** The night hasn't happened yet. */
  upcoming: boolean;
  state: "suggested" | "on" | "bought";
  key: string;
  label: string;
  emoji: string;
  going: number;
  /** Suggested: Leaf's options, best fit first (the carousel). */
  options?: { key: string; label: string; emoji: string; why: string; estimate?: { totalCents: number; eachCents: number } }[];
  /** Suggested or on: roughly what it costs for this many people. */
  estimate?: { totalCents: number; eachCents: number };
  why?: string;
  id?: string;
  item?: string;
  picker?: { userId: string; name: string } | null;
  isPicker?: boolean;
  goingPeople?: { userId: string; name: string }[];
  totalCents?: number;
  eachCents?: number;
  myShareCents?: number;
  myPaid?: Paid | null;
  payOptions?: PayOption[];
  pickerHasHandles?: boolean;
  people?: { userId: string; name: string; shareCents: number; paid: Paid | null }[];
  settled?: boolean;
};

export type PayOption = { method: string; label: string; handle: string; url: string | null; hint?: string; recipientName?: string | null };

/** A night's bill (server: crewSplitView in friend-mode-functions.js). Dollars, not cents. */
export type CrewSplit = {
  cycleId: string;
  venue: string;
  startsAt: string | { iso: string } | null;
  went: boolean;
  canAddCost?: boolean;
  receipt: null | {
    receiptId: string;
    cost: { mode: "total" | "each"; cents: number; label: string | null } | null;
    photo: string | null;
    items: { index: number; name: string; quantity: number; totalPrice: number; mine: boolean; people: string[] }[];
    subtotal: number;
    tax: number;
    tip: number;
    total: number;
    unclaimed: number;
    tipIndex: number;
    tipRates: number[];
    payer: { userId: string; name: string } | null;
    isPayer: boolean;
    canEdit: boolean;
    myShare: number;
    myPaid: { at: string; method: string | null; confirmed: boolean } | null;
    payOptions: PayOption[];
    payerHasHandles: boolean;
    people: { userId: string; name: string; share: number; paid: { at: string; method: string | null; confirmed: boolean } | null }[];
  };
};

/** Crew Pulse (server: crew-pulse.js). Rings are 0–1; a null ring doesn't apply (a one-time crew has no rhythm). */
export type CrewPulse = {
  windowDays: number;
  /** Null until the crew's second night. */
  score: number | null;
  band: "on-fire" | "solid" | "drifting" | "warming-up" | "getting-going";
  bandLabel: string;
  /** Points since 30 days ago. */
  trend: number | null;
  rings: { showUp: number | null; keepItGoing: number | null; shareLoad: number | null };
  ringDetail: { nightsInWindow: number; expectedNights: number | null; contributors: number; members: number };
  stats: { nights: number; places: number; streak: number; mostAtOnce: number };
  shoutOuts: { kind: "never-missed" | "most-spots" | "fastest-vote"; label: string; userId: string; name: string }[];
  nudge: string | null;
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
export function spotHref(s: { locationId: string | null; placeId: string | null; name: string; address: string | null; plan?: { sourceUrl: string | null } | null }, inApp: boolean) {
  // A shared plan with no place yet: the post it came from.
  if (!s.locationId) return s.plan?.sourceUrl || "#";
  if (inApp) return `leaf://location/${s.locationId}`;
  if (s.placeId) return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(s.placeId)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, s.address].filter(Boolean).join(" "))}`;
}

export function rhythmLabel(days: number) {
  return RHYTHM_LABELS[days] || `Every ${days} days`;
}

/** "Just once" for a one-time crew, "When 3+ are free" / "On a trigger" for a trigger-only one, else its rhythm ("Every month"). */
export function cadenceLabel(crew: { rhythmDays: number; oneTime?: boolean; triggerOnly?: boolean; freeTrigger?: Pick<FreeRule, "minPct" | "minFree"> | null }) {
  if (crew.triggerOnly) return crew.freeTrigger ? `When ${freeShareWords(crew.freeTrigger)} are free` : "On a trigger";
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

/** Evening plans (5pm–4am) are "nights"; daytime ones (coffee, brunch, a hike) aren't. Unknown time: night. Same rule as the server's texts. */
export function isEvening(hhmm: string | null | undefined): boolean {
  if (!hhmm) return true;
  const h = Number(hhmm.split(":")[0]);
  return !Number.isFinite(h) || h >= 17 || h < 4;
}

/** A round's time: the chosen date's, else the first option's. */
export function cycleIsEvening(c: Pick<CycleView, "chosenOption" | "options">): boolean {
  return isEvening(c.chosenOption?.time ?? c.options?.[0]?.time ?? null);
}

/** From a start time, in this browser's zone. */
export function eveningAt(v: Date | string | { iso: string } | null | undefined): boolean {
  const d = toDate(v);
  if (!d) return true;
  const h = d.getHours();
  return h >= 17 || h < 4;
}

/** A daytime crew (coffee, brunch) isn't "nights": go by the latest round's time, else the crew's usual time. */
export function crewIsEvening(page: Pick<CrewPage, "open" | "past"> & { crew?: { usualTime?: string | null } }): boolean {
  const open = page.open ?? [];
  const past = page.past ?? [];
  // The first thing that knows a time: a round still picking has no dates yet.
  const openTime = open[0] ? open[0].chosenOption?.time ?? open[0].options?.[0]?.time ?? null : null;
  if (openTime) return isEvening(openTime);
  if (past[0] && toDate(past[0].startsAt)) return eveningAt(past[0].startsAt);
  return isEvening(page.crew?.usualTime ?? null);
}

/** A date as the server sends it: Parse.Cloud.run hands back a Date; cached pages and REST give strings or { iso }. */
export function toDate(v: Date | string | { iso: string } | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
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
export type PrefPill = { id: string; label: string; count: number; mine: boolean; kind: "pref" | "theme" };

export type TellLeafResult = {
  received: boolean;
  understood?: boolean;
  preferDays?: number[];
  avoidDays?: number[];
  /** "HH:mm" the member wants nights to start ("daytime" reads as 12:00). */
  preferTime?: string | null;
  /** Asked for good weather ("on a nice day"): Leaf checks the forecast. */
  weather?: "nice" | null;
  /** When a start can fall, "HH:mm" each end; either may be missing. */
  timeWindow?: { earliest: string | null; latest: string | null } | null;
  dislikedAdded?: number;
  /** What happened to this round's open poll: new dates, or left alone because people already voted. */
  pollDates?: "refreshed" | "others_voted" | "unchanged" | null;
  /** "Let us know when the Nets play the Rockets": a watch Leaf added to the book. */
  watch?: { query: string; title: string; venueName: string | null; date: string | null } | null;
};

/** When we're free (BETA): days 0–6, Sunday first; time "HH:mm". */
/** When we're free: `minPct` of the crew (a share, so it keeps up as the crew grows), or an older rule's head count `minFree`. */
export type FreeRule = { kind: "free"; minPct?: number; minFree?: number; days: number[]; time: string; everyDays: number };

/** "half", "all", "60%", or "3+" for an older head-count rule: "when half of you are free". */
export function freeShareWords(rule: Pick<FreeRule, "minPct" | "minFree"> | null | undefined): string {
  if (!rule) return "";
  if (rule.minPct) return rule.minPct === 50 ? "half" : rule.minPct === 100 ? "all" : `${rule.minPct}%`;
  return `${rule.minFree ?? 3}+`;
}

/** A share of the crew as a stepper shows it: "Half", "Everyone", "60%". */
export function pctLabel(pct: number): string {
  return pct === 50 ? "Half" : pct === 100 ? "Everyone" : `${pct}%`;
}

/** An event the crew watches for (BETA): the book's "Watching for" list. */
export type WatchItem = {
  spotId: string;
  query: string | null;
  title: string;
  next: { venueName: string; date: string; time: string | null; image: string | null; url: string | null; watchParty?: boolean } | null;
  addedBy: string | null;
  addedByMe: boolean;
};

const DAY_NAMES = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];

function listDays(days: number[]): string {
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "weekdays";
  const names = days.map((d) => DAY_NAMES[d]).filter(Boolean);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "12:00" → "noon", "18:30" → "6:30 PM". */
/** "Fri 11/14" for a 'YYYY-MM-DD'. */
function shortDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${wd} ${m}/${d}`;
}

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
    // "Nights" only for an evening time: noon is a daytime plan.
    : at ? `I'll aim for ${isEvening(r.preferTime || w?.earliest || w?.latest || null) ? "nights" : "plans"} ${at}` : "";
  const avoid = r.avoidDays?.length ? `I'll steer clear of ${listDays(r.avoidDays)}` : "";
  const sky = r.weather === "nice" ? "I'll check the forecast and go for a dry, nice day" : "";
  const both = [prefer, avoid, sky].filter(Boolean).join(", and ");
  const round = r.pollDates === "refreshed"
    ? " New dates are up for this round."
    : r.pollDates === "others_voted"
      ? " People already voted on this round's dates, so it starts with the next one."
      : "";
  const watch = r.watch
    ? ` Watching for ${r.watch.title}${r.watch.venueName && r.watch.date ? ` (next: ${shortDayLabel(r.watch.date)} at ${r.watch.venueName})` : ""}. Leaf asks the organizer when there's a date that works.`
    : "";
  if (both) return `Got it: ${both}.${round}${watch}`;
  if (watch) return `Got it.${watch}`;
  return `Got it. Thanks.${round}`;
}
