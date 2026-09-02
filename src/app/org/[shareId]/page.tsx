"use client";

import { useState, useRef, useEffect, useCallback, useMemo, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import Parse from "@/lib/parse-client";
import { APP_LINK_URL, SITE_URL } from "@/lib/site";
import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import JoinChatPicker from "@/components/JoinChatPicker";
import PollVoteWidget from "@/components/PollVoteWidget";
import DealsStrip, { type Deal as StripDeal } from "@/components/DealsStrip";
import LeafHostPlanThread from "@/components/LeafHostPlanThread";
import VirtualHostSheet, { DEFAULT_HOST_AVATAR, HostAvatar } from "@/components/VirtualHostSheet";
import VirtualHostBadge from "@/components/VirtualHostBadge";
import { setVerifiedUserCookie, getVerifiedUserCookie } from "@/lib/verified-user";
import { renderLinkedText } from "@/lib/linkify";
import { computeSpreadIdeaDates } from "@/lib/spread-idea-dates";
import {
  zoneOffsetSuffix,
  featuredWallClockDate,
  floatingIsoToInstant,
  tzOffsetMs,
  calendarDayVisibilityCutoff,
} from "@/lib/wall-clock";
import { AUDIENCE_COHORT_LABELS } from "@/lib/audience-cohorts";
import { isVenueBlacklisted } from "@/lib/venue-blacklist";
import { fetchVenuePhotoUrl } from "@/lib/google-places";
import {
  Plus,
  Users,
  Clock,
  Check,
  CheckCircle2,
  ArrowRight,
  Share2,
  Calendar,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  X,
  Phone,
  Sparkles,
  Loader2,
  Lock,
  MapPin,
  Megaphone,
  Settings,
  Heart,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";


// --- Types ---

interface Plan {
  id: string;
  title: string;
  date: string;
  time: string;
  /** Raw ISO timestamp from the server (used to build .ics calendar invites). */
  dateISO?: string | null;
  description: string;
  image: string;
  hostId: string | null;
  hostName: string;
  hostAvatar: string | null;
  attendeeCount: number;
  location: {
    name: string | null;
    address: string | null;
    neighborhood?: string | null;
    isPrivate?: boolean;
  } | null;
  /** Full itinerary from the server (matches getOrgCalendarPage's `locations`
   * payload). Preferred over `location` (singular) when length > 1. When
   * absent or single-item, callers should fall back to `location`. */
  locations?: {
    objectId?: string | null;
    name: string | null;
    address: string | null;
    neighborhood?: string | null;
    isPrivate?: boolean;
    timezone?: string | null;
    time?: string | null;
  }[];
  hostNote: string | null;
  requireApproval?: boolean;
  isPoll?: boolean;
  pollOptionCount?: number;
  pollVoteCount?: number;
  pollClosesAt?: string | null;
  // "Let Leaf host it" card state (spec §8). Server derives:
  //   * "leaf_arranging" — a live ConciergeProposal covers this plan;
  //     owner-private (server strips for non-owner viewers).
  //   * "leaf_hosted" — proposal has published; public "HOSTED BY LEAF ·
  //     [persona]" badge everyone sees.
  //   * absent / null — no leaf-host activity on this plan.
  leafHostState?: "leaf_arranging" | "leaf_hosted" | null;
  leafHostPersona?: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  // Owner-only: does this plan have a leaf-host chat thread the owner
  // can open? True when any leaf_host_request proposal targets it —
  // spec split: concierge is for a calendar, leaf-hosted is by plan.
  hasLeafHostChat?: boolean;
  // Owner-only: unread concierge messages in the plan-scoped thread.
  leafHostChatUnread?: number;
  // Virtual host (VIRTUAL_HOST_SPEC) — persona-fronted paid host on this plan.
  virtualHost?: boolean;
  virtualHostPersona?: { id: string; name: string | null; avatarUrl: string | null } | null;
  // Owner-only: can the owner attach a virtual host to this (host-less) plan?
  virtualHostAddable?: boolean;
}

interface PlanIdea {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  date: string | null;
  icebreakerQuestion: string | null;
  suggestedCapacity: number | null;
  centroid: string | null;
  // Public — anyone can express interest on a plan idea (same shape as
  // AI-suggested events). Server aggregates via PlanIdeaInterest.
  interestCount?: number;
  // Cohort the idea was generated for ("moms", "parents_kids", …). Null on
  // ideas generated before cohort rotation and on calendars that declare their
  // own audience — both render without a chip.
  audienceTag?: string | null;
  // "featured" marks a citywide idea that was localized onto this calendar by
  // the resolver. It is an ordinary suggestion row — the only difference is
  // that it badges as "Around the city" and pins to the top.
  sourceKind?: string | null;
  localFormat?: string | null;
  // Venue anchor for the inline card, and — when the owner picked one while
  // creating the suggestion — the venue the host modal pre-selects. Optional;
  // some ideas render with a location line, others don't.
  // `name`/`address`/`placeId`/`photoUrl` are null when the server gates the
  // venue (getOrgCalendarPage's hideIdeaVenue — on for non-owner/co-host
  // viewers whenever the calendar keeps hideVenueUntilRsvp). `neighborhood`
  // always ships, and is what the card renders in that case. Don't reintroduce
  // a client-side conditional here: gating happens server-side so the address
  // never reaches the browser at all.
  location?: {
    name: string | null;
    address: string | null;
    neighborhood?: string | null;
    isPrivate?: boolean;
    placeId?: string | null;
    photoUrl?: string | null;
    rating?: number | null;
  } | null;
  ideaSeriesId?: string | null;
  // Owner-authored suggestion — the spread preserves its intentional date
  // rather than fanning it across the calendar's cadence.
  isManual?: boolean;
  // Owner explicitly pinned the date in the editor — also preserved.
  datePinned?: boolean;
  preferredTime?: string | null;
  // --- Admin-curated "Featured" suggestion (FEATURED_SUGGESTION_SPEC) ------
  // Displaces the weakest algorithmic idea rather than adding a slot, so the
  // list length is unchanged. Renders pinned first with a badge.
  isFeatured?: boolean;
  // Pre-rendered in the VENUE's timezone, not the viewer's. A "7:30 PM ET"
  // showtime must read the same for everyone; deriving it client-side from a
  // UTC instant would silently re-anchor it to the browser's zone.
  whenLabel?: string;
  // "fixed_instant" = one shared moment. "local_wall_clock" = 7:30 in each
  // city, no single instant — so there's deliberately no UTC date to format.
  timeMode?: "fixed_instant" | "local_wall_clock";
  venueTimeZone?: string | null;
  localWallClock?: string | null;
  venueName?: string | null;
}

interface NearbyVenue {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  photoUrl: string | null;
  flagged?: boolean;
}

// Shape returned by getPlanIdeaVenueForHosting. Everything but `name` may be
// absent, and `placeId` is null for an owner-typed venue with no Google id.
interface RevealedVenueResponse {
  name?: string;
  address?: string | null;
  placeId?: string | null;
  photoUrl?: string | null;
  rating?: number | null;
}

// Stand-in placeId for a suggestion venue saved without a Google place id
// (owner-typed venues). Never sent to the server — a pick still on the
// suggested venue submits no `venue`, so the server keeps the suggestion's own
// location object and its resolved timezone.
const SUGGESTED_VENUE_ID = "__suggested__";

/**
 * The venue already attached to a suggestion, as a carousel-shaped venue.
 * Featured rows carry no `location`, so they keep the "pick a venue" flow.
 */
function suggestedVenueFor(idea: PlanIdea | null): NearbyVenue | null {
  if (!idea?.location?.name) return null;
  return {
    placeId: idea.location.placeId || SUGGESTED_VENUE_ID,
    name: idea.location.name,
    address: idea.location.address || "",
    rating: idea.location.rating ?? null,
    photoUrl: idea.location.photoUrl ?? null,
  };
}

interface OrgData {
  objectId: string;
  parentOrgId: string | null;
  name: string;
  description: string;
  profilePhoto: string | null;
  tier: string;
  brandColor: string | null;
  orgType: string | null;
  orgCity: string | null;
  memberCount: number;
  pastPlanCount: number;
  rsvpLimitReached: boolean;
  isOwner: boolean;
  isHost: boolean;
  plans: Plan[];
  planIdeas: PlanIdea[];
  hidePlanIdeas: boolean;
  hideCustomPlans: boolean;
  hideDeals: boolean;
  blacklistCategories: string[];
  excludeKeywords: string[];
  isPrivate?: boolean;
  isFollower?: boolean;
  followRequestPending?: boolean;
  requireApprovalDefault?: boolean;
  // When true, followers can Host This on Suggestion cards. Owner and
  // co-host can always host regardless of this flag.
  allowFollowersToHost?: boolean;
  // AI-adopted calendars carry the source AI events as a starter list.
  // Renders as "Suggested starter plans" until the owner creates real
  // plans. Empty/null when the calendar isn't AI-sourced.
  aiSourceEvents?:
    | {
        // Short activity headline the generator writes ("Cold Plunge &
        // Sauna") — deliberately carries no venue or neighborhood, so it's
        // safe to show before RSVP on a hideVenueUntilRsvp calendar. Null
        // on rows generated before the field existed; falls back to `name`.
        title?: string | null;
        name: string;
        time: string;
        venueLine: string;
        // Unsplash photo picked per event at generate time. Null on older
        // rows and on any event whose lookup came back empty — the card
        // falls back to the tag-on-gradient placeholder.
        imageUrl?: string | null;
        // Vibe-setting 1-sentence blurb the LLM writes per event. Null
        // on older AICalendar rows generated before this field existed;
        // the card falls back to just showing venueLine.
        description?: string | null;
        // Google Places identifier + normalized address, added at
        // grounding time. Present on events generated after the Places
        // merge started carrying them forward; null on older rows.
        placeId?: string | null;
        address?: string | null;
        tag: string;
        tagVariant?: "default" | "amber";
        isoDatetime?: string | null;
        // Present on Shape-B cadence events (e.g. "4 times over the next
        // 6 weeks") — a locked calendar date the client MUST NOT re-resolve
        // from weekday. Weekly Shape-A events leave this null and get the
        // rolling "next Friday" treatment.
        dateISO?: string | null;
        // Which cohort the plan is aimed at ("moms", "parents_kids", …).
        // Absent on rows generated before cohorts existed, and "any" when the
        // plan is deliberately open — both render without a chip.
        audienceTag?: string | null;
      }[]
    | null;
  // Per-event interest counts, keyed by eventIndex → count. Server
  // aggregates from AIEventInterest in getOrgCalendarPage so every
  // starter card can render "N interested" without a per-card query.
  aiSourceEventInterests?: Record<number, number>;
  // IANA zone for the calendar's geography. AI source events carry no
  // location object (unlike real plans, whose venue zone rides on
  // `locations[].timezone`), so this is what their times must be formatted
  // against. Null on calendars with no neighborhood — callers then fall back
  // to viewer-local, which is the pre-existing behavior.
  orgTimezone?: string | null;
  // Indices of aiSourceEvents already materialized into a live plan (hosted
  // or virtual-hosted). Skipped when rendering starter cards so a hosted
  // suggestion doesn't show twice. Positional — see server comment.
  hostedAiEventIndexes?: number[];
  // Indices the owner/co-host deleted via dismissAiSourceEvent. Server resolves
  // these from stored uids to today's positions, so they stay correct across an
  // admin reorder of the array.
  dismissedAiEventIndexes?: number[];
  // Owner-only payload for the "Let Leaf host it" band (spec §2, §6a).
  // Only present when the viewer is verified as the calendar owner
  // server-side — non-owner payloads omit this entirely so the persona
  // never leaks to a public / logged-out surface. `eligible` reflects
  // the current Config.leafHostRenderPolicy gate (NYC allowlist by
  // default, flip to open when fulfillment scales). `persona` may be
  // null when the active pool was empty at generate time; band hides.
  // `state` reflects the CalendarHosting lifecycle — Phase 1 always
  // reports "none"; later phases return "arranging" or "leaf_hosted".
  leafHost?: {
    eligible: boolean;
    persona: { id: string; name: string; avatarUrl: string | null } | null;
    state: "none" | "arranging" | "leaf_hosted";
  };
}

const AI_INTEREST_COOKIE_KEY = "leaf_interest_cookie";
const AI_INTEREST_LOCAL_KEY = "leaf_ai_event_interests";

// Same cookie pattern DealsStrip uses — one opaque id per browser,
// year-long expiry, samesite=lax. Server-side dedupe keys on this so
// a visitor can't inflate an event's interest count from a single
// device.
/**
 * Whatever we already know about this visitor, for an interest tap.
 *
 * An interest tap must never prompt for anything — that's the whole point of
 * the surface. But if this browser has already OTP-verified a phone (any web
 * RSVP, poll vote or follow sets `leaf_verified_user`), sending it along lets
 * the server resolve the tap to a real person, which is what makes "who's
 * interested, and do they follow us?" answerable at all. No cookie, no
 * identity, no prompt — the tap still counts, it just stays anonymous.
 *
 * Same precedence the page-load call uses: the follow phone in localStorage
 * first, then the verified-user cookie.
 */
function interestIdentityParams(): { name?: string; phone?: string } {
  if (typeof window === "undefined") return {};
  const cached = getVerifiedUserCookie();
  const storedPhone = localStorage.getItem("leaf_follower_phone");
  const phone = (storedPhone || cached?.phone || "").replace(/\D/g, "");
  return {
    ...(phone.length >= 10 ? { phone } : {}),
    ...(cached?.name ? { name: cached.name } : {}),
  };
}

function getOrCreateAIInterestCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`${AI_INTEREST_COOKIE_KEY}=([^;]+)`)
  );
  if (match) return match[1];
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  document.cookie = `${AI_INTEREST_COOKIE_KEY}=${random}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
  return random;
}

// Local snapshot of which (shareId, eventIndex) pairs this browser has
// already tapped interested on, so the "Interested" button renders in
// its confirmed state across reloads without a round-trip.
function markAIEventLocallyInterested(shareId: string, eventIndex: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(AI_INTEREST_LOCAL_KEY);
    const set: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    set[`${shareId}::${eventIndex}`] = true;
    localStorage.setItem(AI_INTEREST_LOCAL_KEY, JSON.stringify(set));
  } catch {
    /* quota / storage disabled */
  }
}

function isAIEventLocallyInterested(shareId: string, eventIndex: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(AI_INTEREST_LOCAL_KEY);
    if (!raw) return false;
    const set: Record<string, boolean> = JSON.parse(raw);
    return !!set[`${shareId}::${eventIndex}`];
  } catch {
    return false;
  }
}

// Sibling helpers for plan-idea interest (CalendarGeneratedPlan rows,
// not aiSourceEvents). Same shape as the AI helpers; different storage
// key so a shared browser doesn't cross-contaminate the two flows.
const PLAN_IDEA_INTEREST_LOCAL_KEY = "leaf_plan_idea_interests";
function markPlanIdeaLocallyInterested(ideaId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PLAN_IDEA_INTEREST_LOCAL_KEY);
    const set: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    set[ideaId] = true;
    localStorage.setItem(PLAN_IDEA_INTEREST_LOCAL_KEY, JSON.stringify(set));
  } catch {
    /* quota / storage disabled */
  }
}
function isPlanIdeaLocallyInterested(ideaId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(PLAN_IDEA_INTEREST_LOCAL_KEY);
    if (!raw) return false;
    const set: Record<string, boolean> = JSON.parse(raw);
    return !!set[ideaId];
  } catch {
    return false;
  }
}

// Resolve an AI-adopted event's actual date on every render so weekly
// suggestions ("Fri · 7:30 PM") roll forward as their target day
// passes. Two shapes:
//
//   Fixed-date (Ticketmaster): time string contains a month name
//   ("Sat, Sep 14 · 7:05 PM"). isoDatetime stays put. If the event has
//   already passed, we return { date: null } so the caller can hide it.
//
//   Weekly (Places / Gemini): time string is weekday + time only
//   ("Fri · 7:30 PM"). We recompute the next occurrence of that
//   weekday/time from "now" so stale isoDatetimes stored server-side
//   don't leak through.
//
// Returns { date: Date | null, isWeekly: boolean }.
//
const NO_AI_EVENT_DATE = { date: null, instant: null, isWeekly: false } as const;
//
// Returns TWO dates, and they are not interchangeable:
//   `date`    — the FLOATING wall clock (see FLOATING_EVENT_TZ). Read it with
//               UTC getters or format it in UTC; that yields the hour the
//               generator wrote, for every viewer. This is the display value.
//   `instant` — the real moment that wall clock names in the calendar's zone.
//               This is the ONLY value that may be compared to `Date.now()`.
// Conflating them is what hid an 8:30 PM Eastern card at 7:30 PM: the floating
// value is 20:30Z, which as an instant is 4:30 PM, already past the 3h grace.
function resolveAIEventDate(
  ev: {
    time?: string;
    isoDatetime?: string | null;
    dateISO?: string | null;
  },
  timeZone: string | null = null,
): { date: Date | null; instant: Date | null; isWeekly: boolean } {
  const timeStr = String(ev.time || "").trim();
  const MONTH_RX = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
  // A dateISO on the event means the server locked a specific calendar
  // date for it — Shape B cadence (e.g. "4 times over 6 weeks"), or the
  // month-named Ticketmaster branch. Trust it; do NOT re-resolve to
  // "next Friday" from today.
  const isFixedDate = MONTH_RX.test(timeStr) || !!(ev.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(ev.dateISO));

  if (isFixedDate) {
    if (!ev.isoDatetime) return NO_AI_EVENT_DATE;
    const d = new Date(ev.isoDatetime);
    if (Number.isNaN(d.getTime())) return NO_AI_EVENT_DATE;
    // Hide past fixed-date events (that game is over, that concert
    // already happened) — the list should stay actionable. Anchored to the
    // calendar's zone: the floating value is hours off as an instant, and
    // comparing it raw retired each card early by exactly that offset. Same
    // cutoff the server uses for real plans, so a card and the plan it becomes
    // leave the page together.
    const instant = floatingIsoToInstant(ev.isoDatetime, timeZone) ?? d;
    if (instant.getTime() <= calendarDayVisibilityCutoff(timeZone).getTime())
      return NO_AI_EVENT_DATE;
    return { date: d, instant, isWeekly: false };
  }

  // Weekly path — parse weekday + time from the display string and
  // resolve to the next occurrence.
  const WEEKDAYS: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, weds: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6,
  };
  const weekdayMatch = timeStr
    .toLowerCase()
    .match(/\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/);
  if (!weekdayMatch) {
    // No weekday in the string — fall back to the stored isoDatetime.
    if (!ev.isoDatetime) return NO_AI_EVENT_DATE;
    const d = new Date(ev.isoDatetime);
    if (Number.isNaN(d.getTime())) return NO_AI_EVENT_DATE;
    return {
      date: d,
      instant: floatingIsoToInstant(ev.isoDatetime, timeZone) ?? d,
      isWeekly: true,
    };
  }
  const targetDow = WEEKDAYS[weekdayMatch[1]];

  const timeMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/i);
  if (!timeMatch) return NO_AI_EVENT_DATE;
  let hour = parseInt(timeMatch[1], 10);
  const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const meridiem = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59)
    return NO_AI_EVENT_DATE;

  // "Which day is next Friday" is a question about the CALENDAR's clock, not
  // the viewer's: a Pacific reader at 11 PM Tuesday is already Wednesday in
  // Brooklyn and would otherwise resolve a week off. Shifting `now` by the
  // zone offset lets the UTC getters read as that calendar's wall clock.
  const now = new Date();
  const offsetMs = timeZone
    ? tzOffsetMs(now, timeZone)
    : -now.getTimezoneOffset() * 60 * 1000;
  const nowWall = new Date(now.getTime() + offsetMs);
  const currentDow = nowWall.getUTCDay();
  let daysUntil = (targetDow - currentDow + 7) % 7;
  if (daysUntil === 0) {
    const nowHour = nowWall.getUTCHours();
    const nowMin = nowWall.getUTCMinutes();
    if (hour < nowHour || (hour === nowHour && minute <= nowMin)) daysUntil = 7;
  }
  const targetWall = new Date(nowWall.getTime() + daysUntil * 24 * 60 * 60 * 1000);
  // Built as a floating value (wall clock stamped UTC) so it renders through
  // FLOATING_EVENT_TZ identically to the fixed-date branch. The old code
  // returned a browser-local Date here, which the UTC formatter then shifted
  // by the viewer's offset — weekly cards showed the wrong hour.
  const date = new Date(
    Date.UTC(
      targetWall.getUTCFullYear(),
      targetWall.getUTCMonth(),
      targetWall.getUTCDate(),
      hour,
      minute,
      0,
      0,
    ),
  );
  return {
    date,
    instant: floatingIsoToInstant(date.toISOString(), timeZone) ?? date,
    isWeekly: true,
  };
}


// Maps human-readable blacklist labels (set in the org dashboard) to Google
// Loose substring match — `orgType` values aren't enum-locked, and many
// legacy calendars were created before the picker existed (so `orgType` is
// null). Also scan the calendar name + description for common apartment
// signals so legacy buildings still render the compact deals strip without
// requiring a backfill.
function isApartmentOrgType(
  orgType: string | null | undefined,
  name?: string | null,
  description?: string | null
): boolean {
  const blob = [orgType, name, description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!blob) return false;
  return /apartment|residential|\bcondo\b|\bbuilding\b|\blofts?\b|\btowers?\b|\bresidences?\b|\bresidents?\b|\btenants?\b|\bhoa\b|\bhangouts?\b/i.test(
    blob
  );
}

// --- Helpers ---

// Format in the venue's IANA zone when known — a Bangkok viewer reading a
// NYC plan should see NYC's wall-clock, not their own. Falls through to
// viewer-local when no tz is supplied (legacy plans, missing venue data).
/**
 * AI source events store a FLOATING wall-clock, not an instant: the server
 * builds isoDatetime as `${dateISO}T${hh}:${mm}:00Z` (ai-calendar-functions.js),
 * stamping the venue's wall-clock with a Z it never earned. "Wed 8:30 AM"
 * becomes 08:30Z.
 *
 * So these must be read back in UTC, which returns the exact wall-clock the
 * generator wrote — 8:30 AM to every viewer, anywhere. Localizing them instead
 * (the previous behavior) shifted the time by the VIEWER's offset: a Pacific
 * reader saw a Brooklyn 8:30 AM event as 1:30 AM. Formatting in the venue's
 * real zone is equally wrong here — that yields 4:30 AM — because the stored
 * instant is not a true instant.
 *
 * Floating is the right model for these: a template generated for one prompt
 * is cached and reused across cities, so "Wed 8:30 AM" has to mean 8:30 local
 * wherever it lands. Real plans are different — they carry a genuine instant
 * plus their venue's IANA zone, and go through formatDate/formatTime with it.
 */
const FLOATING_EVENT_TZ = "UTC";

function formatDate(isoDate: string, timezone: string | null = null): string {
  const date = new Date(isoDate);
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "short",
    day: "numeric",
  };
  if (timezone) opts.timeZone = timezone;
  return date.toLocaleDateString("en-US", opts);
}

function formatTime(isoDate: string, timezone: string | null = null): string {
  const date = new Date(isoDate);
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  if (timezone) opts.timeZone = timezone;
  return date.toLocaleTimeString("en-US", opts);
}

/** Normalize a time string to 12-hour format (e.g. "19:00" → "7:00 PM") */
function normalizeTimeString(time: string): string {
  // Already in 12-hour format like "7:00 PM"
  if (/[APap][Mm]/.test(time)) return time;
  // 24-hour format like "19:00"
  const [h, m] = time.split(":").map(Number);
  if (isNaN(h)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")} ${period}`;
}

// Build an iCalendar (.ics) data URL for a plan. Imports cleanly into Apple
// Calendar (iOS/macOS), Outlook, Google Calendar (via download), and the
// default calendar app on Android/Windows.
//
// Link to the server-rendered .ics endpoint rather than a `data:` URL — iOS
// Safari only opens the Calendar "add event" sheet when the response comes
// over HTTP with `Content-Type: text/calendar`. Data URLs trigger a download
// instead. Server route lives at src/app/api/ics/route.ts and owns all the
// timezone/format handling (floating time, etc.).
function buildIcsHref(opts: {
  uid: string;
  title: string;
  dateISO: string;
  time?: string | null;
  durationHours?: number;
  description?: string;
  locationName?: string | null;
  locationAddress?: string | null;
  url?: string;
}): string | null {
  if (Number.isNaN(new Date(opts.dateISO).getTime())) return null;
  const sp = new URLSearchParams();
  sp.set("uid", opts.uid);
  sp.set("title", opts.title);
  sp.set("dateISO", opts.dateISO);
  if (opts.time) sp.set("time", opts.time);
  if (opts.durationHours != null) sp.set("durationHours", String(opts.durationHours));
  if (opts.description) sp.set("description", opts.description);
  if (opts.locationName) sp.set("locationName", opts.locationName);
  if (opts.locationAddress) sp.set("locationAddress", opts.locationAddress);
  if (opts.url) sp.set("url", opts.url);
  return `/api/ics?${sp.toString()}`;
}

// --- Components ---

function AvatarStack({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-3 overflow-hidden">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white">
          <Users className="w-3.5 h-3.5 text-zinc-500" />
        </div>
      </div>
      <span className="text-xs tracking-widest uppercase font-bold text-zinc-400">
        {count} Attending
      </span>
    </div>
  );
}

function RsvpModal({
  plan,
  onClose,
  brandColor,
  onRsvpSuccess,
  existingNotificationId,
  calendarId,
  calendarName,
  isFollowingCalendar,
  followRequestPending: followRequestPendingProp,
  isPrivateCalendar,
  onFollowedCalendar,
}: {
  plan: Plan;
  brandColor?: string;
  onClose: () => void;
  onRsvpSuccess?: (planId: string, alreadyRsvpd: boolean, pendingApproval?: boolean) => void;
  existingNotificationId?: string | null;
  calendarId?: string;
  calendarName?: string;
  isFollowingCalendar?: boolean;
  followRequestPending?: boolean;
  isPrivateCalendar?: boolean;
  onFollowedCalendar?: (pending: boolean) => void;
}) {
  const verify = usePhoneVerify();
  const [formStep, setFormStep] = useState<"form" | "submitting" | "success" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [notificationId, setNotificationId] = useState<string | null>(existingNotificationId || null);
  const [rsvpNote, setRsvpNote] = useState("");
  const [isPendingResult, setIsPendingResult] = useState(false);
  const [isWaitlistResult, setIsWaitlistResult] = useState(false);
  const [sharePhone, setSharePhone] = useState(true);
  const [followState, setFollowState] = useState<"idle" | "following" | "done" | "pending">(
    isFollowingCalendar ? "done" : followRequestPendingProp ? "pending" : "idle"
  );
  const [followError, setFollowError] = useState("");
  // Inline follow-on-RSVP toggle — only meaningful when the calendar
  // isn't already followed and there's no pending request. Default true
  // so a non-follower attendee joins the calendar in the same click,
  // instead of having to spot the post-success upsell button below.
  const canOfferInlineFollow =
    Boolean(calendarId) &&
    Boolean(calendarName) &&
    !isFollowingCalendar &&
    !followRequestPendingProp;
  const [alsoFollow, setAlsoFollow] = useState(true);

  const handleFollowCalendar = async () => {
    if (!calendarId || !verify.isVerified) return;
    setFollowError("");
    setFollowState("following");
    try {
      const result = await Parse.Cloud.run("followCalendarViaWeb", {
        calendarId,
        name: verify.name,
        phoneNumber: verify.phone.replace(/\D/g, ""),
      }) as { alreadyFollowing?: boolean; pending?: boolean } | null | undefined;
      setFollowerCookie(calendarId, verify.name, verify.phone);
      const pending = result?.pending === true;
      setFollowState(pending ? "pending" : "done");
      onFollowedCalendar?.(pending);
    } catch (err: unknown) {
      setFollowError(err instanceof Error ? err.message : "Could not follow. Please try again.");
      setFollowState("idle");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verify.isVerified) return;
    setFormStep("submitting");
    try {
      const result = await Parse.Cloud.run("rsvpToPlanViaWeb", {
        phoneNumber: verify.phone.replace(/\D/g, ""),
        name: verify.name,
        eventGroupId: plan.id,
        rsvpNote: plan.requireApproval && rsvpNote.trim() ? rsvpNote.trim() : undefined,
        sharePhoneWithHost: sharePhone,
      }) as { eventNotificationId?: string; alreadyRsvpd?: boolean; pendingApproval?: boolean; waitlisted?: boolean } | null | undefined;
      console.log("[RSVP] result:", result);
      setVerifiedUserCookie(verify.name, verify.phone);
      if (result?.eventNotificationId) {
        setNotificationId(result.eventNotificationId);
        // Mint a Parse session for the phone-user so /chat/[eventGroupId]
        // can authenticate. Failure here is non-fatal — the user still sees
        // the success state; they just won't be able to load the web chat
        // until they complete Google SSO from the JoinChatPicker.
        try {
          const session = (await Parse.Cloud.run("getRsvpSession", {
            eventNotificationId: result.eventNotificationId,
            phoneNumber: verify.phone.replace(/\D/g, ""),
          })) as { sessionToken?: string };
          if (session?.sessionToken) {
            await Parse.User.become(session.sessionToken);
          }
        } catch (sessionErr) {
          console.warn("[RSVP] Could not mint chat session:", sessionErr);
        }
      }
      if (result?.pendingApproval || result?.waitlisted) {
        setIsPendingResult(true);
      }
      if (result?.waitlisted) setIsWaitlistResult(true);
      onRsvpSuccess?.(plan.id, result?.alreadyRsvpd === true, result?.pendingApproval || result?.waitlisted);
      setFormStep("success");
      // Fire the follow-along after the success state transitions so the
      // inline followState UI ("Following…" → "Following {name}") reads
      // naturally on the success screen. Only fires when the checkbox
      // was left on AND we still qualify (canOfferInlineFollow guards
      // against calling for an already-followed calendar). Fully
      // fire-and-forget — handleFollowCalendar has its own error state
      // and never throws.
      if (alsoFollow && canOfferInlineFollow) {
        void handleFollowCalendar();
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to RSVP. Please try again.");
      setFormStep("error");
    }
  };

  // Widen the modal once we're past the form so the JoinChatPicker can lay
  // its two options out side-by-side on desktop. Form step stays narrow so
  // the input fields aren't awkwardly stretched.
  const isJoinPickerStep = formStep === "success" && !isPendingResult && Boolean(notificationId);
  const maxWidthClass = isJoinPickerStep ? "max-w-3xl" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm overflow-y-auto">
      <div
        className={`bg-white w-full ${maxWidthClass} rounded-t-2xl md:rounded-2xl p-8 md:p-12 relative my-0 md:my-8`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>

        {formStep === "form" || formStep === "submitting" ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-light tracking-tight">
                {plan.requireApproval ? "Request to Attend" : "RSVP for"} {plan.title}
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                {plan.date}{plan.time ? ` at ${plan.time}` : ""}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <PhoneVerifyFields verify={verify} onSendOTP={verify.sendOTP} />
              {verify.isVerified && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sharePhone}
                    onChange={(e) => setSharePhone(e.target.checked)}
                    className="w-4 h-4 accent-zinc-900 rounded"
                  />
                  <span className="text-xs text-zinc-600">Share phone number with host</span>
                </label>
              )}
              {verify.isVerified && canOfferInlineFollow && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={alsoFollow}
                    onChange={(e) => setAlsoFollow(e.target.checked)}
                    className="w-4 h-4 accent-zinc-900 rounded"
                  />
                  <span className="text-xs text-zinc-600">
                    {isPrivateCalendar
                      ? `Also request to follow ${calendarName || "this calendar"}`
                      : `Also follow ${calendarName || "this calendar"} for new plans`}
                  </span>
                </label>
              )}
              {plan.requireApproval && (
                <div>
                  <label className="text-xs font-medium text-zinc-700 block mb-1">Note for the host (optional)</label>
                  <textarea
                    value={rsvpNote}
                    onChange={(e) => setRsvpNote(e.target.value)}
                    maxLength={200}
                    rows={2}
                    className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                    placeholder="Tell the host a bit about yourself..."
                  />
                  <p className="text-xs text-zinc-400 text-right mt-0.5">{rsvpNote.length}/200</p>
                </div>
              )}
              <button
                type="submit"
                disabled={formStep === "submitting" || !verify.isVerified || !verify.name}
                className="w-full text-white py-3.5 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: brandColor || "#18181b" }}
              >
                {formStep === "submitting" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : plan.requireApproval ? (
                  <>Submit Request <ArrowRight className="w-4 h-4" /></>
                ) : (
                  <>Confirm RSVP <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          </div>
        ) : formStep === "error" ? (
          <div className="py-8 text-center space-y-6">
            <p className="text-red-600 text-sm">{errorMsg}</p>
            <button
              onClick={() => setFormStep("form")}
              className="text-sm text-zinc-500 hover:text-zinc-900 underline"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-5">
            <div className={`w-14 h-14 border ${isPendingResult ? "border-amber-500" : "border-zinc-900"} rounded-full flex items-center justify-center mx-auto`}>
              {isPendingResult ? <Clock className="w-7 h-7 text-amber-500" /> : <CheckCircle2 className="w-7 h-7" />}
            </div>
            <div>
              <h4 className="text-2xl font-light mb-2">
                {isWaitlistResult ? "You\u0027re on the waitlist!" : isPendingResult ? "Request Sent!" : "You\u0027re in!"}
              </h4>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                {isWaitlistResult
                  ? "You\u0027ll receive a text the moment a spot opens up."
                  : isPendingResult
                    ? "You\u0027ll receive a text when your request is approved."
                    : "Coordinate with the group. Join the Plan Chat."}
              </p>
            </div>

            {!isPendingResult && notificationId && (
              <div className="pt-2">
                <JoinChatPicker
                  eventGroupId={plan.id}
                  eventNotificationId={notificationId}
                  brandColor={brandColor}
                  onError={(msg) => setErrorMsg(msg)}
                />
              </div>
            )}

            {!isPendingResult && !notificationId && (
              <Link
                href={`/chat/${plan.id}`}
                className="flex items-center justify-center gap-2 w-full text-white py-3 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 rounded-lg"
                style={{ backgroundColor: brandColor || "#18181b" }}
              >
                <MessageCircle className="w-4 h-4" /> Join Plan Chat
              </Link>
            )}

            {!isPendingResult && plan.dateISO && (() => {
              const icsUrl = buildIcsHref({
                uid: plan.id,
                title: plan.title,
                dateISO: plan.dateISO,
                time: plan.time,
                description: plan.description,
                locationName: plan.location?.isPrivate ? null : plan.location?.name,
                locationAddress: plan.location?.isPrivate ? null : plan.location?.address,
                url: typeof window !== "undefined" ? `${window.location.origin}/p/${plan.id}` : undefined,
              });
              if (!icsUrl) return null;
              return (
                <a
                  href={icsUrl}
                  className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-3 text-xs uppercase tracking-wider font-bold hover:bg-zinc-50 transition-colors rounded-lg"
                >
                  <Calendar className="w-4 h-4" />
                  Add to Calendar
                </a>
              );
            })()}

            {calendarId && calendarName && followState === "idle" && (
              <div className="pt-1">
                <button
                  onClick={handleFollowCalendar}
                  className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-3 text-xs uppercase tracking-wider font-bold hover:bg-zinc-50 transition-colors rounded-lg"
                >
                  <Heart className="w-4 h-4" />
                  {isPrivateCalendar ? `Request to Follow ${calendarName}` : `Follow ${calendarName}`}
                </button>
                <p className="text-[11px] text-zinc-400 mt-1.5">
                  Get notified when new plans are added.
                </p>
                {followError && (
                  <p className="text-[11px] text-red-500 mt-1.5">{followError}</p>
                )}
              </div>
            )}

            {calendarId && calendarName && followState === "following" && (
              <div className="pt-1">
                <div className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-3 text-xs uppercase tracking-wider font-bold rounded-lg opacity-60">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Following…
                </div>
              </div>
            )}

            {calendarName && followState === "done" && (
              <div className="pt-1">
                <div className="flex items-center justify-center gap-2 w-full border border-emerald-200 bg-emerald-50 text-emerald-700 py-3 text-xs uppercase tracking-wider font-bold rounded-lg">
                  <Check className="w-4 h-4" />
                  Following {calendarName}
                </div>
              </div>
            )}

            {calendarName && followState === "pending" && (
              <div className="pt-1">
                <div className="flex items-center justify-center gap-2 w-full border border-amber-200 bg-amber-50 text-amber-700 py-3 text-xs uppercase tracking-wider font-bold rounded-lg">
                  <Clock className="w-4 h-4" />
                  Follow Request Pending
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="text-sm text-zinc-400 hover:text-zinc-900"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Cookie Helpers ---

// Keep legacy follower cookie for backward compat
function setFollowerCookie(calendarId: string, name: string, phone: string) {
  const data = JSON.stringify({ calendarId, name, phone });
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_follower=${encodeURIComponent(data)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getFollowerCookie(): { calendarId: string; name: string; phone: string } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/leaf_follower=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

// --- RSVP cookie helpers ---
function getRsvpCookieIds(): string[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie.match(/leaf_rsvps=([^;]+)/);
  if (!match) return [];
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return [];
  }
}

function addRsvpCookie(eventGroupId: string) {
  const ids = getRsvpCookieIds();
  if (!ids.includes(eventGroupId)) ids.push(eventGroupId);
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_rsvps=${encodeURIComponent(JSON.stringify(ids))}; expires=${expires}; path=/; SameSite=Lax`;
}

function removeRsvpCookie(eventGroupId: string) {
  const ids = getRsvpCookieIds().filter((id) => id !== eventGroupId);
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_rsvps=${encodeURIComponent(JSON.stringify(ids))}; expires=${expires}; path=/; SameSite=Lax`;
}

// --- Pending RSVP cookie helpers ---
function getPendingRsvpCookieIds(): string[] {
  if (typeof document === "undefined") return [];
  const match = document.cookie.match(/leaf_pending_rsvps=([^;]+)/);
  if (!match) return [];
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return [];
  }
}

function addPendingRsvpCookie(eventGroupId: string) {
  const ids = getPendingRsvpCookieIds();
  if (!ids.includes(eventGroupId)) ids.push(eventGroupId);
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_pending_rsvps=${encodeURIComponent(JSON.stringify(ids))}; expires=${expires}; path=/; SameSite=Lax`;
}

function removePendingRsvpCookie(eventGroupId: string) {
  const ids = getPendingRsvpCookieIds().filter((id) => id !== eventGroupId);
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `leaf_pending_rsvps=${encodeURIComponent(JSON.stringify(ids))}; expires=${expires}; path=/; SameSite=Lax`;
}

// --- Shared phone format helper ---
function formatPhoneNumber(value: string) {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

// --- Phone Verify Hook ---
function usePhoneVerify(options?: { requireSession?: boolean }) {
  const cached = getVerifiedUserCookie();
  const [name, setName] = useState(cached?.name || "");
  const [phone, setPhone] = useState(cached?.phone || "");
  const [code, setCode] = useState("");
  // The cookie proves a phone, not an account. Callers whose cloud function
  // calls requireUser pass requireSession, so a cached cookie can't skip OTP
  // here — only verifyOTP mints the session token those writes need. Name and
  // phone still prefill either way.
  const [step, setStep] = useState<"phone" | "code" | "verified">(
    cached && !options?.requireSession ? "verified" : "phone"
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // Exposed for callers that need a real Parse session, not just the phone
  // cookie — `requireUser` cloud functions won't accept the cookie identity.
  // Additive: existing callers ignore it and keep their cookie-only behavior.
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const isVerified = step === "verified";

  const sendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setError("Please enter a valid phone number."); return; }
    setSending(true);
    setError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally { setSending(false); }
  };

  const verifyOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    setSending(true);
    setError("");
    try {
      const result = await Parse.Cloud.run("verifyOTP", { phone: `+1${digits}`, code });
      if (result && typeof result === "object" && result.sessionToken) {
        setStep("verified");
        setSessionToken(result.sessionToken as string);
        setVerifiedUserCookie(name, phone);
      } else {
        setError("Invalid code. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally { setSending(false); }
  };

  const reset = () => {
    setStep("phone");
    setCode("");
    setError("");
  };

  return { name, setName, phone, setPhone, code, setCode, step, isVerified, sending, setSending, error, sendOTP, verifyOTP, reset, sessionToken };
}

// --- Shared Phone Verify Fields Component ---

function PhoneVerifyFields({ verify, onSendOTP }: { verify: ReturnType<typeof usePhoneVerify>; onSendOTP?: () => void }) {
  return (
    <>
      <div className="space-y-2">
        <label className="text-xs tracking-wider uppercase font-bold">
          Your Name
        </label>
        <input
          type="text"
          required
          value={verify.name}
          onChange={(e) => verify.setName(e.target.value)}
          placeholder="Full name"
          disabled={verify.isVerified}
          className="w-full border-b border-zinc-300 py-3 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors disabled:text-zinc-500"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs tracking-wider uppercase font-bold">
          Phone Number
        </label>
        {verify.step === "phone" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center flex-1 border-b border-zinc-300 focus-within:border-zinc-900 transition-colors">
              <Phone className="w-4 h-4 text-zinc-400 mr-2" />
              <input
                type="tel"
                required
                value={verify.phone}
                onChange={(e) => verify.setPhone(formatPhoneNumber(e.target.value))}
                placeholder="555-555-5555"
                className="w-full py-3 text-lg font-light focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onSendOTP || verify.sendOTP}
              disabled={verify.sending || verify.phone.replace(/\D/g, "").length < 10 || !verify.name}
              className="px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {verify.sending ? "Sending..." : "Verify"}
            </button>
          </div>
        )}
        {verify.step === "code" && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">Enter the 6-digit code sent to {verify.phone}</p>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verify.code}
                onChange={(e) => verify.setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="flex-1 border-b border-zinc-300 py-3 text-lg font-light tracking-[0.5em] text-center focus:outline-none focus:border-zinc-900 transition-colors"
              />
              <button
                type="button"
                onClick={verify.verifyOTP}
                disabled={verify.sending || verify.code.length < 6}
                className="px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {verify.sending ? "Checking..." : "Confirm"}
              </button>
            </div>
            <button
              type="button"
              onClick={verify.reset}
              className="text-xs text-zinc-400 hover:text-zinc-900 underline"
            >
              Change number
            </button>
          </div>
        )}
        {verify.step === "verified" && (
          <div className="flex items-center gap-2 py-3">
            <Check className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-600 font-medium">{verify.phone} verified</span>
          </div>
        )}
        {verify.error && (
          <p className="text-xs text-red-500 mt-1">{verify.error}</p>
        )}
      </div>
    </>
  );
}

// --- Cancel RSVP Modal (requires OTP when user hasn't verified in this session) ---

function CancelRsvpModal({
  planId,
  planTitle,
  onClose,
  onCancelled,
}: {
  planId: string;
  planTitle: string;
  onClose: () => void;
  onCancelled: (planId: string) => void;
}) {
  const verify = usePhoneVerify();
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const handleCancel = async () => {
    if (!verify.isVerified) return;
    setCancelling(true);
    setError("");
    try {
      await Parse.Cloud.run("cancelRsvpViaWeb", {
        phoneNumber: verify.phone.replace(/\D/g, ""),
        eventGroupId: planId,
      });
      setVerifiedUserCookie(verify.name, verify.phone);
      onCancelled(planId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel RSVP.");
      setCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-none p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-light tracking-tight">Cancel RSVP</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Verify your phone to cancel your RSVP for {planTitle}
            </p>
          </div>
          <PhoneVerifyFields verify={verify} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleCancel}
            disabled={!verify.isVerified || cancelling}
            className="w-full border border-red-200 text-red-600 py-3.5 text-xs uppercase tracking-wider font-bold hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Cancellation"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Featured Interest Modal ---

/**
 * Interest on an "Around the city" featured suggestion can't ride the cookie
 * path the way plan-idea interest does: `expressFeaturedInterest` calls
 * `requireUser`, because the interest row feeds cohort matching and needs a
 * real account rather than a browser cookie. So an anonymous visitor verifies
 * by phone here, we `become` the session that mints, and only then write.
 */
function FeaturedInterestModal({
  suggestionId,
  suggestionTitle,
  onClose,
  onInterested,
}: {
  suggestionId: string;
  suggestionTitle: string;
  onClose: () => void;
  onInterested: (suggestionId: string, interestCount: number | null) => void;
}) {
  // requireSession: expressFeaturedInterest calls requireUser, so a cached
  // phone cookie can't stand in for a session — only OTP mints one. Setting it
  // at the initial state (rather than correcting in an effect) means the modal
  // never paints a "verified" frame it has to take back.
  const verify = usePhoneVerify({ requireSession: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (!verify.isVerified) return;
    setSaving(true);
    setError("");
    try {
      // The cookie alone won't satisfy requireUser — adopt the session the
      // OTP minted before calling. A cached session from a *different*
      // identity would otherwise write the interest to the wrong account.
      if (verify.sessionToken) {
        await Parse.User.become(verify.sessionToken);
      }
      const result = (await Parse.Cloud.run("expressFeaturedInterest", {
        suggestionId,
      })) as { interestCount?: number; alreadyInterested?: boolean };
      setVerifiedUserCookie(verify.name, verify.phone);
      onInterested(
        suggestionId,
        typeof result?.interestCount === "number" ? result.interestCount : null
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Couldn't save your interest."
      );
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-none p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="space-y-6">
          <div>
            <h3 className="text-2xl font-light tracking-tight">
              Count me in
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              Verify your phone so we can tell you when someone hosts{" "}
              {suggestionTitle}.
            </p>
          </div>
          <PhoneVerifyFields verify={verify} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleConfirm}
            disabled={!verify.isVerified || saving}
            className="w-full bg-zinc-900 text-white py-3.5 text-xs uppercase tracking-wider font-bold hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "I'm Interested"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Follow Modal ---

function FollowModal({
  calendarId,
  calendarName,
  onClose,
  onFollowed,
  brandColor,
  isPrivate,
}: {
  calendarId: string;
  calendarName: string;
  brandColor?: string;
  onClose: () => void;
  onFollowed: (name: string, phone: string, pending?: boolean) => void;
  isPrivate?: boolean;
}) {
  const verify = usePhoneVerify();
  const [formStep, setFormStep] = useState<"form" | "submitting" | "success" | "pending" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verify.isVerified) return;
    setFormStep("submitting");
    try {
      const followResult = await Parse.Cloud.run("followCalendarViaWeb", {
        calendarId,
        name: verify.name,
        phoneNumber: verify.phone.replace(/\D/g, ""),
      });
      setFollowerCookie(calendarId, verify.name, verify.phone);
      setVerifiedUserCookie(verify.name, verify.phone);
      localStorage.setItem("leaf_follower_phone", verify.phone.replace(/\D/g, ""));
      if (followResult.pending) {
        onFollowed(verify.name, verify.phone, true);
        setFormStep("pending");
      } else {
        onFollowed(verify.name, verify.phone, false);
        setFormStep("success");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to follow. Please try again.");
      setFormStep("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-t-2xl md:rounded-none p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>

        {formStep === "form" || formStep === "submitting" ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-light tracking-tight">
                {isPrivate ? "Request to Follow" : "Follow"} {calendarName}
              </h3>
              <p className="text-sm text-zinc-500 mt-1">
                {isPrivate
                  ? "This is a private calendar. The host will review your request."
                  : "Get notified about new plans and events."}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <PhoneVerifyFields verify={verify} />
              <button
                type="submit"
                disabled={formStep === "submitting" || !verify.isVerified || !verify.name}
                className="w-full text-white py-3 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: brandColor || "#18181b" }}
              >
                {formStep === "submitting" ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : isPrivate ? (
                  "Request to Follow"
                ) : (
                  "Follow"
                )}
              </button>
            </form>
          </div>
        ) : formStep === "success" ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-light">You&apos;re following!</h3>
            <p className="text-sm text-zinc-500">
              You&apos;ll be notified about new plans from {calendarName}.
            </p>
            <button
              onClick={onClose}
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900"
            >
              Done
            </button>
          </div>
        ) : formStep === "pending" ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-light">Request Sent!</h3>
            <p className="text-sm text-zinc-500">
              The host will review your request. You&apos;ll receive a text when approved.
            </p>
            <button
              onClick={onClose}
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <p className="text-red-600 text-sm">{errorMsg}</p>
            <button
              onClick={() => setFormStep("form")}
              className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Page ---

export default function OrgCalendarPage() {
  const params = useParams();
  const shareId = params.shareId as string;
  const router = useRouter();

  const [org, setOrg] = useState<OrgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Plan | null>(null);
  const [rsvpPlan, setRsvpPlan] = useState<Plan | null>(null);
  const [hostingIdea, setHostingIdea] = useState<PlanIdea | null>(null);
  // "needs a host" ideas are capped in-line so they never bury confirmed
  // plans; the rest expand behind a show-more toggle.
  const [showAllIdeas, setShowAllIdeas] = useState(false);
  // Must live up here with the other hooks, not beside the tab UI it drives:
  // the loading and error branches below return early, so a hook declared
  // after them is skipped on the first render and called on the second, which
  // is React error #310 ("rendered more hooks than during the previous render").
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  // Free-text venue search when hosting a suggested plan — lets the hoster
  // pick a venue the AI didn't surface. A non-owner's choice still routes
  // through owner/co-host approval (server holds it pending).
  const [venueSearchQuery, setVenueSearchQuery] = useState("");
  // Per-plan leaf-host chat drawer. Non-null = planId of the open
  // drawer. Owner-only render — the pill that sets this state only
  // renders when server surfaced hasLeafHostChat=true.
  const [leafHostChatPlanId, setLeafHostChatPlanId] = useState<string | null>(null);
  // Owner-only: the target the owner is attaching a virtual host to — either a
  // published host-less plan (eventGroupId) or an AI starter suggestion
  // (aiEventIndex, materialized into a plan on attach).
  const [virtualHostPlan, setVirtualHostPlan] = useState<
    { calendarId: string; eventGroupId?: string; planIdeaId?: string; aiEventIndex?: number } | null
  >(null);
  // Real, current persona avatar for the "Add virtual host" button (server-
  // provided; seed URLs go stale).
  const [virtualHostAvatar, setVirtualHostAvatar] = useState<string | null>(null);
  const [hostSuccess, setHostSuccess] = useState<boolean | "pending">(false);
  const [hostSubmitting, setHostSubmitting] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);
  const [hostNote, setHostNote] = useState("");
  const [hostEmail, setHostEmail] = useState("");
  const [hostRequireApproval, setHostRequireApproval] = useState(false);
  const hostVerify = usePhoneVerify();
  const [nearbyVenues, setNearbyVenues] = useState<NearbyVenue[]>([]);
  const [venuesLoading, setVenuesLoading] = useState(false);
  // Cover photo for the hosting suggestion's own venue — saved venues store no
  // photo, so we look one up from Places when the host modal opens.
  const [ideaVenuePhotoUrl, setIdeaVenuePhotoUrl] = useState<string | null>(null);
  // The organizer's venue for a gated idea, fetched on demand when the host
  // modal opens (getOrgCalendarPage redacts it for non-owners, so it is never
  // in the page payload). Null until it arrives, or when the idea has none.
  const [revealedVenue, setRevealedVenue] = useState<NearbyVenue | null>(null);
  // Which idea the in-flight reveal belongs to, so a slow response can't land
  // on a modal the user has since closed or reopened on a different idea.
  const revealRequestRef = useRef<string | null>(null);
  // The idea's own venue, with the redacted case filled in by the on-demand
  // reveal. EVERY consumer must read this rather than calling
  // suggestedVenueFor directly: the pinned carousel card, the pre-selection,
  // and the "did the host change the venue?" submit check have to agree on
  // one answer, and for a non-owner that answer only exists after the fetch.
  const hostSuggestedVenue = useMemo(
    () => suggestedVenueFor(hostingIdea) ?? revealedVenue,
    [hostingIdea, revealedVenue],
  );
  const [selectedVenue, setSelectedVenue] = useState<NearbyVenue | null>(null);
  // Custom plan creation state
  const [creatingCustomPlan, setCreatingCustomPlan] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  // True when the custom-plan modal was opened by tapping a deal card. Hides
  // the "Or host one of these ideas" carousel since the user has already
  // committed to a specific venue and intent.
  const [customFromDeal, setCustomFromDeal] = useState(false);
  const [customDescription, setCustomDescription] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customCapacity, setCustomCapacity] = useState("");
  // Prefill for the date/time inputs, which are uncontrolled. Set when the
  // custom-plan modal is opened from an AI suggestion the visitor wants to
  // change before proposing; "" leaves the inputs empty as before.
  const [customPrefillDate, setCustomPrefillDate] = useState("");
  const [customPrefillTime, setCustomPrefillTime] = useState("");
  const [customSubmitting, setCustomSubmitting] = useState(false);
  const [customSuccess, setCustomSuccess] = useState<false | true | "published">(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [unsplashPhotos, setUnsplashPhotos] = useState<{ id: string; url: string; thumbUrl: string; alt: string; photographerName: string; photographerUrl: string }[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [customRequireApproval, setCustomRequireApproval] = useState(false);
  const customVerify = usePhoneVerify();
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctaSectionRef = useRef<HTMLDivElement>(null);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followRequestPending, setFollowRequestPending] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [showFollowPopup, setShowFollowPopup] = useState(false);
  const [followPopupLoading, setFollowPopupLoading] = useState(false);
  const [showPlanIdeaPopup, setShowPlanIdeaPopup] = useState(false);
  const [popupIdea, setPopupIdea] = useState<PlanIdea | null>(null);
  const [isInactive, setIsInactive] = useState<{ name: string } | null>(null);
  const [showHostLogin, setShowHostLogin] = useState(false);
  const [parseUser, setParseUser] = useState<Parse.User | null>(null);
  const [showWelcomeInvite, setShowWelcomeInvite] = useState(false);
  // AI-event interest state — optimistic client-side counts + local
  // "already interested" set. Merges with server counts from
  // org.aiSourceEventInterests on render.
  const [aiInterestCounts, setAIInterestCounts] = useState<Record<number, number>>({});
  const [aiLocallyInterested, setAILocallyInterested] = useState<Set<number>>(new Set());
  const [aiInterestPending, setAIInterestPending] = useState<Set<number>>(new Set());
  // Same three, keyed by CalendarGeneratedPlan.objectId (string) for
  // plan ideas — merged inline with real plans + AI Suggested events
  // in the Upcoming stream.
  const [planIdeaInterestCounts, setPlanIdeaInterestCounts] = useState<Record<string, number>>({});
  const [planIdeaLocallyInterested, setPlanIdeaLocallyInterested] = useState<Set<string>>(new Set());
  const [planIdeaInterestPending, setPlanIdeaInterestPending] = useState<Set<string>>(new Set());
  // Featured suggestion awaiting phone verification before its interest write.
  const [featuredInterestFor, setFeaturedInterestFor] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Which AI event index (if any) the visitor tapped Host This on.
  // Non-null → confirmation modal is open for that event.
  const [hostThisEventIndex, setHostThisEventIndex] = useState<number | null>(null);
  const [hostThisSubmitting, setHostThisSubmitting] = useState(false);
  // Note from Host for the Host This flow. Deliberately NOT the `hostNote`
  // state above — that one belongs to the custom-plan / plan-idea modals and
  // is reset by their own open handlers, so sharing it let a note typed in one
  // surface reappear in the other.
  const [hostThisNote, setHostThisNote] = useState("");
  const [rsvpedPlanIds, setRsvpedPlanIds] = useState<Set<string>>(new Set());
  const [pendingRsvpIds, setPendingRsvpIds] = useState<Set<string>>(new Set());
  // planId → EventNotification.objectId for the viewer's own RSVP. Powers
  // the "Join Plan Chat" button (linked to /c/{notificationId}).
  const [rsvpNotificationIds, setRsvpNotificationIds] = useState<Map<string, string>>(new Map());
  const [hostedPlanIds, setHostedPlanIds] = useState<Set<string>>(new Set());
  const [hostNotificationId, setHostNotificationId] = useState<string | null>(null);
  const [cancellingRsvp, setCancellingRsvp] = useState<string | null>(null);
  const [cancelRsvpModalPlan, setCancelRsvpModalPlan] = useState<{ id: string; title: string } | null>(null);
  const [cancellingPlan, setCancellingPlan] = useState(false);

  // "Text me when this gets hosted" — offered AFTER an interest tap from a
  // browser with no identity on it.
  //
  // Anonymous taps are the norm on this page, not the exception: every
  // AIEventInterest row in production carries a cookie and nothing else, so
  // the interest count is real but the people behind it are uncontactable.
  // This asks for a phone once the tap is already recorded, so the count never
  // depends on them answering and a dismissal costs an identity we never had.
  //
  // OTP rather than a bare phone field, matching every other phone capture on
  // this page: an unverified number means texting someone who never asked.
  // The cost is paid once per browser — verifying sets leaf_verified_user, so
  // every later interest tap is identified with no prompt at all.
  const [notifyPromptFor, setNotifyPromptFor] = useState<
    { kind: "ai"; eventIndex: number; title: string }
    | { kind: "idea"; ideaId: string; title: string }
    | null
  >(null);
  const notifyVerify = usePhoneVerify();
  const [notifyAttaching, setNotifyAttaching] = useState(false);
  // Guards the attach against re-firing. A `notifyAttaching` dep would loop on
  // failure: the flag flips back to false, the effect re-runs, it retries
  // forever. Keyed by prompt so a second card in the same session still works.
  const notifyAttachedRef = useRef<string | null>(null);

  // Once the phone is verified, re-send the SAME interest call with the same
  // cookie. Both express* cloud functions dedupe on cookie and backfill
  // identity onto the row they find, so this attaches the phone to the
  // existing tap rather than creating a second one — no new endpoint needed,
  // and the count does not move.
  useEffect(() => {
    if (!notifyPromptFor || !notifyVerify.isVerified) return;
    const key =
      notifyPromptFor.kind === "ai"
        ? `ai:${notifyPromptFor.eventIndex}`
        : `idea:${notifyPromptFor.ideaId}`;
    if (notifyAttachedRef.current === key) return;
    notifyAttachedRef.current = key;

    (async () => {
      setNotifyAttaching(true);
      try {
        const cookie = getOrCreateAIInterestCookie();
        const identity = interestIdentityParams();
        if (notifyPromptFor.kind === "ai") {
          await Parse.Cloud.run("expressInterestOnAIEvent", {
            groupShareId: shareId,
            eventIndex: notifyPromptFor.eventIndex,
            cookie,
            ...identity,
          });
        } else {
          await Parse.Cloud.run("expressInterestOnPlanIdea", {
            ideaId: notifyPromptFor.ideaId,
            cookie,
            ...identity,
          });
        }
        setNotifyPromptFor(null);
        setToast("Got it — we’ll text you when someone hosts this.");
        setTimeout(() => setToast(null), 5000);
      } catch (err) {
        console.error("[org] attaching identity to interest failed:", err);
        // The tap itself is already recorded, so this failing costs the text,
        // not the interest. Say that rather than implying the tap was lost.
        setToast("Couldn’t save your number — your interest still counts.");
        setTimeout(() => setToast(null), 5000);
        setNotifyPromptFor(null);
      } finally {
        setNotifyAttaching(false);
      }
    })();
  }, [notifyPromptFor, notifyVerify.isVerified, shareId]);

  // AI-event interest tap. Optimistic: bump count + mark local
  // immediately so the button state doesn't wait on the round-trip.
  // Rolls back on failure.
  const handleAIEventInterest = useCallback(
    async (eventIndex: number) => {
      if (aiLocallyInterested.has(eventIndex)) return;
      if (aiInterestPending.has(eventIndex)) return;

      const cookie = getOrCreateAIInterestCookie();
      const priorCount =
        aiInterestCounts[eventIndex] ??
        org?.aiSourceEventInterests?.[eventIndex] ??
        0;

      setAIInterestPending((prev) => {
        const next = new Set(prev);
        next.add(eventIndex);
        return next;
      });
      setAILocallyInterested((prev) => {
        const next = new Set(prev);
        next.add(eventIndex);
        return next;
      });
      setAIInterestCounts((prev) => ({
        ...prev,
        [eventIndex]: priorCount + 1,
      }));
      markAIEventLocallyInterested(shareId, eventIndex);

      try {
        const result = (await Parse.Cloud.run("expressInterestOnAIEvent", {
          groupShareId: shareId,
          eventIndex,
          cookie,
          ...interestIdentityParams(),
        })) as { count?: number; alreadyInterested?: boolean };
        if (typeof result?.count === "number") {
          setAIInterestCounts((prev) => ({
            ...prev,
            [eventIndex]: result.count!,
          }));
        }
        // Only for a browser we can't already reach. Checked AFTER the write
        // lands, so the prompt never appears on a tap that failed to record.
        if (!interestIdentityParams().phone) {
          const ev = org?.aiSourceEvents?.[eventIndex];
          setNotifyPromptFor({
            kind: "ai",
            eventIndex,
            title: ev?.title || ev?.name || "this plan",
          });
        }
      } catch (err) {
        console.error("[org] expressInterestOnAIEvent failed:", err);
        // Roll back optimistic UI on failure.
        setAILocallyInterested((prev) => {
          const next = new Set(prev);
          next.delete(eventIndex);
          return next;
        });
        setAIInterestCounts((prev) => ({
          ...prev,
          [eventIndex]: priorCount,
        }));
      } finally {
        setAIInterestPending((prev) => {
          const next = new Set(prev);
          next.delete(eventIndex);
          return next;
        });
      }
    },
    [
      shareId,
      aiInterestCounts,
      aiLocallyInterested,
      aiInterestPending,
      org?.aiSourceEventInterests,
      // Read for the notify prompt's title.
      org?.aiSourceEvents,
    ]
  );

  // Opens the dashboard's New Plan drawer prefilled from an AI suggestion.
  // Two callers: the review modal's "Edit details first" (owner wants to
  // change the venue/time before publishing), and the automatic fallback
  // when the server can't resolve the suggestion's venue or date and a
  // human has to pick one. The drawer's VenueSearch auto-resolves the
  // venue name into a placeId; Create finalizes via createManualPlan.
  const openAIEventInDashboard = useCallback(
    (ev: NonNullable<OrgData["aiSourceEvents"]>[number]) => {
      if (!org) return;
      // Prefer the parent org's dashboard route so the manager lands on
      // THEIR primary calendar view, then the ?managePlans=<calId> handoff
      // pivots to the correct sub-calendar's PlansManager.
      const dashboardTarget = org.parentOrgId || org.objectId;
      const params = new URLSearchParams();
      params.set("managePlans", org.objectId);
      // Catchy activity headline when the row has one; the server's
      // _materializeAIEventAsPlan makes the same title-first choice.
      params.set("prefillTitle", ev.title || ev.name);
      if (ev.description) params.set("prefillDescription", ev.description);
      // resolved.date is a validated Date for any suggestion that rendered;
      // format as the drawer's input types expect.
      // UTC getters, not local: `date` is a floating wall clock, so the UTC
      // face IS the hour the card displays. Local getters shifted the prefill
      // by the viewer's offset — an 8:30 PM card opened the drawer at 4:30 PM.
      const d = resolveAIEventDate(ev, org.orgTimezone ?? null).date;
      if (d) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        const hh = String(d.getUTCHours()).padStart(2, "0");
        const mm = String(d.getUTCMinutes()).padStart(2, "0");
        params.set("prefillDate", `${y}-${m}-${day}`);
        params.set("prefillTime", `${hh}:${mm}`);
      }
      // Pass placeId when the AI event carries one (Places grounding merged
      // it in). Older events fall back to VenueSearch's autoResolveInitial
      // via the name string.
      params.set(
        "prefillVenue",
        JSON.stringify({
          name: ev.name,
          address: ev.address || ev.venueLine || "",
          placeId: ev.placeId || null,
        }),
      );
      // Send them back to /org after they cancel/publish so they don't lose
      // their spot on the calendar.
      if (typeof window !== "undefined") {
        params.set(
          "returnTo",
          window.location.pathname + window.location.search,
        );
      }
      router.push(`/dashboard/${dashboardTarget}?${params.toString()}`);
    },
    [org, router],
  );

  // Non-owner counterpart to openAIEventInDashboard. /dashboard is owner-only,
  // so a follower who wants to change a suggestion's time or venue goes to the
  // Propose-a-plan form instead, prefilled from the suggestion. That form
  // already submits as pendingHostRequest and already emails the owner —
  // which is the intended split: confirming a suggestion verbatim publishes
  // immediately, changing it needs the owner's approval.
  const openSuggestionInCustomPlan = useCallback(
    (ev: NonNullable<OrgData["aiSourceEvents"]>[number]) => {
      setCustomTitle(ev.title || ev.name);
      setCustomDescription(ev.description || ev.venueLine || ev.name);
      setCustomCategory(ev.name);
      setCustomCapacity("");
      setHostNote("");
      setCustomFromDeal(false);
      setCustomSubmitting(false);
      setCustomSuccess(false);
      setSelectedImageUrl(null);
      // Carry the grounded placeId through so they don't have to re-find a
      // venue the server already resolved.
      setSelectedVenue(
        ev.placeId
          ? {
              placeId: ev.placeId,
              name: ev.name,
              address: ev.address || ev.venueLine || "",
              rating: null,
              photoUrl: null,
            }
          : null,
      );
      // UTC getters — see the prefill above; `date` is a floating wall clock.
      const d = resolveAIEventDate(ev, org?.orgTimezone ?? null).date;
      if (d) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        setCustomPrefillDate(`${y}-${m}-${day}`);
        setCustomPrefillTime(
          `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
        );
      } else {
        setCustomPrefillDate("");
        setCustomPrefillTime("");
      }
      setCreatingCustomPlan(true);
    },
    [org?.orgTimezone],
  );

  // Hydrate "already interested" from localStorage on mount so the
  // button renders in its confirmed state across reloads without a
  // round-trip.
  useEffect(() => {
    if (!org?.aiSourceEvents) return;
    const seen = new Set<number>();
    org.aiSourceEvents.forEach((_, idx) => {
      if (isAIEventLocallyInterested(shareId, idx)) seen.add(idx);
    });
    if (seen.size > 0) setAILocallyInterested(seen);
  }, [org?.aiSourceEvents, shareId]);

  // Plan-idea interest tap. Same optimistic pattern as
  // handleAIEventInterest, keyed by CalendarGeneratedPlan.objectId
  // instead of aiSourceEvents index.
  const handlePlanIdeaInterest = useCallback(
    async (ideaId: string) => {
      if (planIdeaLocallyInterested.has(ideaId)) return;
      if (planIdeaInterestPending.has(ideaId)) return;

      const cookie = getOrCreateAIInterestCookie();
      const priorCount =
        planIdeaInterestCounts[ideaId] ??
        (org?.planIdeas.find((i) => i.id === ideaId)?.interestCount ?? 0);

      setPlanIdeaInterestPending((prev) => {
        const next = new Set(prev);
        next.add(ideaId);
        return next;
      });
      setPlanIdeaLocallyInterested((prev) => {
        const next = new Set(prev);
        next.add(ideaId);
        return next;
      });
      setPlanIdeaInterestCounts((prev) => ({ ...prev, [ideaId]: priorCount + 1 }));
      markPlanIdeaLocallyInterested(ideaId);

      try {
        const result = (await Parse.Cloud.run("expressInterestOnPlanIdea", {
          ideaId,
          cookie,
          ...interestIdentityParams(),
        })) as { count?: number; alreadyInterested?: boolean };
        if (typeof result?.count === "number") {
          setPlanIdeaInterestCounts((prev) => ({ ...prev, [ideaId]: result.count! }));
        }
        if (!interestIdentityParams().phone) {
          setNotifyPromptFor({
            kind: "idea",
            ideaId,
            title:
              org?.planIdeas.find((i) => i.id === ideaId)?.title || "this plan",
          });
        }
      } catch (err) {
        console.error("[org] expressInterestOnPlanIdea failed:", err);
        setPlanIdeaLocallyInterested((prev) => {
          const next = new Set(prev);
          next.delete(ideaId);
          return next;
        });
        setPlanIdeaInterestCounts((prev) => ({ ...prev, [ideaId]: priorCount }));
      } finally {
        setPlanIdeaInterestPending((prev) => {
          const next = new Set(prev);
          next.delete(ideaId);
          return next;
        });
      }
    },
    [
      planIdeaInterestCounts,
      planIdeaLocallyInterested,
      planIdeaInterestPending,
      org?.planIdeas,
    ],
  );

  // Featured ("Around the city") interest. Separate cloud function from the
  // plan-idea path above: featured rows are global admin suggestions with no
  // CalendarGeneratedPlan to point a PlanIdeaInterest at, and the write is
  // account-scoped rather than cookie-deduped. Anonymous viewers verify first.
  const handleFeaturedInterest = useCallback(
    async (suggestionId: string, title: string) => {
      if (planIdeaLocallyInterested.has(suggestionId)) return;
      if (planIdeaInterestPending.has(suggestionId)) return;

      if (!Parse.User.current()) {
        setFeaturedInterestFor({ id: suggestionId, title });
        return;
      }

      const priorCount =
        planIdeaInterestCounts[suggestionId] ??
        (org?.planIdeas.find((i) => i.id === suggestionId)?.interestCount ?? 0);

      setPlanIdeaInterestPending((prev) => new Set(prev).add(suggestionId));
      setPlanIdeaLocallyInterested((prev) => new Set(prev).add(suggestionId));
      setPlanIdeaInterestCounts((prev) => ({
        ...prev,
        [suggestionId]: priorCount + 1,
      }));
      markPlanIdeaLocallyInterested(suggestionId);

      try {
        const result = (await Parse.Cloud.run("expressFeaturedInterest", {
          suggestionId,
        })) as { interestCount?: number; alreadyInterested?: boolean };
        if (typeof result?.interestCount === "number") {
          setPlanIdeaInterestCounts((prev) => ({
            ...prev,
            [suggestionId]: result.interestCount!,
          }));
        }
      } catch (err) {
        console.error("[org] expressFeaturedInterest failed:", err);
        setPlanIdeaLocallyInterested((prev) => {
          const next = new Set(prev);
          next.delete(suggestionId);
          return next;
        });
        setPlanIdeaInterestCounts((prev) => ({
          ...prev,
          [suggestionId]: priorCount,
        }));
      } finally {
        setPlanIdeaInterestPending((prev) => {
          const next = new Set(prev);
          next.delete(suggestionId);
          return next;
        });
      }
    },
    [
      planIdeaInterestCounts,
      planIdeaLocallyInterested,
      planIdeaInterestPending,
      org?.planIdeas,
    ],
  );

  // Hydrate plan-idea "already interested" from localStorage.
  useEffect(() => {
    if (!org?.planIdeas || org.planIdeas.length === 0) return;
    const seen = new Set<string>();
    for (const idea of org.planIdeas) {
      if (isPlanIdeaLocallyInterested(idea.id)) seen.add(idea.id);
    }
    if (seen.size > 0) setPlanIdeaLocallyInterested(seen);
  }, [org?.planIdeas]);

  const handleSharePlan = useCallback(async (planId: string, planTitle: string) => {
    // APP_LINK_URL: a shared plan link has to land on the host installed
    // iOS builds intercept, or recipients get Safari instead of the app.
    const url = `${APP_LINK_URL}/p/${planId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: planTitle, url });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setCopiedPlanId(planId);
      setTimeout(() => setCopiedPlanId(null), 2000);
    }
  }, []);

  async function loadHostNotificationId(eventGroupId: string) {
    // The attendee list itself is rendered on the dedicated /h/{id} page —
    // here we only need the host's notification id so the "Message Attendees"
    // button can deep-link to that page. Auth mirrors fetchOrg's chain
    // (Parse session → localStorage → verified-user cookie).
    const storedPhone = localStorage.getItem("leaf_follower_phone");
    const cachedUser = getVerifiedUserCookie();
    const phone = storedPhone || cachedUser?.phone?.replace(/\D/g, "") || null;
    const hasParseSession = !!Parse.User.current();
    if (!phone && !hasParseSession) return;
    try {
      const params: { eventGroupId: string; phoneNumber?: string } = { eventGroupId };
      if (phone) params.phoneNumber = phone;
      const result = (await Parse.Cloud.run("getPlanAttendeesForHost", params)) as
        | { hostNotificationId?: string | null }
        | unknown[]
        | null
        | undefined;
      // Old array-shaped response from pre-deploy servers won't have the id.
      if (result && !Array.isArray(result) && typeof result === "object") {
        setHostNotificationId((result as { hostNotificationId?: string | null }).hostNotificationId || null);
      } else {
        setHostNotificationId(null);
      }
    } catch (err) {
      console.error("Failed to load host notification id:", err);
      setHostNotificationId(null);
    }
  }

  async function handleCancelRsvp(planId: string) {
    const cached = getVerifiedUserCookie();
    if (!cached?.phone) {
      // No OTP-verified session — open CancelRsvpModal to require OTP first
      const plan = org?.plans.find((p) => p.id === planId);
      setCancelRsvpModalPlan({ id: planId, title: plan?.title || "this plan" });
      return;
    }
    if (!confirm("Cancel your RSVP? The host will be notified.")) return;
    setCancellingRsvp(planId);
    try {
      await Parse.Cloud.run("cancelRsvpViaWeb", {
        phoneNumber: cached.phone.replace(/\D/g, ""),
        eventGroupId: planId,
      });
      completeCancelRsvp(planId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("No RSVP found")) {
        completeCancelRsvp(planId, "RSVP was already removed");
      } else {
        alert(msg || "Failed to cancel RSVP.");
      }
    } finally {
      setCancellingRsvp(null);
    }
  }

  function completeCancelRsvp(planId: string, message?: string) {
    removeRsvpCookie(planId);
    setRsvpedPlanIds((prev) => {
      const next = new Set(prev);
      next.delete(planId);
      return next;
    });
    setOrg((prev) => prev ? {
      ...prev,
      plans: prev.plans.map((p) =>
        p.id === planId ? { ...p, attendeeCount: Math.max(0, p.attendeeCount - 1) } : p
      ),
    } : prev);
    setSelectedEvent((prev) =>
      prev && prev.id === planId ? { ...prev, attendeeCount: Math.max(0, prev.attendeeCount - 1) } : prev
    );
    setToast(message || "RSVP cancelled");
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCancelPlan(planId: string) {
    if (!confirm("Cancel this plan? All attendees will be notified.")) return;
    setCancellingPlan(true);
    try {
      await Parse.Cloud.run("removePlanFromCalendar", { eventGroupId: planId });
      setOrg((prev) => prev ? {
        ...prev,
        plans: prev.plans.filter((p) => p.id !== planId),
      } : prev);
      setSelectedEvent(null);
      setToast("Plan cancelled");
      setTimeout(() => setToast(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to cancel plan.");
    } finally {
      setCancellingPlan(false);
    }
  }

  // Check cookie on mount
  useEffect(() => {
    const cookie = getFollowerCookie();
    if (cookie) {
      setIsFollowing(true);
    }
  }, []);

  // Check for existing Parse session (returning owner/host from dashboard)
  useEffect(() => {
    try {
      const current = Parse.User.current();
      if (current) setParseUser(current);
    } catch { /* no session */ }
  }, []);

  // Timed follow popup
  useEffect(() => {
    if (!org) return;
    // Suppress: already following, owner/host, or recently dismissed
    if (isFollowing) return;
    if (org.isOwner || org.isHost) return;
    const dismissKey = `leaf_follow_dismiss_${org.objectId}`;
    try {
      const dismissed = localStorage.getItem(dismissKey);
      if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
    } catch { /* localStorage unavailable */ }
    const timer = setTimeout(() => setShowFollowPopup(true), 5000);
    return () => clearTimeout(timer);
  }, [org, isFollowing]);

  function dismissFollowPopup() {
    setShowFollowPopup(false);
    if (org) {
      try { localStorage.setItem(`leaf_follow_dismiss_${org.objectId}`, String(Date.now())); } catch { /* */ }
    }
  }

  // Scroll-triggered plan idea popup for followers
  useEffect(() => {
    if (!org) return;
    if (!isFollowing) return;
    if (org.isOwner || org.isHost) return;
    if (org.planIdeas.length === 0 || org.hidePlanIdeas) return;
    if (org.rsvpLimitReached) return;
    const dismissKey = `leaf_idea_popup_dismiss_${org.objectId}`;
    try {
      const dismissed = localStorage.getItem(dismissKey);
      if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;
    } catch { /* localStorage unavailable */ }

    const randomIdea = org.planIdeas[Math.floor(Math.random() * org.planIdeas.length)];
    setPopupIdea(randomIdea);

    const target = ctaSectionRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowPlanIdeaPopup(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [org, isFollowing]);

  function dismissPlanIdeaPopup() {
    setShowPlanIdeaPopup(false);
    if (org) {
      try { localStorage.setItem(`leaf_idea_popup_dismiss_${org.objectId}`, String(Date.now())); } catch { /* */ }
    }
  }

  async function handlePopupFollow() {
    if (!org) return;
    const cached = getVerifiedUserCookie();
    if (cached?.name && cached?.phone) {
      // One-tap follow for returning verified users
      setFollowPopupLoading(true);
      try {
        const followResult = await Parse.Cloud.run("followCalendarViaWeb", {
          calendarId: org.objectId,
          name: cached.name,
          phoneNumber: cached.phone.replace(/\D/g, ""),
        });
        setFollowerCookie(org.objectId, cached.name, cached.phone);
        setVerifiedUserCookie(cached.name, cached.phone);
        localStorage.setItem("leaf_follower_phone", cached.phone.replace(/\D/g, ""));
        if (followResult.pending) {
          setFollowRequestPending(true);
          setShowFollowPopup(false);
          setToast("Request sent! You\u2019ll be notified when approved.");
          setTimeout(() => setToast(null), 3000);
        } else {
          setIsFollowing(true);
          setFollowerCount((c) => c + 1);
          setShowFollowPopup(false);
          setToast(`You're now following ${org.name}`);
          setTimeout(() => setToast(null), 3000);
        }
      } catch {
        // Fallback to full modal if one-tap fails
        setShowFollowPopup(false);
        setShowFollowModal(true);
      } finally {
        setFollowPopupLoading(false);
      }
    } else {
      // New visitor — open full follow modal
      setShowFollowPopup(false);
      setShowFollowModal(true);
    }
  }

  async function handleUnfollow() {
    if (!org) return;
    if (!confirm("Unfollow this calendar? You will no longer receive notifications about new plans.")) return;
    const cookie = getFollowerCookie();
    if (!cookie?.phone) return;
    try {
      await Parse.Cloud.run("unfollowCalendarViaWeb", {
        calendarId: org.objectId,
        phoneNumber: cookie.phone,
      });
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
      // Clear the follower cookie
      document.cookie = "leaf_follower=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch (err) {
      console.error("Failed to unfollow:", err);
    }
  }

  // Set page title when org loads
  useEffect(() => {
    if (org) {
      document.title = org.name;
      setFollowerCount(org.memberCount);
      if (org.followRequestPending) setFollowRequestPending(true);
      if (org.isFollower) setIsFollowing(true);
    }
    return () => { document.title = "Leaf"; };
  }, [org]);

  // Initialize RSVP state from cookie
  useEffect(() => {
    const ids = getRsvpCookieIds();
    if (ids.length > 0) setRsvpedPlanIds(new Set(ids));
    const pendingIds = getPendingRsvpCookieIds();
    if (pendingIds.length > 0) setPendingRsvpIds(new Set(pendingIds));
  }, []);

  const fetchOrg = useCallback(async (retried = false) => {
    try {
      setLoading(true);
      // Pass phone number if available for private calendar access & RSVP sync
      const storedPhone = typeof window !== "undefined" ? localStorage.getItem("leaf_follower_phone") : null;
      const cachedUser = typeof window !== "undefined" ? getVerifiedUserCookie() : null;
      const phoneNumber = storedPhone || cachedUser?.phone?.replace(/\D/g, "") || undefined;
      const result = await Parse.Cloud.run("getOrgCalendarPage", { shareId, phoneNumber });

      // Record page view (fire-and-forget)
      if (result.objectId) {
        Parse.Cloud.run("recordCalendarPageView", { calendarId: result.objectId }).catch(() => {});
      }

      // Handle inactive calendar
      if (result.isInactive) {
        setIsInactive({ name: result.name || "Calendar" });
        setLoading(false);
        return;
      }

      // Transform API response to our OrgData shape
      const plans: Plan[] = (result.plans || []).map((p: Record<string, unknown>) => ({
        id: p.objectId as string,
        title: p.title as string || "Untitled Plan",
        date: p.expiryDate ? formatDate(p.expiryDate as string, (p.timezone as string | null) ?? null) : "",
        time: p.time ? normalizeTimeString(p.time as string) : (p.expiryDate ? formatTime(p.expiryDate as string, (p.timezone as string | null) ?? null) : ""),
        dateISO: (p.expiryDate as string) || null,
        description: p.description as string || "",
        image: p.image as string || "",
        hostId: (p.host as Record<string, string>)?.objectId || null,
        hostName: (p.host as Record<string, string>)?.name || "Community Member",
        hostAvatar: (p.host as Record<string, string>)?.profilePictureUrl || null,
        // rsvpCount tracks RSVPs only; a real host is always attending so add 1 —
        // but a virtual/AI host (or one Leaf hasn't confirmed yet) isn't a real
        // attendee, so don't pad the count for those.
        attendeeCount:
          ((p.rsvpCount as number) || 0) +
          (p.virtualHost || p.leafHostState === "leaf_arranging" ? 0 : 1),
        location: p.location ? {
          name: (p.location as Record<string, unknown>).name as string | null,
          address: (p.location as Record<string, unknown>).address as string | null,
          neighborhood: (p.location as Record<string, unknown>).neighborhood as string | null || null,
          isPrivate: (p.location as Record<string, unknown>).isPrivate as boolean || false,
        } : null,
        locations: Array.isArray(p.locations)
          ? (p.locations as Record<string, unknown>[]).map((loc) => ({
              objectId: (loc.objectId as string | null) ?? null,
              name: (loc.name as string | null) ?? null,
              address: (loc.address as string | null) ?? null,
              neighborhood: (loc.neighborhood as string | null) ?? null,
              isPrivate: (loc.isPrivate as boolean) || false,
              timezone: (loc.timezone as string | null) ?? null,
              time: (loc.time as string | null) ?? null,
            }))
          : undefined,
        hostNote: p.hostNote as string || null,
        requireApproval: p.requireApproval as boolean || false,
        isPoll: p.isPoll as boolean || false,
        pollOptionCount: (p.pollOptionCount as number) || 0,
        pollVoteCount: (p.pollVoteCount as number) || 0,
        pollClosesAt: (p.pollClosesAt as string) || null,
        leafHostState: (p.leafHostState as Plan["leafHostState"]) || null,
        leafHostPersona: (p.leafHostPersona as Plan["leafHostPersona"]) || null,
        virtualHost: (p.virtualHost as boolean) || false,
        virtualHostPersona: (p.virtualHostPersona as Plan["virtualHostPersona"]) || null,
        virtualHostAddable: (p.virtualHostAddable as boolean) || false,
        hasLeafHostChat: Boolean(p.hasLeafHostChat),
        leafHostChatUnread:
          typeof p.leafHostChatUnread === "number" ? p.leafHostChatUnread : 0,
      }));

      const planIdeas: PlanIdea[] = (result.planIdeas || []).map((idea: Record<string, unknown>) => ({
        // A featured suggestion is a FeaturedSuggestion row merged into this
        // list by the server, and it ships `id` where a CalendarGeneratedPlan
        // ships `objectId`. Without the fallback its id is `undefined`, which
        // then keys the React list, the spread-date map and the interest-count
        // map — so every id-less entry collides on one bucket.
        id: (idea.objectId as string) ?? (idea.id as string),
        title: idea.title as string || "Plan Idea",
        description: idea.description as string || "",
        category: idea.category as string || "Activity",
        image: idea.image as string || "",
        date: idea.date as string || null,
        icebreakerQuestion: idea.icebreakerQuestion as string || null,
        suggestedCapacity: idea.suggestedCapacity as number || null,
        centroid: idea.centroid as string || null,
        audienceTag: (idea.audienceTag as string) ?? null,
        sourceKind: (idea.sourceKind as string) ?? null,
        localFormat: (idea.localFormat as string) ?? null,
        interestCount: typeof idea.interestCount === "number" ? (idea.interestCount as number) : 0,
        location: idea.location && typeof idea.location === "object"
          ? {
              name: ((idea.location as Record<string, unknown>).name as string) || "",
              address: ((idea.location as Record<string, unknown>).address as string) || "",
              // Carried through so a gated card keeps its location line after a
              // refetch — name/address arrive null in that case and this is the
              // only thing left to render.
              neighborhood: ((idea.location as Record<string, unknown>).neighborhood as string) || null,
              isPrivate: (idea.location as Record<string, unknown>).isPrivate === true,
              // Real Google placeId when the server has one (featured rows
              // always ship it). Dropping it here made suggestedVenueFor fall
              // back to the __suggested__ sentinel, which the featured submit
              // path would then send to requestCustomPlanViaWeb as a placeId.
              placeId: ((idea.location as Record<string, unknown>).placeId as string) || null,
            }
          : null,
        ideaSeriesId: (idea.ideaSeriesId as string) || null,
        isManual: idea.isManual === true,
        datePinned: idea.datePinned === true,
        preferredTime: (idea.preferredTime as string) ?? null,
        isFeatured: idea.isFeatured === true,
        whenLabel: (idea.whenLabel as string) ?? undefined,
        timeMode: (idea.timeMode as PlanIdea["timeMode"]) ?? undefined,
        venueTimeZone: (idea.venueTimeZone as string) ?? null,
        localWallClock: (idea.localWallClock as string) ?? null,
        venueName: (idea.venueName as string) ?? null,
      }));

      setVirtualHostAvatar((result.virtualHostPreview as { avatarUrl?: string | null } | null)?.avatarUrl ?? null);

      // "Show suggested and featured plans" covers the AI starter cards too —
      // they render as "Suggested" and are the ONLY suggestion surface on a
      // freshly adopted AI calendar, so leaving them on made the toggle look
      // like it did nothing. Dropping them here (rather than at each render
      // site) also fixes the empty-state copy, which keys off this array.
      const visibleAiSourceEvents =
        result.hidePlanIdeas === true || !Array.isArray(result.aiSourceEvents)
          ? null
          : result.aiSourceEvents;


      setOrg({
        objectId: result.objectId,
        parentOrgId: result.parentOrgId || null,
        name: result.name || "Organization",
        description: result.description || "",
        profilePhoto: result.profilePhoto || null,
        tier: result.orgSubscriptionTier || "starter",
        brandColor: result.orgBrandColor || "#18181b",
        orgType: result.orgType || null,
        orgCity: result.orgCity || null,
        memberCount: result.memberCount || 0,
        pastPlanCount: result.pastPlanCount || 0,
        rsvpLimitReached: result.rsvpLimitReached || false,
        isOwner: result.isOwner || false,
        isHost: result.isHost || false,
        plans,
        planIdeas,
        // AI-adopted calendars already surface starter events as "Suggested"
        // cards up top — the AI plan-idea carousel below reads as a second
        // "here are some ideas" section and collides with them. Force the
        // carousel off in that case regardless of the org's stored flag.
        //
        // The stored flag still wins: when the owner turns suggestions off,
        // visibleAiSourceEvents is already null, so this collapses to the
        // stored value and every suggestion surface goes dark together.
        // Starter events and plan ideas are the SAME surface — a suggested
        // plan someone still has to host. Starter events are just the ones
        // minted when the calendar was created; plan ideas recur weekly.
        //
        // This used to be forced true whenever starter events existed, to stop
        // a "second here-are-some-ideas section" colliding with the first. That
        // collision no longer exists: both sources push into one date-sorted
        // stream. What the override actually did was hide every recurring idea
        // forever on any calendar that shipped with starter events — which is
        // every admin-created one. Only the owner's own setting hides them now.
        hidePlanIdeas: result.hidePlanIdeas || false,
        hideCustomPlans: result.hideCustomPlans || false,
        hideDeals: result.hideDeals || false,
        blacklistCategories: result.orgBlacklistCategories || [],
        excludeKeywords: result.orgExcludeKeywords || [],
        isPrivate: result.isPrivate || false,
        isFollower: result.isFollower || false,
        followRequestPending: result.followRequestPending || false,
        requireApprovalDefault: result.requireApprovalDefault === true,
        allowFollowersToHost: result.allowFollowersToHost !== false,
        // The zone starter-event wall clocks are anchored to. Typed since the
        // server started sending it, but never actually read off the payload —
        // so every AI-event date resolved with no zone at all.
        orgTimezone:
          typeof result.orgTimezone === "string" && result.orgTimezone
            ? result.orgTimezone
            : null,
        aiSourceEvents: visibleAiSourceEvents,
        aiSourceEventInterests:
          result.aiSourceEventInterests &&
          typeof result.aiSourceEventInterests === "object"
            ? result.aiSourceEventInterests
            : {},
        dismissedAiEventIndexes: Array.isArray(result.dismissedAiEventIndexes)
          ? (result.dismissedAiEventIndexes as number[])
          : [],
        hostedAiEventIndexes: Array.isArray(result.hostedAiEventIndexes)
          ? (result.hostedAiEventIndexes as number[])
          : [],
        // Pass through the owner-only leafHost block if the server
        // included it. Server strips this on non-owner payloads, so
        // trusting whatever it sends is safe here (spec §6a enforces
        // the leak guard server-side, never in the client).
        leafHost:
          result.leafHost &&
          typeof result.leafHost === "object" &&
          typeof (result.leafHost as { eligible?: unknown }).eligible ===
            "boolean"
            ? (result.leafHost as OrgData["leafHost"])
            : undefined,
      });

      // Sync RSVP cookies with backend data (handles admin-removed RSVPs)
      if (result.userRsvpPlanIds && Array.isArray(result.userRsvpPlanIds)) {
        const rsvpEntries = result.userRsvpPlanIds as Array<{ planId: string; status: string; notificationId?: string }>;
        const confirmedIds = new Set<string>(rsvpEntries.filter((r) => r.status === "Accepted").map((r) => r.planId));
        const pendingIds = new Set<string>(rsvpEntries.filter((r) => r.status === "pendingRsvp" || r.status === "Requested").map((r) => r.planId));
        const notifIdMap = new Map<string, string>();
        for (const r of rsvpEntries) {
          if (r.notificationId) notifIdMap.set(r.planId, r.notificationId);
        }

        // Remove stale cookies for RSVPs that no longer exist
        for (const id of getRsvpCookieIds()) {
          if (!confirmedIds.has(id)) removeRsvpCookie(id);
        }
        for (const id of getPendingRsvpCookieIds()) {
          if (!pendingIds.has(id)) removePendingRsvpCookie(id);
        }

        // Add missing cookies for RSVPs the backend knows about
        for (const id of confirmedIds) addRsvpCookie(id);
        for (const id of pendingIds) addPendingRsvpCookie(id);

        setRsvpedPlanIds(confirmedIds);
        setPendingRsvpIds(pendingIds);
        setRsvpNotificationIds(notifIdMap);
      }

      if (result.userHostedPlanIds && Array.isArray(result.userHostedPlanIds)) {
        setHostedPlanIds(new Set(result.userHostedPlanIds));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Stale Parse session token — clear it and retry once
      if (msg.toLowerCase().includes("invalid session") && !retried) {
        retried = true;
        try { await Parse.User.logOut(); } catch { /* ignore */ }
        return fetchOrg();
      }
      setError(msg || "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    if (shareId) fetchOrg();
  }, [shareId, fetchOrg]);

  // Auto-open the plan details modal if the URL contains ?plan={eventGroupId}.
  // This is the landing target for the /p/[eventGroupId] share page used by
  // SMS notifications (e.g., approval SMS sent to a custom plan host).
  // Read directly from window.location to avoid the Suspense requirement
  // that next/navigation's useSearchParams imposes on this client page.
  const [planQueryId, setPlanQueryId] = useState<string | null>(null);
  // ?idea= counterpart — set by the same param effect, consumed below.
  const [ideaQueryId, setIdeaQueryId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const id = search.get("plan");
    if (id) setPlanQueryId(id);
    // ?idea={CalendarGeneratedPlan id} — the landing target for host-ask
    // texts (PlansManager's "Ask" button), pointing at one suggestion.
    const ideaParam = search.get("idea");
    if (ideaParam) setIdeaQueryId(ideaParam);
    if (search.get("welcome") === "1") setShowWelcomeInvite(true);

    // Auto-open the custom-plan ("Suggest the next one") form when arriving
    // from the memory page with ?suggest=1 and prefill params. The venue name
    // populates the category search so the user's previous spot likely shows
    // up at the top of nearby results — placeId still has to be picked from
    // Google Places, since the cloud function requires a real placeId.
    if (search.get("suggest") === "1") {
      const t = search.get("prefillTitle") || "";
      const d = search.get("prefillDescription") || "";
      let venueName = "";
      const venueStr = search.get("prefillVenue");
      if (venueStr) {
        try {
          const v = JSON.parse(venueStr);
          venueName = v.name || "";
        } catch {
          // ignore malformed venue JSON
        }
      }
      setCustomTitle(t);
      setCustomDescription(d);
      setCustomCategory(venueName);
      setCustomCapacity("");
      setCustomPrefillDate("");
      setCustomPrefillTime("");
      setHostNote("");
      setSelectedVenue(null);
      setCustomSubmitting(false);
      setCustomSuccess(false);
      setCreatingCustomPlan(true);
    }
    // returnTo from the memory page — used when a follower cancels out of the
    // custom-plan form. On submit they stay here; on cancel they bounce back
    // to wherever they came from (e.g. /m/{notificationId}).
    const rt = search.get("returnTo");
    if (rt && rt.startsWith("/")) setReturnTo(rt);

    // Stripe redirected back from a "Let Leaf host it" checkout.
    // ?leafHostAuthorized=1 → success toast. ?leafHostCancelled=1 →
    // silent redirect back (no toast — the owner chose to abandon).
    // Params are stripped after firing so a refresh doesn't re-trigger.
    if (search.get("leafHostAuthorized") === "1") {
      setToast(
        "Card authorized. Your validated plans will be ready to review within 24 hours.",
      );
      setTimeout(() => setToast(null), 6000);
    }
    if (
      search.get("leafHostAuthorized") === "1" ||
      search.get("leafHostCancelled") === "1"
    ) {
      const clean = new URLSearchParams(window.location.search);
      clean.delete("leafHostAuthorized");
      clean.delete("leafHostCancelled");
      clean.delete("session_id");
      const qs = clean.toString();
      const nextUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }, []);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const autoOpenedPlanRef = useRef<string | null>(null);
  useEffect(() => {
    if (!org || !planQueryId) return;
    if (autoOpenedPlanRef.current === planQueryId) return;
    const match = org.plans.find((p) => p.id === planQueryId);
    if (match) {
      setSelectedEvent(match);
      autoOpenedPlanRef.current = planQueryId;
    }
  }, [org, planQueryId]);

  // ?idea= auto-open — the host-ask SMS landing. If the visitor can host,
  // open the hosting flow on that suggestion directly; otherwise surface the
  // suggestion as the popup card.
  //
  // Not being a follower no longer counts against them. This link is sent TO
  // ask someone to host, so routing the not-yet-following recipient into a
  // follow-first detour was pushing back exactly the person who had just said
  // yes. The follow now happens as part of hosting.
  const autoOpenedIdeaRef = useRef<string | null>(null);
  useEffect(() => {
    if (!org || !ideaQueryId) return;
    if (autoOpenedIdeaRef.current === ideaQueryId) return;
    const match = org.planIdeas.find((i) => i.id === ideaQueryId);
    if (!match) return;
    autoOpenedIdeaRef.current = ideaQueryId;
    const canHostNow =
      org.isOwner || org.isHost || !!org.allowFollowersToHost;
    if (canHostNow && !org.rsvpLimitReached) {
      setHostingIdea(match);
      setHostSubmitting(false);
      setHostSuccess(false);
      setHostNote("");
      setSelectedVenue(null);
    } else {
      setPopupIdea(match);
      setShowPlanIdeaPopup(true);
    }
  }, [org, ideaQueryId]);

  // ── Return from the AI-assisted host purchase (?virtualHostAttached=1) ────
  // Stripe sends the owner back to this page with the sheet (and any modal it
  // was opened from) gone. Resolve the checkout session to the plan that got
  // hosted, refresh, and hand the id to the ?plan= auto-open above so they land
  // on the plan detail — where the host they just paid for actually shows.
  // The attach itself lands on the Stripe webhook (and on the idea / AI-starter
  // paths the plan is created there), so poll until it reports ready.
  const virtualHostReturnRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || virtualHostReturnRef.current) return;
    const search = new URLSearchParams(window.location.search);
    if (search.get("virtualHostAttached") !== "1") return;
    virtualHostReturnRef.current = true;
    const sessionId = search.get("session_id");
    search.delete("virtualHostAttached");
    search.delete("session_id");
    const qs = search.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 8 && !cancelled; i++) {
        try {
          const r: { ready: boolean; eventGroupId?: string } = await Parse.Cloud.run(
            "getVirtualHostAttachStatus",
            { sessionId },
          );
          if (r.ready && r.eventGroupId) {
            if (cancelled) return;
            await fetchOrg();
            if (!cancelled) setPlanQueryId(r.eventGroupId);
            return;
          }
        } catch {
          return; // not our session / signed out — leave them on the page
        }
        await new Promise((res) => setTimeout(res, 1500));
      }
    })();
    return () => { cancelled = true; };
  }, [fetchOrg]);

  // Keep the open detail modal in sync with the live plans list. `selectedEvent`
  // is a frozen snapshot taken when the card was clicked, so any later
  // fetchOrg() (RSVP, host reassignment, virtual host, etc.) refreshes the card
  // grid but leaves the modal showing stale data — most visibly the host name
  // (card shows the new host while the modal still reads the old one). Re-derive
  // the snapshot from org.plans by id whenever the list changes. If the plan is
  // gone (cancelled), leave the snapshot as-is; explicit close paths null it.
  useEffect(() => {
    if (!selectedEvent || !org) return;
    const fresh = org.plans.find((p) => p.id === selectedEvent.id);
    if (fresh && fresh !== selectedEvent) setSelectedEvent(fresh);
  }, [org, selectedEvent]);

  // Whether the VIEWER should see the owner/host treatment (hosting badge,
  // Message Attendees, add-to-calendar as host). A virtual host or Leaf host is
  // the public face of the plan even though the owner technically owns the
  // EventGroup — on this public page such a plan should read like any other
  // visitor's plan ("Organized by Marcus"), not "You're Hosting". The owner still
  // manages it from the dashboard. Excludes those personas from the host view.
  const viewerHostsPlan = (plan: Plan) =>
    hostedPlanIds.has(plan.id) && !plan.virtualHost && plan.leafHostState !== "leaf_hosted";

  // Auto-load the host notification id when a host opens their own plan
  // (powers the "Message Attendees" button → /h/{id}).
  useEffect(() => {
    if (selectedEvent && viewerHostsPlan(selectedEvent)) {
      loadHostNotificationId(selectedEvent.id);
    } else {
      setHostNotificationId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent?.id]);

  // Fetch nearby venues when either host modal or custom plan modal opens
  useEffect(() => {
    if (!org) return;
    if (!hostingIdea && !creatingCustomPlan) return;

    const searchCity = hostingIdea?.centroid || org.orgCity || "";
    // When hosting a suggested plan, a typed venue query overrides the idea's
    // category so the hoster can search for any specific venue by name.
    const typedVenueQuery = hostingIdea ? venueSearchQuery.trim() : "";
    const searchCategory = hostingIdea
      ? (typedVenueQuery || hostingIdea.category)
      : (customCategory.trim() || "");

    // Don't search until the user has typed something (custom plan) or a category exists (plan idea)
    if (!searchCategory) {
      setNearbyVenues([]);
      setVenuesLoading(false);
      return;
    }

    // A suggestion that already has a venue IS the answer — don't sweep Places
    // for alternatives nobody asked for. Typing in the search box opts back in.
    const ideaVenue = hostSuggestedVenue;
    if (ideaVenue && !typedVenueQuery) {
      setNearbyVenues([]);
      setSelectedVenue(ideaVenue);
      setVenuesLoading(false);
      return;
    }

    setNearbyVenues([]);
    // Hosting a suggestion keeps its own venue selected through the default
    // category sweep — only a typed search (the hoster shopping for somewhere
    // else) clears the pick. Custom plans have nothing to preserve.
    setSelectedVenue(typedVenueQuery ? null : ideaVenue);
    setVenuesLoading(true);

    // Debounce keystroke-driven searches (custom plans, and typed venue
    // queries on suggested plans); the idea's default category search is
    // instant.
    const debounceMs = hostingIdea && !typedVenueQuery ? 0 : 400;
    const timer = setTimeout(() => {

    // Load Google Maps if not already loaded, then search
    const doSearch = async () => {
      try {
        // Wait for Google Maps to be available
        if (!window.google?.maps?.places) {
          const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (!key) { setVenuesLoading(false); return; }
          // Check if already loading
          if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
            await new Promise<void>((resolve) => {
              (window as unknown as Record<string, unknown>).__venueSearchCallback = () => resolve();
              const script = document.createElement("script");
              script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__venueSearchCallback`;
              script.async = true;
              document.head.appendChild(script);
            });
          } else {
            // Script exists, wait for it
            await new Promise<void>((resolve) => {
              const check = setInterval(() => {
                if (window.google?.maps?.places) { clearInterval(check); resolve(); }
              }, 100);
            });
          }
        }

        // Geocode the city to get coordinates for location-biased search
        // (25km / ~15mi radius so Brooklyn-based orgs can find Manhattan venues, etc.)
        let searchRequest: google.maps.places.TextSearchRequest = {
          query: searchCategory,
        };

        if (searchCity) {
          try {
            const geocoder = new window.google.maps.Geocoder();
            const geoResult = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ address: searchCity }, (results, status) => {
                if (status === window.google.maps.GeocoderStatus.OK && results?.length) {
                  resolve(results);
                } else {
                  reject(new Error("Geocode failed"));
                }
              });
            });
            const loc = geoResult[0].geometry.location;
            searchRequest = {
              ...searchRequest,
              location: loc,
              radius: 25000, // 25km (~15 miles)
            };
          } catch {
            // Geocode failed — fall back to city name in query text
            searchRequest.query = `${searchCategory} in ${searchCity}`;
          }
        }

        const service = new window.google.maps.places.PlacesService(
          document.createElement("div")
        );

        service.textSearch(
          searchRequest,
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              const blacklist = org.blacklistCategories || [];
              const kwBlacklist = org.excludeKeywords || [];
              const venues: NearbyVenue[] = results.slice(0, 8).map((place) => ({
                placeId: place.place_id || "",
                name: place.name || "",
                address: place.formatted_address || "",
                rating: place.rating || null,
                photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 }) || null,
                flagged: isVenueBlacklisted(place.name || "", place.types || [], blacklist, kwBlacklist),
              }));
              setNearbyVenues(venues);
            }
            setVenuesLoading(false);
          }
        );
      } catch {
        setVenuesLoading(false);
      }
    };

    doSearch();

    }, debounceMs); // end setTimeout
    return () => clearTimeout(timer);
  // hostSuggestedVenue is a dependency because for a non-owner it starts null
  // and only becomes real when the on-demand reveal lands — without it the
  // Places sweep would already have run and the organizer's venue would never
  // get pinned or pre-selected.
  }, [hostingIdea, creatingCustomPlan, customCategory, venueSearchQuery, org, hostSuggestedVenue]);

  // Sync the proposer-side "require approval" toggles to the calendar default
  // whenever a proposal form opens. Owners/hosts editing on the dashboard get
  // their own toggle in CreatePlanModal; this only applies to follower
  // proposals from this page.
  useEffect(() => {
    if (hostingIdea) {
      setHostRequireApproval(org?.requireApprovalDefault === true);
      setVenueSearchQuery(""); // clear the venue search each time the modal opens
      // Reveal the organizer's venue for a gated idea. Someone volunteering to
      // run the event needs to know where it is; the card stays redacted and
      // this never rides along in the page payload. Failures are silent — the
      // modal just falls back to the Places carousel, which is what a
      // non-owner saw before this existed.
      setRevealedVenue(null);
      if (hostingIdea.location?.isPrivate === true) {
        const ideaId = hostingIdea.id;
        revealRequestRef.current = ideaId;
        Parse.Cloud.run("getPlanIdeaVenueForHosting", { calendarPlanId: ideaId })
          .then((res: { ok?: boolean; venue?: RevealedVenueResponse | null }) => {
            // Ignore a late response for a modal the user has already left.
            if (revealRequestRef.current !== ideaId) return;
            if (!res?.ok || !res.venue?.name) return;
            setRevealedVenue({
              placeId: res.venue.placeId || SUGGESTED_VENUE_ID,
              name: res.venue.name,
              address: res.venue.address || "",
              rating: res.venue.rating ?? null,
              photoUrl: res.venue.photoUrl ?? null,
            });
          })
          .catch(() => {});
      } else {
        revealRequestRef.current = null;
      }
      // Start on the suggestion's own venue. Also covers ideas with no search
      // category, where the venue effect bails before it can select anything.
      const ideaVenue = suggestedVenueFor(hostingIdea);
      setSelectedVenue(ideaVenue);
      // Saved venues carry no photo — fetch one so the card isn't a blank tile.
      setIdeaVenuePhotoUrl(null);
      if (ideaVenue && !ideaVenue.photoUrl) {
        fetchVenuePhotoUrl({
          name: ideaVenue.name,
          address: ideaVenue.address,
          placeId: ideaVenue.placeId === SUGGESTED_VENUE_ID ? null : ideaVenue.placeId,
        })
          .then((url) => { if (url) setIdeaVenuePhotoUrl(url); })
          .catch(() => {});
      }
    }
  }, [hostingIdea, org?.requireApprovalDefault]);
  useEffect(() => {
    if (creatingCustomPlan) setCustomRequireApproval(org?.requireApprovalDefault === true);
  }, [creatingCustomPlan, org?.requireApprovalDefault]);

  // Fetch Unsplash images when venue is selected and title is typed
  useEffect(() => {
    if (!selectedVenue || !customTitle.trim() || !creatingCustomPlan) {
      setUnsplashPhotos([]);
      return;
    }

    setUnsplashLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await Parse.Cloud.run("searchUnsplashPhotos", {
          query: customTitle.trim(),
        });
        setUnsplashPhotos(results || []);
      } catch {
        setUnsplashPhotos([]);
      } finally {
        setUnsplashLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [customTitle, selectedVenue, creatingCustomPlan]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth / 2
          : scrollLeft + clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  const handleHostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostingIdea) return;
    const isOwnerOrHost = org && (org.isOwner || org.isHost);

    // Non-owners must verify phone first
    if (!isOwnerOrHost && !hostVerify.isVerified) return;

    setHostSubmitting(true);
    setHostError(null);

    const form = e.target as HTMLFormElement;
    const dateInput = form.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = form.querySelector('input[type="time"]') as HTMLInputElement;
    const timeValue = timeInput.value || "18:00";

    // A featured suggestion's time belongs to the VENUE's zone, not the
    // browser's — a NYC showtime hosted by someone in LA is still 7:30 ET.
    // Everything else keeps the existing browser-offset behavior.
    let offsetSuffix: string;
    if (hostingIdea.isFeatured && hostingIdea.venueTimeZone) {
      offsetSuffix = zoneOffsetSuffix(dateInput.value, timeValue, hostingIdea.venueTimeZone);
    } else {
      const offset = new Date().getTimezoneOffset();
      const sign = offset <= 0 ? "+" : "-";
      const absH = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
      const absM = String(Math.abs(offset) % 60).padStart(2, "0");
      offsetSuffix = `${sign}${absH}:${absM}`;
    }
    const dateTime = `${dateInput.value}T${timeValue}${offsetSuffix}`;

    // Featured suggestions have no CalendarGeneratedPlan row, so hostPlanIdea
    // (which looks one up by id) would 404. Route them through the free-form
    // custom-plan path instead — same resulting EventGroup, same approval flow.
    if (hostingIdea.isFeatured) {
      try {
        const result = await Parse.Cloud.run("requestCustomPlanViaWeb", {
          shareId,
          title: hostingIdea.title,
          description: hostingIdea.description || hostingIdea.title,
          imageUrl: hostingIdea.image || undefined,
          date: dateTime,
          capacity: hostingIdea.suggestedCapacity || 20,
          hostNote: hostNote.trim() || undefined,
          name: !isOwnerOrHost ? hostVerify.name.trim() : undefined,
          phoneNumber: !isOwnerOrHost ? `+1${hostVerify.phone.replace(/\D/g, "")}` : undefined,
          email: !isOwnerOrHost && hostEmail.trim() ? hostEmail.trim() : undefined,
          requireApproval: hostRequireApproval,
          venue: selectedVenue
            ? {
                placeId: selectedVenue.placeId,
                name: selectedVenue.name,
                address: selectedVenue.address,
                photoUrl: selectedVenue.photoUrl,
                rating: selectedVenue.rating,
              }
            : undefined,
        });
        setHostSuccess(result?.pendingApproval ? "pending" : true);
        setHostNote("");
        setHostEmail("");
        setSelectedVenue(null);
        if (!isOwnerOrHost && !isFollowing && org) {
          setIsFollowing(true);
          setFollowerCount((c) => c + 1);
          setToast(`You're now following ${org.name}`);
        }
      } catch (err) {
        setToast((err as Error).message || "Could not create that plan.");
      } finally {
        setHostSubmitting(false);
      }
      return;
    }

    try {
      const result = await Parse.Cloud.run("hostPlanIdea", {
        calendarPlanId: hostingIdea.id,
        date: dateTime,
        capacity: hostingIdea.suggestedCapacity || 20,
        hostNote: hostNote.trim() || undefined,
        hostName: !isOwnerOrHost ? hostVerify.name.trim() : undefined,
        hostPhone: !isOwnerOrHost ? `+1${hostVerify.phone.replace(/\D/g, "")}` : undefined,
        hostEmail: !isOwnerOrHost && hostEmail.trim() ? hostEmail.trim() : undefined,
        requireApproval: hostRequireApproval,
        // Omitting `venue` tells the server to keep the suggestion's own
        // location — right when the pick is still the suggested one, and it
        // preserves that location's already-resolved timezone.
        venue: selectedVenue && selectedVenue.placeId !== hostSuggestedVenue?.placeId ? {
          placeId: selectedVenue.placeId,
          name: selectedVenue.name,
          address: selectedVenue.address,
          photoUrl: selectedVenue.photoUrl,
          rating: selectedVenue.rating,
        } : undefined,
      });
      setHostSuccess(result?.pendingApproval ? "pending" : true);
      setHostNote("");
      setHostEmail("");
      setSelectedVenue(null);
      // Auto-follow visual update for non-owners/hosts
      if (!isOwnerOrHost && !isFollowing && org) {
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
        setToast(`You're now following ${org.name}`);
        setTimeout(() => setToast(null), 3000);
      }
      // Refresh data to show the new plan
      fetchOrg();
      setTimeout(() => {
        setHostingIdea(null);
        setHostSuccess(false);
      }, 2000);
    } catch (err) {
      // This used to only console.error, so a rejected submit looked like
      // nothing happened at all — the server's reason (venue closed at that
      // time, idea already claimed) never reached the person who could act on it.
      console.error("Failed to host plan idea:", err);
      setHostError(
        err instanceof Error && err.message
          ? err.message
          : "Couldn't send that. Try again in a moment.",
      );
      setHostSubmitting(false);
    }
  };

  const handleCustomPlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    const isOwnerOrHost = org.isOwner || org.isHost;
    if (!isOwnerOrHost && !customVerify.isVerified) return;
    if (!selectedVenue) return;
    if (!customTitle.trim() || !customDescription.trim()) return;

    setCustomSubmitting(true);

    const form = e.target as HTMLFormElement;
    const dateInput = form.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = form.querySelector('input[type="time"]') as HTMLInputElement;
    // Append local timezone offset so the server stores the correct UTC time
    // (e.g. "2026-09-13T18:00" + "-04:00" for Eastern Daylight Time)
    const offset = new Date().getTimezoneOffset();
    const sign = offset <= 0 ? "+" : "-";
    const absH = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
    const absM = String(Math.abs(offset) % 60).padStart(2, "0");
    const dateTime = `${dateInput.value}T${timeInput.value || "18:00"}${sign}${absH}:${absM}`;

    try {
      const result = await Parse.Cloud.run("requestCustomPlanViaWeb", {
        shareId,
        name: isOwnerOrHost ? undefined : customVerify.name.trim(),
        phoneNumber: isOwnerOrHost ? undefined : `+1${customVerify.phone.replace(/\D/g, "")}`,
        email: !isOwnerOrHost && customEmail.trim() ? customEmail.trim() : undefined,
        requireApproval: customRequireApproval,
        title: customTitle.trim(),
        description: customDescription.trim(),
        date: dateTime,
        venue: {
          placeId: selectedVenue.placeId,
          name: selectedVenue.name,
          address: selectedVenue.address,
          photoUrl: selectedVenue.photoUrl,
          rating: selectedVenue.rating,
        },
        capacity: customCapacity ? parseInt(customCapacity, 10) : undefined,
        hostNote: hostNote.trim() || undefined,
        imageUrl: selectedImageUrl || undefined,
      });
      if (!isOwnerOrHost) {
        setVerifiedUserCookie(customVerify.name, customVerify.phone);
      }
      setCustomSuccess(result?.pendingApproval === false ? "published" : true);
      setHostNote("");
      setCustomEmail("");
      setSelectedVenue(null);
      setSelectedImageUrl(null);
      setUnsplashPhotos([]);
      // Auto-follow visual update for non-owners/hosts
      if (!isOwnerOrHost && !isFollowing && org) {
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
        setToast(`You're now following ${org.name}`);
        setTimeout(() => setToast(null), 3000);
      }
      // Refresh so a newly published plan shows up immediately.
      if (result?.pendingApproval === false) {
        fetchOrg();
      }
      setTimeout(() => {
        setCreatingCustomPlan(false);
        setCustomSuccess(false);
      }, 2500);
    } catch (err) {
      // Previously console-only, so a rejected submit looked like a dead
      // button. This is now the non-owner "edit a suggestion" path too, so the
      // reason has to reach the person.
      console.error("Failed to submit custom plan:", err);
      setToast(
        (err as Error)?.message || "Couldn’t submit that plan. Try again in a moment.",
      );
      setTimeout(() => setToast(null), 5000);
      setCustomSubmitting(false);
    }
  };

  // Spread "needs a host" ideas across the community's real cadence so a
  // server-stamped batch stops clustering on one day. Keyed by idea id;
  // used for both the card date and the Host-This prefill so they agree.
  // Recomputed hourly (nowBucket) so the 2-week floor rolls forward without
  // thrashing on every render.
  const nowBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const spreadIdeaDates = useMemo(() => {
    if (!org) return new Map<string, Date>();
    return computeSpreadIdeaDates(
      org.plans.map((p) => p.dateISO ?? null),
      // A featured suggestion's date is a real-world fact (a tournament's
      // opening day, a film's release), so it enters the spread already pinned:
      // it keeps its own day, reserves it against the fan-out, and — the part
      // that was wrong — stops eating a cadence slot a real idea could use.
      org.planIdeas.map((i) =>
        i.isFeatured
          ? {
              id: i.id,
              date: featuredWallClockDate(i)?.toISOString() ?? null,
              datePinned: true,
            }
          : { id: i.id, date: i.date, isManual: i.isManual, datePinned: i.datePinned }
      ),
      nowBucket * 60 * 60 * 1000
    );
  }, [org, nowBucket]);

  // 2a — "Around the city": a slim 122px full-width band. These are citywide
  // happenings looking for a host, not this calendar's own upcoming plans, so
  // they render ABOVE the "Upcoming Plans" label rather than inside that list.
  // Living outside <main> is also why there's no full-bleed hack here — the
  // band isn't inside the max-w-6xl column, so it has nothing to escape.
  //
  // Dropped from the tall card: the "Waiting on host" status row and the
  // "Run it yourself…" caption. The meta chips and the two buttons already say
  // both, and at this height a third text row reads as clutter, not hierarchy.
  const renderAroundTheCityBand = (idea: PlanIdea) => {
    if (!org) return null;
    const spreadDate =
      spreadIdeaDates.get(idea.id) ?? (idea.date ? new Date(idea.date) : null);
    let dateLabel: string | null = null;
    if (idea.isFeatured && idea.whenLabel) {
      // Server-rendered in the VENUE's zone. Reformatting from a UTC instant
      // would re-anchor it to the browser's zone — a 7:30 PM ET showtime is
      // not 4:30 PM for anyone.
      dateLabel = idea.whenLabel.toUpperCase();
    } else if (spreadDate) {
      dateLabel = spreadDate
        .toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        })
        .toUpperCase();
    }
    const priorCount =
      planIdeaInterestCounts[idea.id] ?? idea.interestCount ?? 0;
    const isInterested = planIdeaLocallyInterested.has(idea.id);
    const isPending = planIdeaInterestPending.has(idea.id);
    const canHost = org.isOwner || org.isHost || !!org.allowFollowersToHost;
    // Same entitlement split as the tall card — the server already nulled
    // name+address for viewers who don't get the venue, so this just renders
    // whatever survived, collapsed to one line.
    const venueLine = idea.location?.name
      ? `${idea.location.name}${idea.location.address ? ` · ${idea.location.address}` : ""}`
      : idea.location?.neighborhood || null;
    return (
      <article
        key={idea.id}
        className="grid grid-cols-1 sm:grid-cols-[232px_1fr] sm:h-[122px] overflow-hidden bg-[#0a0a0a]"
        style={{
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
        }}
      >
        <div className="relative h-40 sm:h-[122px] bg-[#161616]">
          {idea.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={idea.image}
              alt={idea.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-zinc-600" />
            </div>
          )}
          {/* Both kinds get the heart, but they write through different cloud
              functions — a featured suggestion has no CalendarGeneratedPlan for
              a PlanIdeaInterest to point at, so it goes to
              expressFeaturedInterest (and verifies phone first, since that one
              needs a real account rather than the interest cookie). */}
          <button
            type="button"
            onClick={() =>
              idea.isFeatured
                ? handleFeaturedInterest(idea.id, idea.title)
                : handlePlanIdeaInterest(idea.id)
            }
            disabled={isInterested || isPending}
            aria-label={isInterested ? "You're interested" : "I'm interested"}
            className={`absolute top-[10px] right-[10px] w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:cursor-default ${
              isInterested
                ? "bg-emerald-900/70 border-emerald-400/60"
                : "bg-[rgba(10,10,10,0.55)] border-[rgba(255,255,255,0.22)] hover:bg-[rgba(10,10,10,0.85)] hover:border-[rgba(255,255,255,0.55)]"
            }`}
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin text-white" />
            ) : (
              <Heart
                className="w-3 h-3 text-white"
                fill={isInterested ? "currentColor" : "none"}
              />
            )}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 px-5 py-[14px] min-w-0">
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3 text-[9px] leading-none font-medium uppercase tracking-[0.16em] whitespace-nowrap">
              <span className="border border-[#3a3a3a] px-[7px] py-1 text-white">
                Around the city
              </span>
              {dateLabel && <span className="text-[#8f8f8a]">{dateLabel}</span>}
              {/* The band has no heart badge to carry the count, so unlike the
                  tall card this shows for localized rows too — where the count
                  is this calendar's, not the admin suggestion's global one. */}
              {priorCount > 0 && (
                <span className="text-[#7fd6a8]">
                  {priorCount} nearby interested
                </span>
              )}
            </div>
            <h3 className="text-[21px] leading-[1.1] font-normal tracking-[-0.01em] text-white truncate">
              {idea.title}
            </h3>
            {(idea.description || venueLine) && (
              <div className="flex gap-2.5 text-xs leading-[1.4] overflow-hidden">
                {idea.description && (
                  <span className="shrink-0 whitespace-nowrap text-[#d9d9d5]">
                    {idea.description}
                  </span>
                )}
                {venueLine && (
                  <span className="flex-1 min-w-0 truncate text-[#6d6d68]">
                    {venueLine}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex-none flex flex-col gap-1.5 whitespace-nowrap">
            {canHost && (
              <button
                type="button"
                onClick={() => {
                  if (org.rsvpLimitReached) return;
                  setHostingIdea(idea);
                  setHostSubmitting(false);
                  setHostError(null);
                  setHostSuccess(false);
                  setHostNote("");
                  setSelectedVenue(null);
                }}
                disabled={org.rsvpLimitReached}
                className={`px-4 py-[9px] text-[10px] leading-none font-medium uppercase tracking-[0.16em] transition-colors ${
                  org.rsvpLimitReached
                    ? "bg-transparent border border-[#3a3a3a] text-[#6d6d68] cursor-not-allowed"
                    : "bg-white text-[#0a0a0a] hover:bg-[#dcdcd8]"
                }`}
              >
                Host this
              </button>
            )}
            {org.isOwner && (
              <button
                type="button"
                onClick={() =>
                  setVirtualHostPlan({
                    calendarId: org.objectId,
                    planIdeaId: idea.id,
                  })
                }
                className="px-4 py-[9px] text-[10px] leading-none font-medium uppercase tracking-[0.16em] bg-transparent border border-[#3a3a3a] text-white hover:border-[#7a7a7a] transition-colors flex items-center gap-[7px]"
              >
                <span className="w-[7px] h-[7px] rounded-full bg-[#8f7a4a] shrink-0" />
                Let Leaf host it
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-zinc-400" />
          <p className="text-sm text-zinc-400 uppercase tracking-widest">Loading calendar...</p>
        </div>
      </div>
    );
  }

  // Inactive calendar state
  if (isInactive) {
    return (
      <div className="min-h-screen">
        <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-zinc-100 px-6 py-8">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-light tracking-wider uppercase">
              {isInactive.name}
            </h1>
            <span className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
              Calendar
            </span>
          </div>
        </nav>
        <div className="flex items-center justify-center px-6" style={{ minHeight: "calc(100vh - 100px)" }}>
          <div className="text-center space-y-4 max-w-md">
            <Calendar className="w-12 h-12 mx-auto text-zinc-300" />
            <h2 className="text-2xl font-light">This calendar is currently inactive</h2>
            <p className="text-zinc-400 text-sm">The calendar owner&apos;s plan does not include this calendar. Please check back later.</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-md">
          <h2 className="text-2xl font-light">Calendar not found</h2>
          <p className="text-zinc-500 text-sm">{error || "This calendar doesn't exist or is no longer available."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Desktop Header (2 rows) */}
      <nav className="sticky top-0 z-40 w-full bg-white hidden md:block border-b border-[#ececea]">
        {/* Row 1: Identity Bar */}
        <div className="h-[62px] flex items-center justify-between px-10 border-b border-[#ececea]">
          <div className="flex items-center gap-3.5">
            {org.profilePhoto && org.tier !== "starter" && (
              <img
                src={org.profilePhoto}
                alt={org.name}
                className="w-[34px] h-[34px] rounded object-cover flex-none"
              />
            )}
            <div className="flex items-center gap-3.5">
              <h1 className="text-[18px] font-bold tracking-[0.05em] uppercase text-[#1a1a1a] whitespace-nowrap">
                {org.name}
              </h1>
              <span className="text-[10px] font-bold tracking-[0.11em] uppercase text-[#9a9a9a]">
                {followerCount} followers {org.pastPlanCount > 0 && `· ${org.pastPlanCount} past plan${org.pastPlanCount === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!org.isOwner && !org.isHost && (
              isFollowing ? (
                <button
                  onClick={handleUnfollow}
                  className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-red-50 hover:border-red-200 hover:text-red-600 px-3 py-1.5 rounded-full transition-colors group"
                >
                  <Check className="w-3.5 h-3.5 group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:block" />
                  <span className="group-hover:hidden">Following</span>
                  <span className="hidden group-hover:inline">Unfollow</span>
                </button>
              ) : followRequestPending ? (
                <span className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-amber-600 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-full">
                  <Clock className="w-3.5 h-3.5" />
                  Pending
                </span>
              ) : (
                <button
                  onClick={() => setShowFollowModal(true)}
                  className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 px-3 py-1.5 rounded-full"
                >
                  <Heart className="w-3.5 h-3.5" />
                  {org.isPrivate ? "Request to Follow" : "Follow"}
                </button>
              )
            )}
            {(org.isOwner || org.isHost) && (
              <>
                <button
                  onClick={async () => {
                    const url = window.location.href;
                    const title = org.name;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title, url });
                      } catch {
                        /* user cancelled */
                      }
                    } else {
                      try {
                        await navigator.clipboard.writeText(url);
                      } catch {
                        /* clipboard blocked */
                      }
                    }
                  }}
                  className="h-[34px] px-4 flex items-center justify-center text-[11px] font-bold tracking-[0.11em] uppercase text-[#4a4a4a] border border-[#dcdcdc] hover:bg-zinc-50 transition-colors"
                  aria-label="Share calendar"
                >
                  Share
                </button>
                <Link
                  href={`/dashboard/${org.parentOrgId || org.objectId}`}
                  className="h-[34px] px-[18px] flex items-center gap-1.5 text-[11px] font-bold tracking-[0.11em] uppercase text-white bg-[#1a1a1a] hover:opacity-90 transition-opacity"
                >
                  Manage
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Header (single row) */}
      <nav className="sticky top-0 z-40 w-full bg-white md:hidden border-b border-[#ececea]">
        <div className="flex items-center gap-3 px-4 py-3">
          {org.profilePhoto && org.tier !== "starter" && (
            <img
              src={org.profilePhoto}
              alt={org.name}
              className="w-[34px] h-[34px] rounded object-cover flex-none"
            />
          )}
          <div className="flex-1 min-w-0 gap-[3px] flex flex-col">
            <h1 className="text-[12px] font-bold tracking-[0.06em] uppercase leading-[1.35] line-clamp-2 text-[#1a1a1a]">
              {org.name}
            </h1>
            <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-[#9a9a9a] whitespace-nowrap">
              {followerCount} followers · {org.pastPlanCount} past plan{org.pastPlanCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-none">
            {!org.isOwner && !org.isHost && (
              isFollowing ? (
                <button
                  onClick={handleUnfollow}
                  className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-red-50 hover:border-red-200 hover:text-red-600 px-3 py-1.5 rounded-full transition-colors group"
                >
                  <Check className="w-3.5 h-3.5 group-hover:hidden" />
                  <X className="w-3.5 h-3.5 hidden group-hover:block" />
                  <span className="group-hover:hidden">Following</span>
                  <span className="hidden group-hover:inline">Unfollow</span>
                </button>
              ) : followRequestPending ? (
                <span className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-amber-600 border border-amber-200 bg-amber-50 px-3 py-1.5 rounded-full">
                  <Clock className="w-3.5 h-3.5" />
                  Pending
                </span>
              ) : (
                <button
                  onClick={() => setShowFollowModal(true)}
                  className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-bold text-zinc-500 hover:text-zinc-900 transition-colors border border-zinc-200 px-3 py-1.5 rounded-full"
                >
                  <Heart className="w-3.5 h-3.5" />
                  {org.isPrivate ? "Request to Follow" : "Follow"}
                </button>
              )
            )}
            {(org.isOwner || org.isHost) && (
              <>
                <button
                  onClick={async () => {
                    const url = window.location.href;
                    const title = org.name;
                    if (navigator.share) {
                      try {
                        await navigator.share({ title, url });
                      } catch {
                        /* user cancelled */
                      }
                    } else {
                      try {
                        await navigator.clipboard.writeText(url);
                      } catch {
                        /* clipboard blocked */
                      }
                    }
                  }}
                  className="h-8 w-8 p-2.5 flex items-center justify-center text-[9px] font-bold tracking-[0.09em] uppercase text-[#4a4a4a] border border-[#dcdcdc] hover:bg-zinc-50 transition-colors"
                  aria-label="Share calendar"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <Link
                  href={`/dashboard/${org.parentOrgId || org.objectId}`}
                  className="h-8 px-2.5 flex items-center text-[9px] font-bold tracking-[0.09em] uppercase text-white bg-[#1a1a1a] hover:opacity-90 transition-opacity"
                >
                  <Settings className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Private calendar gate */}
      {org.isPrivate && !org.isFollower && !org.isOwner && !org.isHost ? (
        <main className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-md mx-auto text-center space-y-6">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <h2 className="text-2xl font-light tracking-tight mb-2">This is a private calendar</h2>
              <p className="text-sm text-zinc-500">
                Request to follow to see upcoming plans and ideas.
              </p>
            </div>
            {followRequestPending || org.followRequestPending ? (
              <div className="flex items-center justify-center gap-2 py-3 px-6 bg-amber-50 border border-amber-200 rounded-lg">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700 font-medium">Request pending</span>
              </div>
            ) : (
              <button
                onClick={() => setShowFollowModal(true)}
                className="text-white px-8 py-3 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-90 rounded-lg"
                style={{ backgroundColor: org.brandColor || "#18181b" }}
              >
                Request to Follow
              </button>
            )}
          </div>
        </main>
      ) : (
      <>
      {/* Stream Header — plans lead the page so the community-calendar
          pitch (residents host things for each other) drives the visual
          identity. Local deals appear below the plans stream as a
          supporting benefit, not the main attraction. */}
      {/* Around the city — full-width, flush under the profile header and
          above the "Upcoming Plans" label, which belongs to the list below. */}
      {!org.hidePlanIdeas &&
        org.planIdeas
          .filter((i) => i.isFeatured === true || i.sourceKind === "featured")
          .map((idea) => renderAroundTheCityBand(idea))}

      <div className="max-w-6xl mx-auto px-6 pt-12 pb-6 flex justify-between items-end border-b border-zinc-100 md:hidden">
        <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
          Upcoming Plans
        </p>
      </div>

      {/* Plans Stream */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {org.plans.length === 0 &&
          (!org.aiSourceEvents || org.aiSourceEvents.length === 0) && (
            <div
              className={`${
                org.planIdeas.length > 0 ? "py-12" : "py-24"
              } text-center space-y-4`}
            >
              <Calendar className="w-12 h-12 text-zinc-300 mx-auto" />
              <h3 className="text-xl font-light">No upcoming plans yet</h3>
              <p className="text-zinc-400 text-sm">
                {org.planIdeas.length > 0
                  ? "Browse curated plan ideas below and host one for your community."
                  : `Check back soon for new events from ${org.name}.`}
              </p>
            </div>
          )}

        {(() => {
          // Unified upcoming stream — confirmed plans + "needs a host"
          // suggestions interleaved by DATE into one alternating-row list, so
          // the calendar reads chronologically instead of "all confirmed,
          // then all suggested." Confirmed plans always render; suggestions
          // (AI source events OR plan ideas — mutually exclusive) are capped
          // in-line with a show-more toggle so they never bury real plans.
          const IDEA_INLINE_CAP = 4;
          const spreadOf = (i: PlanIdea) =>
            spreadIdeaDates.get(i.id) ?? (i.date ? new Date(i.date) : null);

          type StreamEntry = {
            key: string;
            date: number;
            render: (index: number) => React.ReactNode;
          };
          const streamItems: StreamEntry[] = [];
          let hiddenSuggestedCount = 0;

          // --- Confirmed plans (always shown) ---
          const renderConfirmedPlanCard = (plan: Plan, index: number) => (
              <article
                key={plan.id}
                className={`group flex flex-col md:flex-row gap-12 md:items-center ${
                  index % 2 !== 0 ? "md:flex-row-reverse" : ""
                }`}
              >
                <div
                  className="w-full md:w-3/5 aspect-[16/10] overflow-hidden cursor-pointer bg-zinc-100 shadow-sm"
                  onClick={() => setSelectedEvent(plan)}
                >
                  {plan.image ? (
                    <img
                      src={plan.image}
                      alt={plan.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="w-16 h-16 text-zinc-300" />
                    </div>
                  )}
                </div>

                <div className="w-full md:w-2/5 space-y-6">
                  <div className="space-y-2">
                    <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400">
                      {plan.isPoll ? (
                        <>
                          Date Poll &bull; {plan.pollOptionCount || 0} {plan.pollOptionCount === 1 ? "option" : "options"}
                          {plan.pollClosesAt && (() => {
                            const ms = new Date(plan.pollClosesAt).getTime() - Date.now();
                            if (ms <= 0) return <> &bull; closed</>;
                            const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
                            return <> &bull; {days}d left</>;
                          })()}
                        </>
                      ) : (
                        <>{plan.date}{plan.time ? <> &bull; {plan.time}</> : ""}</>
                      )}
                    </p>
                    <h3 className="text-3xl font-light tracking-tight group-hover:italic transition-all">
                      {plan.title}
                    </h3>
                    <div className="pt-2">
                      {/* Card state — leaf-host outcomes take precedence
                          because they carry the strongest signal (Leaf
                          delivered, or is delivering). Server already
                          stripped `leaf_arranging` from non-owner
                          payloads so the arranging line is safe to
                          render whenever it's present.
                          * leaf_hosted   → public: HOSTED BY LEAF · Sara
                          * leaf_arranging → owner-only: LEAF IS ARRANGING THIS
                          * default        → Hosted by {plan.hostName} */}
                      {plan.virtualHost ? (
                        <div className="flex items-center gap-2">
                          {plan.virtualHostPersona?.avatarUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={plan.virtualHostPersona.avatarUrl}
                              alt=""
                              aria-hidden="true"
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-zinc-200 flex-shrink-0"
                            />
                          )}
                          <p className="text-xs tracking-wider uppercase text-zinc-900 font-bold">
                            Organized by {plan.virtualHostPersona?.name || "your host"}
                          </p>
                          <VirtualHostBadge persona={plan.virtualHostPersona} />
                        </div>
                      ) : plan.leafHostState === "leaf_hosted" ? (
                        <div className="flex items-center gap-2">
                          {plan.leafHostPersona?.avatarUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={plan.leafHostPersona.avatarUrl}
                              alt=""
                              aria-hidden="true"
                              className="w-5 h-5 rounded-full object-cover ring-1 ring-zinc-200 flex-shrink-0"
                            />
                          )}
                          <p className="text-xs tracking-wider uppercase text-zinc-900 font-bold">
                            Hosted by Leaf
                            {plan.leafHostPersona?.name ? ` · ${plan.leafHostPersona.name}` : ""}
                          </p>
                        </div>
                      ) : plan.leafHostState === "leaf_arranging" ? (
                        <p className="text-xs tracking-wider uppercase text-zinc-500 font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          Leaf is arranging this
                        </p>
                      ) : (
                        <p className="text-xs tracking-wider uppercase text-zinc-900 font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: org.brandColor || "#18181b" }} />
                          Hosted by {plan.hostName}
                        </p>
                      )}
                      {/* Owner-only: let Leaf host this host-less plan (virtual
                          host). Server sets virtualHostAddable only for the owner
                          on plans with no host and no RSVPs yet. Same label/style
                          as the suggested-card CTA for one consistent action. */}
                      {plan.virtualHostAddable && (
                        <button
                          type="button"
                          onClick={() => setVirtualHostPlan({ calendarId: org.objectId, eventGroupId: plan.id })}
                          className="mt-2 w-fit px-6 py-3 text-xs uppercase tracking-widest font-medium flex items-center gap-2 border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 transition-colors"
                        >
                          <HostAvatar src={virtualHostAvatar || DEFAULT_HOST_AVATAR} className="w-4 h-4" /> Let Leaf host it
                        </button>
                      )}
                      {/* Per-plan leaf-host chat pill — owner-only.
                          Server strips these fields for non-owners so
                          the button never surfaces publicly. Unread
                          badge inside the pill; click opens a plan-
                          scoped drawer (LeafHostPlanThread). */}
                      {plan.hasLeafHostChat && plan.leafHostPersona && (
                        <button
                          type="button"
                          onClick={() => setLeafHostChatPlanId(plan.id)}
                          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 transition-colors text-xs font-medium text-zinc-700"
                        >
                          {plan.leafHostPersona.avatarUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={plan.leafHostPersona.avatarUrl}
                              alt=""
                              aria-hidden="true"
                              className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <MessageCircle className="w-3.5 h-3.5" />
                          )}
                          Chat with {plan.leafHostPersona.name || "your concierge"}
                          {(plan.leafHostChatUnread ?? 0) > 0 && (
                            <span className="min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
                              {(plan.leafHostChatUnread ?? 0) > 9
                                ? "9+"
                                : plan.leafHostChatUnread}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-zinc-500 leading-relaxed font-light text-lg line-clamp-3">
                    {plan.description}
                  </p>

                  <div className="pt-2 flex flex-col gap-6">
                    {plan.isPoll ? (
                      <>
                        <p className="text-xs tracking-widest uppercase font-bold text-zinc-500">
                          {plan.pollVoteCount || 0} {plan.pollVoteCount === 1 ? "Vote" : "Votes"} so far
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button
                            onClick={() => setSelectedEvent(plan)}
                            className="text-white px-6 py-3 text-xs uppercase tracking-widest font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                            style={{ backgroundColor: org.brandColor || "#18181b" }}
                          >
                            Vote on a Date <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSharePlan(plan.id, plan.title)}
                            className="border border-zinc-200 px-5 py-3 hover:bg-zinc-50 transition-colors relative flex items-center justify-center gap-2"
                          >
                            {copiedPlanId === plan.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                            <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <AvatarStack count={plan.attendeeCount} />
                          {viewerHostsPlan(plan) ? (
                            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Hosting
                            </span>
                          ) : pendingRsvpIds.has(plan.id) ? (
                            <span className="text-xs font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          ) : rsvpedPlanIds.has(plan.id) ? (
                            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Attending
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* "View Details" for everyone — RSVP'd, hosting, pending, or new.
                              The modal handles state-specific actions (Join Plan Chat for
                              attendees, Message Attendees for hosts, Cancel RSVP, etc.). */}
                          <button
                            onClick={() => setSelectedEvent(plan)}
                            className="text-white px-6 py-3 text-xs uppercase tracking-widest font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                            style={{ backgroundColor: org.brandColor || "#18181b" }}
                          >
                            View Details <ArrowUpRight className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSharePlan(plan.id, plan.title)}
                            className="border border-zinc-200 px-5 py-3 hover:bg-zinc-50 transition-colors relative flex items-center justify-center gap-2"
                          >
                            {copiedPlanId === plan.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                            <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </article>
          );
          org.plans.forEach((plan) => {
            streamItems.push({
              key: `plan-${plan.id}`,
              date: plan.dateISO
                ? new Date(plan.dateISO).getTime()
                : Number.POSITIVE_INFINITY,
              render: (index) => renderConfirmedPlanCard(plan, index),
            });
          });

          // --- Suggested: AI-adopted source events ---
          const renderAiEventCard = (
            entry: {
              ev: NonNullable<OrgData["aiSourceEvents"]>[number];
              originalIndex: number;
              resolved: { date: Date | null; instant: Date | null; isWeekly: boolean };
            },
            index: number
          ) => {
            const { ev, originalIndex, resolved } = entry;
                      const validDate = resolved.date as Date;
                      const interestCount =
                        aiInterestCounts[originalIndex] ??
                        org.aiSourceEventInterests?.[originalIndex] ??
                        0;
                      const isInterested = aiLocallyInterested.has(originalIndex);
                      const isPending = aiInterestPending.has(originalIndex);
                      const kicker = `${formatDate(
                        validDate.toISOString(),
                        FLOATING_EVENT_TZ
                      ).toUpperCase()} · ${formatTime(
                        validDate.toISOString(),
                        FLOATING_EVENT_TZ
                      )}`;
                      const isAmber = ev.tagVariant === "amber";
                      const cohortLabel = AUDIENCE_COHORT_LABELS[ev.audienceTag ?? ""];
                      return (
                        <article
                          key={index}
                          className={`group flex flex-col md:flex-row gap-12 md:items-center ${
                            index % 2 !== 0 ? "md:flex-row-reverse" : ""
                          }`}
                        >
                          {/* Cover — the generator's Unsplash photo when it
                              resolved one, otherwise the soft-green (or
                              amber for the finale) gradient with the tag
                              rendered LARGE in serif so the card still
                              reads as intentional visual work rather than
                              a missing image. */}
                          <div
                            className="w-full md:w-3/5 aspect-[16/10] overflow-hidden shadow-sm relative flex items-center justify-center"
                            style={{
                              background: isAmber
                                ? "linear-gradient(135deg, #f5e6d0 0%, #e8d1a5 100%)"
                                : "linear-gradient(135deg, #e8efe9 0%, #cddcd0 100%)",
                            }}
                          >
                            {ev.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={ev.imageUrl}
                                alt=""
                                loading="lazy"
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            ) : (
                              <>
                            <div
                              className="absolute inset-0 opacity-[0.07]"
                              style={{
                                backgroundImage:
                                  "radial-gradient(circle at 25% 30%, rgba(0,0,0,0.15) 1px, transparent 2px)",
                                backgroundSize: "18px 18px",
                              }}
                            />
                            <span
                              className="relative text-4xl md:text-6xl font-light tracking-tight text-center px-6"
                              style={{
                                fontFamily:
                                  'ui-serif, Georgia, "Times New Roman", serif',
                                color: isAmber ? "#8A5F1E" : "#1B4332",
                                letterSpacing: "-0.01em",
                              }}
                            >
                              {(ev.tag || "Event").toLowerCase()}
                            </span>
                              </>
                            )}
                            <span
                              className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1"
                              style={{
                                background: "rgba(255,255,255,0.85)",
                                color: isAmber ? "#8A5F1E" : "#1B4332",
                                backdropFilter: "blur(4px)",
                              }}
                            >
                              Suggested
                            </span>
                          </div>

                          <div className="w-full md:w-2/5 space-y-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 min-w-0">
                                <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400 flex items-center gap-2 flex-wrap">
                                  <span>{kicker}</span>
                                  {/* Cohort chip. "any" and untagged rows show
                                      nothing — a chip on every card would make
                                      the targeted ones stop standing out, which
                                      is the entire point of tagging them. */}
                                  {cohortLabel && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-zinc-900">
                                        {cohortLabel}
                                      </span>
                                    </>
                                  )}
                                </p>
                                <h3 className="text-3xl font-light tracking-tight group-hover:italic transition-all">
                                  {ev.title || ev.name}
                                </h3>
                                <div className="pt-2">
                                  <p className="text-xs tracking-wider uppercase text-zinc-900 font-bold flex items-center gap-2">
                                    <span
                                      className="w-2 h-2 rounded-full"
                                      style={{
                                        backgroundColor:
                                          org.brandColor || "#1B4332",
                                      }}
                                    />
                                    Waiting on host
                                  </p>
                                </div>
                              </div>
                              {/* Interest heart — top-right of the title
                                  (replaces the old inline "I'm interested"
                                  button). Public; cookie-deduped server-side,
                                  optimistic here. Badge shows the count. */}
                              <button
                                type="button"
                                onClick={() => handleAIEventInterest(originalIndex)}
                                disabled={isInterested || isPending}
                                aria-label={isInterested ? "You're interested" : "I'm interested"}
                                className={`relative shrink-0 w-12 h-12 rounded-full border flex items-center justify-center transition-colors disabled:cursor-default ${isInterested ? "bg-emerald-50 border-emerald-300" : "border-zinc-200 hover:border-zinc-300"}`}
                              >
                                {isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                ) : (
                                  <Heart
                                    className={`w-5 h-5 ${isInterested ? "text-emerald-700" : "text-zinc-400"}`}
                                    fill={isInterested ? "currentColor" : "none"}
                                  />
                                )}
                                {interestCount > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">
                                    {interestCount}
                                  </span>
                                )}
                              </button>
                            </div>

                            <div className="space-y-2">
                              {ev.description && (
                                <p className="text-zinc-700 leading-relaxed font-light text-lg">
                                  {ev.description}
                                </p>
                              )}
                              {/* Venue name. The headline deliberately never
                                  names the place (the generator strips it), so
                                  without this line the card showed a street
                                  address with nothing to attach it to — the
                                  address was public while the name it belongs
                                  to was not. */}
                              {ev.name && (
                                <p className="text-zinc-900 font-medium text-sm">
                                  {ev.name}
                                </p>
                              )}
                              <p className="text-zinc-500 leading-relaxed font-light text-sm">
                                {ev.venueLine}
                              </p>
                            </div>

                            <div className="pt-2 flex flex-col gap-6">
                              <div className="flex flex-col sm:flex-row gap-4">
                                {/* Host This — permission matrix:
                                      owner/co-host                   → active
                                      allowFollowersToHost            → active
                                      not allowed                     → hidden

                                    Non-followers get an ACTIVE button, not a
                                    disabled one. Hosting is a strictly stronger
                                    commitment than following, so requiring the
                                    follow first gated the most valuable action
                                    behind the weaker one — and the explanation
                                    lived in a `title` tooltip, which does not
                                    exist on a phone, so the reader saw a dead
                                    grey button and no reason why. It bit hardest
                                    on the host-ask SMS, which deep-links exactly
                                    the people who have not followed yet.

                                    The server creates the follow as part of
                                    hosting; the confirmation modal says so. */}
                                {(() => {
                                  const canHostAsHost = org.isOwner || org.isHost;
                                  const active =
                                    canHostAsHost || !!org.allowFollowersToHost;
                                  if (!active) return null;
                                  return (
                                    <button
                                      onClick={() => {
                                        // Prefill the follower's note with the
                                        // attribution line the server used to
                                        // stamp on silently, so it stays the
                                        // default but is theirs to rewrite.
                                        // Owners/co-hosts start blank — they
                                        // never got an auto-note, and "hosted
                                        // from a suggestion on your own
                                        // calendar" reads as noise.
                                        setHostThisNote(
                                          canHostAsHost
                                            ? ""
                                            : `Hosted from an AI Suggestion on ${org.name}.`
                                        );
                                        setHostThisEventIndex(originalIndex);
                                      }}
                                      className="px-6 py-3 text-xs uppercase tracking-widest font-medium flex items-center justify-center gap-2 transition-opacity text-white hover:opacity-90"
                                      style={{ backgroundColor: org.brandColor || "#18181b" }}
                                    >
                                      Host This
                                    </button>
                                  );
                                })()}
                                {/* Owner-only: let Leaf host it (virtual host).
                                    Sits inline beside Host This — Host This runs
                                    it yourself; this hands it to an AI-assisted
                                    Leaf host. Server re-checks owner + venue/date
                                    eligibility; the client gate is convenience. */}
                                {org.isOwner && ev.placeId && (
                                  <button
                                    type="button"
                                    onClick={() => setVirtualHostPlan({ calendarId: org.objectId, aiEventIndex: originalIndex })}
                                    className="px-6 py-3 text-xs uppercase tracking-widest font-medium flex items-center justify-center gap-2 border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 transition-colors"
                                  >
                                    <HostAvatar src={virtualHostAvatar || DEFAULT_HOST_AVATAR} className="w-4 h-4" /> Let Leaf host it
                                  </button>
                                )}
                              </div>
                              {org.isOwner && ev.placeId && (
                                <p className="text-xs text-zinc-400 italic">Run it yourself, or let Leaf plan &amp; run it for you.</p>
                              )}
                            </div>
                          </div>
                        </article>
                      );
          };
          if (org.aiSourceEvents && org.aiSourceEvents.length > 0) {
              // Suggestions already materialized into a live plan (hosted or
              // virtual-hosted) are dropped here so they don't render twice —
              // once as a starter card and once as the real plan above.
              const hostedIdx = new Set(org.hostedAiEventIndexes || []);
              // Deleted by the owner — same skip-list treatment as hosted, so
              // followers stop seeing a card the owner removed.
              const dismissedIdx = new Set(org.dismissedAiEventIndexes || []);
              const rendered = org.aiSourceEvents
                .map((ev, originalIndex) => ({
                  ev,
                  originalIndex,
                  resolved: resolveAIEventDate(ev, org.orgTimezone ?? null),
                }))
                .filter(
                  (r) =>
                    r.resolved.date !== null &&
                    !hostedIdx.has(r.originalIndex) &&
                    !dismissedIdx.has(r.originalIndex),
                )
                // Client-side chronological safety net — the server sorts
                // on generate, but adopted calendars persisted before that
                // sort landed still show in emit order. Cost is a stable
                // n·log(n) once per render, worth the guaranteed ordering.
                .sort((a, b) => {
                  const at = (a.resolved.date as Date).getTime();
                  const bt = (b.resolved.date as Date).getTime();
                  return at - bt;
                });
            const visibleAi = showAllIdeas
              ? rendered
              : rendered.slice(0, IDEA_INLINE_CAP);
            hiddenSuggestedCount += rendered.length - visibleAi.length;
            visibleAi.forEach((entry) => {
              streamItems.push({
                key: `ai-${entry.originalIndex}`,
                date: (entry.resolved.date as Date).getTime(),
                render: (index) => renderAiEventCard(entry, index),
              });
            });
          }

          // --- Suggested: plan ideas ---
          const renderPlanIdeaCard = (idea: PlanIdea, index: number) => {
              const spreadDate = spreadOf(idea);
              let dateLabel: string | null = null;
              if (idea.isFeatured && idea.whenLabel) {
                // Server-rendered in the VENUE's zone. Reformatting it here
                // from a UTC instant would re-anchor it to the browser's zone,
                // which is exactly the bug the two-time-mode model exists to
                // avoid — a 7:30 PM ET showtime is not 4:30 PM for anyone.
                dateLabel = idea.whenLabel.toUpperCase();
              } else if (spreadDate) {
                dateLabel = `${spreadDate
                  .toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })
                  .toUpperCase()}`;
              }
              const ideaCohortLabel =
                AUDIENCE_COHORT_LABELS[idea.audienceTag ?? ""];
              // Two routes to the same treatment: a read-time featured
              // projection (venue already chosen by the admin) and a localized
              // row the resolver materialized here. Both read as "Around the
              // city" to a visitor — the distinction is ours, not theirs.
              const isAroundTheCity =
                idea.isFeatured === true || idea.sourceKind === "featured";
              const priorCount =
                planIdeaInterestCounts[idea.id] ??
                idea.interestCount ??
                0;
              const isInterested = planIdeaLocallyInterested.has(idea.id);
              const isPending = planIdeaInterestPending.has(idea.id);
              // Around the city is hoisted above the stream — see
              // renderAroundTheCityBand. Kept here so this function still
              // handles every idea kind if one ever reaches the stream.
              if (isAroundTheCity) return renderAroundTheCityBand(idea);
              // Flip alternation continuous with real plans below —
              // planIdeas rendered first means real plans start at the
              // idea count's parity.
              const flip = index % 2 !== 0;
              return (
                <article
                  key={idea.id}
                  className={`group flex flex-col md:flex-row gap-12 md:items-center ${flip ? "md:flex-row-reverse" : ""}`}
                >
                  <div
                    className="w-full md:w-3/5 aspect-[16/10] overflow-hidden shadow-sm relative bg-zinc-100"
                  >
                    {idea.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={idea.image}
                        alt={idea.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className="w-12 h-12 text-zinc-300" />
                      </div>
                    )}
                    <span
                      className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1"
                      style={
                        isAroundTheCity
                          ? {
                              background: "rgba(27,67,50,0.92)",
                              color: "#FFFFFF",
                              backdropFilter: "blur(4px)",
                            }
                          : {
                              background: "rgba(255,255,255,0.9)",
                              color: "#1B4332",
                              backdropFilter: "blur(4px)",
                            }
                      }
                    >
                      {isAroundTheCity ? "Around the city" : "Suggested"}
                    </span>
                  </div>
                  <div className="w-full md:w-2/5 space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 min-w-0">
                        {(dateLabel || ideaCohortLabel) && (
                          <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400 flex items-center gap-2 flex-wrap">
                            {dateLabel && <span>{dateLabel}</span>}
                            {/* Cohort chip — same treatment the starter cards
                                get. "any" and untagged render nothing so the
                                targeted ideas keep standing out. */}
                            {ideaCohortLabel && (
                              <>
                                {dateLabel && <span aria-hidden="true">·</span>}
                                <span className="text-zinc-900">{ideaCohortLabel}</span>
                              </>
                            )}
                          </p>
                        )}
                        <h3 className="text-3xl font-light tracking-tight group-hover:italic transition-all">
                          {idea.title}
                        </h3>
                        <div className="pt-2 space-y-1.5">
                          <p className="text-xs tracking-wider uppercase text-zinc-900 font-bold flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: org.brandColor || "#1B4332" }}
                            />
                            Waiting on host
                          </p>
                          {/* Featured has no interest BUTTON here (see below),
                              but the count still means something: it's how many
                              people already told us they want this. Read-only,
                              and worded so it doesn't read as this calendar's
                              followers — the counter lives on the admin's
                              suggestion and is shared by every calendar it
                              surfaces on. */}
                          {idea.isFeatured && priorCount > 0 && (
                            <p className="text-xs tracking-wider uppercase text-emerald-700 font-bold">
                              {priorCount} {priorCount === 1 ? "person" : "people"} nearby interested
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Interest heart — top-right of the title (replaces the
                          old inline "I'm interested" button). Public; cookie-
                          deduped server-side, optimistic here. Badge shows the
                          running interest count.

                          Hidden for Featured: this writes a PlanIdeaInterest
                          pointing at a CalendarGeneratedPlan, and a featured
                          suggestion has no such row. Featured interest is also
                          authenticated-only by design — it feeds cohort
                          matching, which needs a real user, not a cookie. So
                          web offers Host This and the app offers Mark
                          Interested, per the spec's split. */}
                      {!idea.isFeatured && (
                      <button
                        type="button"
                        onClick={() => handlePlanIdeaInterest(idea.id)}
                        disabled={isInterested || isPending}
                        aria-label={isInterested ? "You're interested" : "I'm interested"}
                        className={`relative shrink-0 w-12 h-12 rounded-full border flex items-center justify-center transition-colors disabled:cursor-default ${isInterested ? "bg-emerald-50 border-emerald-300" : "border-zinc-200 hover:border-zinc-300"}`}
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                        ) : (
                          <Heart
                            className={`w-5 h-5 ${isInterested ? "text-emerald-700" : "text-zinc-400"}`}
                            fill={isInterested ? "currentColor" : "none"}
                          />
                        )}
                        {priorCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">
                            {priorCount}
                          </span>
                        )}
                      </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {idea.description && (
                        <p className="text-zinc-700 leading-relaxed font-light text-lg">
                          {idea.description}
                        </p>
                      )}
                      {/* Venue when the viewer is entitled to it (owner /
                          co-host), neighborhood otherwise. The server decides
                          which by nulling name+address, so this is just a
                          render of whatever survived. */}
                      {idea.location?.name ? (
                        <p className="text-zinc-500 leading-relaxed font-light text-sm">
                          {idea.location.name}
                          {idea.location.address ? ` · ${idea.location.address}` : ""}
                        </p>
                      ) : idea.location?.neighborhood ? (
                        <p className="text-zinc-500 leading-relaxed font-light text-sm">
                          {idea.location.neighborhood}
                        </p>
                      ) : null}
                    </div>
                    <div className="pt-2 flex flex-col gap-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Host This — same permission matrix as
                            AI-suggested events. Tapping opens the
                            existing hostingIdea flow (create-plan
                            modal prefilled from the idea). */}
                        {(() => {
                          const canHostAsHost = org.isOwner || org.isHost;
                          // Hosting implies following: a non-follower gets an
                          // ACTIVE button, and the server creates the follow as
                          // part of hosting. See the AI-suggested-events block
                          // above for why the old disabled state was a dead end.
                          const active =
                            canHostAsHost || !!org.allowFollowersToHost;
                          if (!active) return null;
                          return (
                            <button
                              onClick={() => {
                                if (org.rsvpLimitReached) return;
                                setHostingIdea(idea);
                                setHostSubmitting(false);
                                setHostError(null);
                                setHostSuccess(false);
                                setHostNote("");
                                setSelectedVenue(null);
                              }}
                              disabled={org.rsvpLimitReached}
                              className={`px-6 py-3 text-xs uppercase tracking-widest font-medium flex items-center justify-center gap-2 transition-opacity ${
                                !org.rsvpLimitReached
                                  ? "text-white hover:opacity-90"
                                  : "text-zinc-400 border border-zinc-200 bg-white cursor-not-allowed"
                              }`}
                              style={
                                !org.rsvpLimitReached
                                  ? { backgroundColor: org.brandColor || "#18181b" }
                                  : undefined
                              }
                            >
                              Host This
                            </button>
                          );
                        })()}
                        {/* Owner-only: let Leaf host it (virtual host). Sits
                            inline beside Host This — Host This runs it yourself;
                            this hands it to an AI-assisted Leaf host. Server
                            re-checks owner + idea eligibility. */}
                        {org.isOwner && (
                          <button
                            type="button"
                            onClick={() => setVirtualHostPlan({ calendarId: org.objectId, planIdeaId: idea.id })}
                            className="px-6 py-3 text-xs uppercase tracking-widest font-medium flex items-center justify-center gap-2 border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 transition-colors"
                          >
                            <HostAvatar src={virtualHostAvatar || DEFAULT_HOST_AVATAR} className="w-4 h-4" /> Let Leaf host it
                          </button>
                        )}
                      </div>
                      {org.isOwner && (
                        <p className="text-xs text-zinc-400 italic">Run it yourself, or let Leaf plan &amp; run it for you.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
          };
          if (!org.hidePlanIdeas && org.planIdeas.length > 0) {
          const aroundTheCity = (i: PlanIdea) =>
            i.isFeatured === true || i.sourceKind === "featured";
          // Around-the-city ideas render as hoisted bands above the stream, so
          // they're excluded here rather than pinned to the top of it. Dropping
          // them before the cap also stops them consuming an inline idea slot.
          const orderedIdeas = [...org.planIdeas]
            .filter((i) => !aroundTheCity(i))
            .sort((a, b) => {
            const at = spreadOf(a)?.getTime() ?? Number.POSITIVE_INFINITY;
            const bt = spreadOf(b)?.getTime() ?? Number.POSITIVE_INFINITY;
            if (at !== bt) return at - bt;
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
          });
          const visibleIdeas = showAllIdeas
            ? orderedIdeas
            : orderedIdeas.slice(0, IDEA_INLINE_CAP);
          const hiddenIdeaCount = orderedIdeas.length - visibleIdeas.length;
            hiddenSuggestedCount += hiddenIdeaCount;
            visibleIdeas.forEach((idea) => {
              const d = spreadOf(idea);
              streamItems.push({
                key: `idea-${idea.id}`,
                date: d ? d.getTime() : Number.POSITIVE_INFINITY,
                render: (index) => renderPlanIdeaCard(idea, index),
              });
            });
          }

          // Interleave by date; stable by key on ties.
          streamItems.sort(
            (a, b) =>
              a.date - b.date ||
              (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
          );

          return (
            <>
              {streamItems.length > 0 && (
                <div className="space-y-32">
                  {streamItems.map((it, i) => (
                    <Fragment key={it.key}>{it.render(i)}</Fragment>
                  ))}
                </div>
              )}
              {hiddenSuggestedCount > 0 && (
                <div className="flex justify-center pt-16">
                  <button
                    type="button"
                    onClick={() => setShowAllIdeas(true)}
                    className="border border-zinc-200 px-6 py-3 text-xs uppercase tracking-widest font-medium text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                  >
                    Show {hiddenSuggestedCount} More
                  </button>
                </div>
              )}
              {!org.rsvpLimitReached && !org.hideCustomPlans && (
                <div className="pt-32">
              <article
                className={`group flex flex-col md:flex-row gap-12 md:items-center ${streamItems.length % 2 !== 0 ? "md:flex-row-reverse" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCreatingCustomPlan(true);
                    setCustomTitle("");
                    setCustomDescription("");
                    setCustomCategory("");
                    setCustomCapacity("");
                    setCustomPrefillDate("");
                    setCustomPrefillTime("");
                    setHostNote("");
                    setSelectedVenue(null);
                    setCustomSubmitting(false);
                    setCustomSuccess(false);
                  }}
                  className="w-full md:w-3/5 aspect-[16/5] md:aspect-[16/5] overflow-hidden shadow-sm relative rounded-none border-2 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50/80 to-white hover:from-emerald-50 transition-colors flex items-center justify-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                      {org.isOwner || org.isHost ? "Add a Plan" : "Suggest a Plan"}
                    </span>
                  </div>
                </button>
                <div className="w-full md:w-2/5 space-y-3">
                  <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400">
                    {org.isOwner || org.isHost ? "New plan" : "Your idea"}
                  </p>
                  <h3 className="text-2xl font-light tracking-tight">
                    {org.isOwner || org.isHost
                      ? "Have one in mind? Add it."
                      : "Have one we missed? Pitch it."}
                  </h3>
                  <p className="text-zinc-500 leading-relaxed font-light text-sm">
                    {org.isOwner || org.isHost
                      ? "Pick a date, venue, and details — goes live on your calendar."
                      : "Pitch a date, venue, and details — pending organizer approval."}
                  </p>
                </div>
              </article>
                </div>
              )}
            </>
          );
        })()}


        {/* Nearby Deals — supporting benefit, sits between plans (the lead
            community-calendar pitch) and Get Involved (engagement levers).
            Eyebrow says "Nearby deals" — most deals are public offers
            sourced from nearby businesses, so we don't over-claim
            "procured." Individual Exclusive badges on cards mark the ones
            that actually are Leaf-negotiated. */}
        {!org.hideDeals && (
          <DealsStrip
            calendarId={org.objectId}
            brandColor={org.brandColor}
            compact={isApartmentOrgType(org.orgType, org.name, org.description)}
            audienceName={org.name}
            onCreatePlanFromDeal={(deal: StripDeal) => {
              // Pre-fill the org page's existing custom-plan modal with venue +
              // title + description from this deal. Date/time stay blank — the
              // resident picks when they want to go.
              if (!deal.business) return;
              setSelectedVenue({
                placeId:
                  deal.business.googlePlaceId ||
                  `deal-business-${deal.business.objectId}`,
                name: deal.business.name,
                address: deal.business.formattedAddress || "",
                rating: null,
                photoUrl: deal.imageUrl,
                flagged: false,
              });
              setCustomTitle(deal.title);
              setCustomDescription(deal.description || "");
              setCustomCategory("");
              setCustomPrefillDate("");
              setCustomPrefillTime("");
              setCustomFromDeal(true);
              setCreatingCustomPlan(true);
            }}
          />
        )}

        {/* Plan Ideas Carousel */}
        {/* Get Involved section — fallback surface for the Custom Plan
            card when NOTHING appeared in the stream above. The inline
            Add-a-Plan row renders whenever plans / AI Suggested plans
            / plan ideas exist, so this fallback is only for calendars
            with a truly empty stream — otherwise it duplicates. */}
        {org.planIdeas.length === 0 && (!org.aiSourceEvents || org.aiSourceEvents.length === 0) && org.plans.length === 0 && !org.rsvpLimitReached && !org.hideCustomPlans && (
          <section className={`${org.plans.length > 0 ? "mt-48" : "mt-8"} mb-24 space-y-12`}>
            <div className="flex justify-between items-end border-b border-zinc-100 pb-8">
              <div className="space-y-2">
                <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold">
                  {org.isOwner || org.isHost ? "Add to Your Calendar" : "Get Involved"}
                </p>
                <h2 className="text-4xl font-light tracking-tight italic">
                  {org.isOwner || org.isHost
                    ? "Have one in mind? Add it."
                    : org.aiSourceEvents && org.aiSourceEvents.length > 0
                      ? "Have one we missed? Pitch it."
                      : "Host Something for the Community"}
                </h2>
              </div>
              {org.planIdeas.length > 0 && !org.hidePlanIdeas && (
                <div className="flex gap-4">
                  <button
                    onClick={() => scroll("left")}
                    className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-all active:scale-90"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => scroll("right")}
                    className="p-2 border border-zinc-200 rounded-full hover:bg-zinc-50 transition-all active:scale-90"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {org.rsvpLimitReached && (
              <div className="flex items-center gap-3 bg-zinc-100 border border-zinc-200 px-6 py-4">
                <Lock className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <p className="text-sm text-zinc-500">
                  This calendar has reached its RSVP limit for the month. New RSVPs and hosting are paused until the 1st, when the monthly allowance resets.
                </p>
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex gap-8 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-8"
            >
              {/* Custom plan card — only if custom proposals enabled */}
              {!org.rsvpLimitReached && !org.hideCustomPlans && (
                <div
                  className="min-w-[280px] max-w-[300px] snap-start group cursor-pointer"
                  onClick={() => {
                    setCreatingCustomPlan(true);
                    setCustomTitle("");
                    setCustomDescription("");
                    setCustomCategory("");
                    setCustomCapacity("");
                    setCustomPrefillDate("");
                    setCustomPrefillTime("");
                    setHostNote("");
                    setSelectedVenue(null);
                    setCustomSubmitting(false);
                    setCustomSuccess(false);
                  }}
                >
                  <div className="aspect-[4/5] overflow-hidden mb-4 relative rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white transition-all group-hover:shadow-lg group-hover:border-emerald-300">
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center space-y-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                        <Plus className="w-7 h-7" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs tracking-wider uppercase font-bold text-emerald-700">
                          {org.isOwner || org.isHost ? "New Plan" : "Your Idea"}
                        </p>
                        <h4 className="text-lg font-medium tracking-tight text-zinc-900">
                          {org.isOwner || org.isHost ? "Add a Plan" : "Suggest a Plan"}
                        </h4>
                        <p className="text-xs text-zinc-500 leading-relaxed font-light">
                          {org.isOwner || org.isHost
                            ? "Pick a date, venue, and details — publishes straight to your calendar."
                            : "Have something in mind? Share your idea and we’ll review it."}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-base font-medium tracking-tight group-hover:italic">
                      {org.isOwner || org.isHost ? "Add a plan" : "Custom Plan"}
                    </h4>
                    <p className="text-sm text-zinc-500 font-light line-clamp-2 leading-relaxed">
                      {org.isOwner || org.isHost
                        ? "Pick a date, venue, and details — goes live on your calendar."
                        : "Pitch a date, venue, and details — pending organizer approval."}
                    </p>
                  </div>
                </div>
              )}
              {/* Plan idea cards — historically rendered here as a
                  compact carousel. Now moved INLINE with the Upcoming
                  stream above (same alternating-row treatment as AI
                  Suggested + real plans, with I'm Interested + Host
                  This actions). The Custom Plan card above is the
                  only occupant of the Get Involved carousel now. */}
            </div>
          </section>
        )}
      </main>

      {/* Plan Detail Overlay */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] md:h-[85vh] md:max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => setSelectedEvent(null)}
              className="absolute top-4 right-4 z-50 p-2 rounded-full bg-zinc-100 text-zinc-600 md:bg-transparent md:text-zinc-900"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="hidden md:block w-1/2 h-full bg-zinc-100">
              {selectedEvent.image ? (
                <img
                  src={selectedEvent.image}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Calendar className="w-20 h-20 text-zinc-300" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-12">
              <div className="space-y-4">
                <h2 className="text-4xl md:text-5xl font-light tracking-tighter">
                  {selectedEvent.title}
                </h2>
                {/* Host line mirrors the card's precedence (see ~2689): a
                    virtual host or Leaf-host persona overrides the raw
                    hostName. Without this the modal showed the underlying
                    EventGroup owner (e.g. "Shawn Oates") for a plan the card
                    correctly attributes to its virtual host ("Marcus"). */}
                {selectedEvent.virtualHost ? (
                  <div className="flex items-center gap-2">
                    {selectedEvent.virtualHostPersona?.avatarUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={selectedEvent.virtualHostPersona.avatarUrl}
                        alt=""
                        aria-hidden="true"
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-zinc-200 flex-shrink-0"
                      />
                    )}
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                      Organized by {selectedEvent.virtualHostPersona?.name || "your host"}
                    </p>
                    <VirtualHostBadge persona={selectedEvent.virtualHostPersona} />
                  </div>
                ) : selectedEvent.leafHostState === "leaf_hosted" ? (
                  <div className="flex items-center gap-2">
                    {selectedEvent.leafHostPersona?.avatarUrl && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={selectedEvent.leafHostPersona.avatarUrl}
                        alt=""
                        aria-hidden="true"
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-zinc-200 flex-shrink-0"
                      />
                    )}
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                      Hosted by Leaf{selectedEvent.leafHostPersona?.name ? ` · ${selectedEvent.leafHostPersona.name}` : ""}
                    </p>
                  </div>
                ) : selectedEvent.leafHostState === "leaf_arranging" ? (
                  <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Leaf is arranging this
                  </p>
                ) : (
                  <p className="text-sm font-bold uppercase tracking-widest text-zinc-900">
                    Hosted by {selectedEvent.hostName}
                  </p>
                )}
                <div className="flex gap-6 text-sm text-zinc-500 font-light border-y border-zinc-100 py-6">
                  {selectedEvent.isPoll ? (
                    <>
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {selectedEvent.pollOptionCount || 0} {selectedEvent.pollOptionCount === 1 ? "option" : "options"}
                        {selectedEvent.pollClosesAt && (() => {
                          const ms = new Date(selectedEvent.pollClosesAt).getTime() - Date.now();
                          if (ms <= 0) return <> &middot; closed</>;
                          const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
                          return <> &middot; {days}d left</>;
                        })()}
                      </span>
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" /> {selectedEvent.pollVoteCount || 0} {selectedEvent.pollVoteCount === 1 ? "vote" : "votes"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {selectedEvent.date}{selectedEvent.time ? ` at ${selectedEvent.time}` : ""}
                      </span>
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4" /> {selectedEvent.attendeeCount} attending
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-xl font-light leading-relaxed text-zinc-600 whitespace-pre-wrap">
                  {renderLinkedText(selectedEvent.description)}
                </p>
                {selectedEvent.hostNote && (
                  <div className="space-y-2">
                    <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                      Note from Host
                    </h4>
                    <p className="text-sm text-zinc-400 italic border-l-2 border-zinc-200 pl-3">
                      &ldquo;{selectedEvent.hostNote}&rdquo;
                    </p>
                  </div>
                )}
                {selectedEvent.location && (
                  <div className="space-y-2">
                    <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                      {selectedEvent.locations && selectedEvent.locations.length > 1 ? "Itinerary" : "Location"}
                    </h4>
                    {selectedEvent.locations && selectedEvent.locations.length > 1 ? (
                      // Multi-stop itinerary — render each stop with its time.
                      // Same privacy gate as the single-venue path below: for
                      // non-poll plans that require approval OR mark venues
                      // private, show a collapsed "N stops · revealed after
                      // {RSVP,approval}" line instead of exposing addresses.
                      (!selectedEvent.isPoll && (
                        selectedEvent.location.isPrivate ||
                        (selectedEvent.requireApproval && !rsvpedPlanIds.has(selectedEvent.id))
                      )) ? (
                        <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                          <Lock className="w-3 h-3" />
                          {selectedEvent.locations.length} stops · revealed after {selectedEvent.requireApproval ? "approval" : "RSVP"}
                        </p>
                      ) : (
                        <ol className="space-y-2">
                          {selectedEvent.locations.map((loc, i) => (
                            <li key={loc.objectId || `${i}-${loc.name}`} className="flex gap-2 text-sm">
                              <span className="text-zinc-400 font-mono w-4 shrink-0">{i + 1}.</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-zinc-700">
                                  {loc.name || loc.neighborhood || "TBD"}
                                  {loc.time && <span className="text-zinc-400 font-normal"> · {loc.time}</span>}
                                </p>
                                {loc.address && (
                                  <p className="text-zinc-500 text-xs">{loc.address}</p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      )
                    ) : selectedEvent.isPoll ? (
                      // Polls don't gate location behind RSVP — date isn't picked yet
                      // and the venue (if set) is shown as informational context.
                      selectedEvent.location.name ? (
                        <>
                          <p className="text-sm text-zinc-700">{selectedEvent.location.name}</p>
                          {selectedEvent.location.address && (
                            <p className="text-sm text-zinc-500">{selectedEvent.location.address}</p>
                          )}
                        </>
                      ) : selectedEvent.location.neighborhood && (
                        <p className="text-sm text-zinc-700">{selectedEvent.location.neighborhood}</p>
                      )
                    ) : selectedEvent.location.isPrivate || (!selectedEvent.location.name && !selectedEvent.location.address) || (selectedEvent.requireApproval && !rsvpedPlanIds.has(selectedEvent.id)) ? (
                      <>
                        {selectedEvent.location.neighborhood && (
                          <p className="text-sm text-zinc-700">{selectedEvent.location.neighborhood}</p>
                        )}
                        <p className="text-sm text-zinc-400 flex items-center gap-1.5">
                          <Lock className="w-3 h-3" /> Location revealed after {selectedEvent.requireApproval ? "approval" : "RSVP"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-700">{selectedEvent.location.name}</p>
                        <p className="text-sm text-zinc-500">{selectedEvent.location.address}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-8 border-t border-zinc-100 flex flex-col gap-4">
                {selectedEvent.isPoll ? (
                  <div className="space-y-4">
                    <PollVoteWidget
                      eventGroupId={selectedEvent.id}
                      brandColor={org.brandColor || "#18181b"}
                    />
                    <button
                      onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                      className="w-full border border-zinc-200 py-3 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                      <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                    </button>
                  </div>
                ) : org.rsvpLimitReached ? (
                  <div className="space-y-3">
                    <button
                      disabled
                      className="w-full bg-zinc-300 text-zinc-500 py-3 text-xs uppercase tracking-wider font-bold cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" /> RSVPs Paused
                    </button>
                    <p className="text-xs text-zinc-400 text-center">
                      This calendar has reached its monthly RSVP limit. New RSVPs open up on the 1st of next month.
                    </p>
                  </div>
                ) : pendingRsvpIds.has(selectedEvent.id) ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-500">Request Pending</span>
                    </div>
                    <button
                      onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                      className="border border-zinc-200 py-3 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                      <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                    </button>
                  </div>
                ) : viewerHostsPlan(selectedEvent) ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">You&apos;re Hosting</span>
                    </div>
                    {hostNotificationId && (
                      <a
                        href={`/h/${hostNotificationId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white py-3 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 rounded-lg"
                        style={{ backgroundColor: org.brandColor || "#18181b" }}
                      >
                        <MessageCircle className="w-4 h-4" /> Message Attendees
                      </a>
                    )}
                    <button
                      onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                      className="border border-zinc-200 py-3 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                      <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                    </button>
                  </div>
                ) : rsvpedPlanIds.has(selectedEvent.id) ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">You&apos;re Attending</span>
                    </div>
                    {rsvpNotificationIds.get(selectedEvent.id) ? (
                      <div className="flex gap-4">
                        <a
                          href={`/c/${rsvpNotificationIds.get(selectedEvent.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-white py-3 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2 rounded-lg"
                          style={{ backgroundColor: org.brandColor || "#18181b" }}
                        >
                          <MessageCircle className="w-4 h-4" /> Join Plan Chat
                        </a>
                        <button
                          onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                          className="border border-zinc-200 px-5 hover:bg-zinc-50 transition-colors flex items-center gap-2 rounded-lg"
                        >
                          {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                          <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                        className="border border-zinc-200 py-3 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-2 rounded-lg"
                      >
                        {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                        <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setRsvpPlan(selectedEvent);
                        setSelectedEvent(null);
                      }}
                      className="flex-1 text-white py-3 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90"
                      style={{ backgroundColor: org.brandColor || "#18181b" }}
                    >
                      {selectedEvent.requireApproval ? "Request to Attend" : "I\u0027m Attending"}
                    </button>
                    <button
                      onClick={() => handleSharePlan(selectedEvent.id, selectedEvent.title)}
                      className="border border-zinc-200 px-5 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                    >
                      {copiedPlanId === selectedEvent.id ? <Check className="w-5 h-5 text-green-600" /> : <Share2 className="w-5 h-5" />}
                      <span className="text-xs font-bold uppercase tracking-widest">Share</span>
                    </button>
                  </div>
                )}
                {/* Add to Calendar — only on real plans (not polls), only when we have a date,
                    and only when the viewer is actually attending or hosting (otherwise it's
                    misleading — they haven't agreed to go yet). Pending RSVPs are excluded
                    since approval might be denied. Venue address is omitted when the location
                    is gated behind RSVP/approval and the user hasn't unlocked it yet, so
                    private addresses don't leak into calendar entries. */}
                {!selectedEvent.isPoll
                  && selectedEvent.dateISO
                  && (rsvpedPlanIds.has(selectedEvent.id) || viewerHostsPlan(selectedEvent))
                  && (() => {
                  const venueGated = !!(selectedEvent.location?.isPrivate
                    || (selectedEvent.requireApproval && !rsvpedPlanIds.has(selectedEvent.id)));
                  const icsUrl = buildIcsHref({
                    uid: selectedEvent.id,
                    title: selectedEvent.title,
                    dateISO: selectedEvent.dateISO,
                    time: selectedEvent.time,
                    description: selectedEvent.description,
                    locationName: venueGated ? selectedEvent.location?.neighborhood ?? null : selectedEvent.location?.name,
                    locationAddress: venueGated ? null : selectedEvent.location?.address,
                    url: typeof window !== "undefined" ? `${window.location.origin}/p/${selectedEvent.id}` : undefined,
                  });
                  if (!icsUrl) return null;
                  return (
                    <a
                      href={icsUrl}
                      className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-3 text-xs uppercase tracking-wider font-bold hover:bg-zinc-50 transition-colors rounded-lg mt-3"
                    >
                      <Calendar className="w-4 h-4" />
                      Add to Calendar
                    </a>
                  );
                })()}
                {/* Attendee list lives on the dedicated /h/{notificationId}
                    page now (reached via the "Message Attendees" button
                    above) so it's not duplicated here. Single place to see
                    who's attending, who shared their number, and to message
                    everyone. */}
                {/* Cancel RSVP — red text link at the bottom for confirmed
                    attendees (mirrors the host's "Cancel this plan" treatment). */}
                {rsvpedPlanIds.has(selectedEvent.id) && (
                  <button
                    onClick={() => handleCancelRsvp(selectedEvent.id)}
                    disabled={cancellingRsvp === selectedEvent.id}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors pt-2 disabled:opacity-50"
                  >
                    {cancellingRsvp === selectedEvent.id ? "Cancelling..." : "Cancel RSVP"}
                  </button>
                )}
                {/* Cancel Plan — visible only to the actual host of this plan.
                    Owners/co-hosts can still cancel via the dashboard, but the
                    public org page is the attendee/host POV — owners showing up
                    here as RSVP'd shouldn't see admin-style cancel actions. */}
                {parseUser && selectedEvent.hostId === parseUser.id && (
                  <button
                    onClick={() => handleCancelPlan(selectedEvent.id)}
                    disabled={cancellingPlan}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors pt-2 disabled:opacity-50"
                  >
                    {cancellingPlan ? "Cancelling..." : "Cancel this plan"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RSVP Modal */}
      {rsvpPlan && (
        <RsvpModal
          plan={rsvpPlan}
          onClose={() => setRsvpPlan(null)}
          brandColor={org.brandColor || undefined}
          existingNotificationId={rsvpNotificationIds.get(rsvpPlan.id) || null}
          calendarId={org.objectId}
          calendarName={org.name}
          isFollowingCalendar={isFollowing}
          followRequestPending={followRequestPending || org.followRequestPending}
          isPrivateCalendar={org.isPrivate}
          onFollowedCalendar={(pending) => {
            if (pending) {
              setFollowRequestPending(true);
            } else {
              setIsFollowing(true);
              setFollowerCount((c) => c + 1);
            }
          }}
          onRsvpSuccess={(planId, alreadyRsvpd, pendingApproval) => {
            if (pendingApproval) {
              addPendingRsvpCookie(planId);
              setPendingRsvpIds((prev) => new Set([...prev, planId]));
              return;
            }
            addRsvpCookie(planId);
            setRsvpedPlanIds((prev) => new Set([...prev, planId]));
            if (alreadyRsvpd) return;
            setOrg((prev) => prev ? {
              ...prev,
              plans: prev.plans.map((p) =>
                p.id === planId ? { ...p, attendeeCount: p.attendeeCount + 1 } : p
              ),
            } : prev);
            setSelectedEvent((prev) =>
              prev && prev.id === planId ? { ...prev, attendeeCount: prev.attendeeCount + 1 } : prev
            );
          }}
        />
      )}

      {cancelRsvpModalPlan && (
        <CancelRsvpModal
          planId={cancelRsvpModalPlan.id}
          planTitle={cancelRsvpModalPlan.title}
          onClose={() => setCancelRsvpModalPlan(null)}
          onCancelled={(planId) => {
            setCancelRsvpModalPlan(null);
            completeCancelRsvp(planId);
          }}
        />
      )}

      {featuredInterestFor && (
        <FeaturedInterestModal
          suggestionId={featuredInterestFor.id}
          suggestionTitle={featuredInterestFor.title}
          onClose={() => setFeaturedInterestFor(null)}
          onInterested={(suggestionId, interestCount) => {
            setFeaturedInterestFor(null);
            setPlanIdeaLocallyInterested((prev) =>
              new Set(prev).add(suggestionId)
            );
            markPlanIdeaLocallyInterested(suggestionId);
            if (interestCount !== null) {
              setPlanIdeaInterestCounts((prev) => ({
                ...prev,
                [suggestionId]: interestCount,
              }));
            }
          }}
        />
      )}

      {/* Host Plan Idea Overlay */}
      {hostingIdea && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] md:h-[85vh] md:max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => {
                setHostingIdea(null);
                setHostSuccess(false);
              }}
              className="absolute top-6 right-6 z-50 p-2 rounded-full bg-white/20 text-white md:text-zinc-900 md:bg-transparent"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="hidden md:block w-1/2 h-full bg-zinc-100">
              {hostingIdea.image ? (
                <img
                  src={hostingIdea.image}
                  className="w-full h-full object-cover"
                  alt=""
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Sparkles className="w-20 h-20 text-zinc-300" />
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-8 md:p-16 space-y-8">
              {hostSuccess ? (
                <div className="py-20 text-center space-y-6">
                  <div className="w-20 h-20 border border-zinc-900 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-light">
                    {hostSuccess === "pending" ? "Request submitted!" : "Your plan is scheduled."}
                  </h4>
                  {hostSuccess === "pending" && (
                    <p className="text-sm text-zinc-500">The organizer will review your request and get back to you.</p>
                  )}
                  <p className="text-zinc-400 uppercase tracking-widest text-xs">
                    Closing...
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-3xl font-light mb-2 italic">
                      Host this event
                    </h3>
                    <p className="text-zinc-500 font-light">
                      Bring &ldquo;{hostingIdea.title}&rdquo; to your community.
                    </p>
                  </div>

                  {/* Venue Carousel. With a venue already chosen, the card
                      leads and search drops below it — swapping a settled
                      venue is the secondary action. */}
                  {(() => {
                    const chosen = hostSuggestedVenue;
                    // Free-text venue search — type a specific place to
                    // override the AI's suggested category results.
                    const venueSearchInput = (
                      <>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="search"
                            name="venue-search"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            data-lpignore="true"
                            data-1p-ignore
                            value={venueSearchQuery}
                            onChange={(e) => setVenueSearchQuery(e.target.value)}
                            placeholder={chosen ? "Choose a different venue…" : "Search for a venue…"}
                            className="w-full border border-zinc-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-zinc-900 transition-colors"
                          />
                        </div>
                        {!(org.isOwner || org.isHost) && (
                          <p className="text-[11px] text-zinc-400">
                            Picking your own venue? Your request goes to the
                            organizer for approval before it&apos;s published.
                          </p>
                        )}
                      </>
                    );
                    return (
                  <div className="space-y-3">
                    <h4 className="text-xs tracking-wider uppercase font-bold text-zinc-400">
                      {chosen ? "Venue" : "Choose a Venue"}
                    </h4>
                    {!chosen && venueSearchInput}
                    {(() => {
                      // The suggestion's own venue leads the row (pre-selected);
                      // Places results follow, minus any duplicate of it.
                      const base = hostSuggestedVenue;
                      const ideaVenue = base
                        ? { ...base, photoUrl: base.photoUrl || ideaVenuePhotoUrl }
                        : null;
                      const venues = ideaVenue
                        ? [
                            ideaVenue,
                            ...nearbyVenues.filter(
                              (v) =>
                                v.placeId !== ideaVenue.placeId &&
                                v.name.trim().toLowerCase() !== ideaVenue.name.trim().toLowerCase(),
                            ),
                          ]
                        : nearbyVenues;
                      if (venues.length === 0 && !venuesLoading) {
                        return <p className="text-sm text-zinc-400 italic">No venues found nearby.</p>;
                      }
                      return (
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                          {venues.map((venue) => (
                            <button
                              key={venue.placeId}
                              type="button"
                              onClick={() => setSelectedVenue(selectedVenue?.placeId === venue.placeId ? null : venue)}
                              className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left relative ${
                                selectedVenue?.placeId === venue.placeId
                                  ? "border-zinc-900 shadow-lg"
                                  : venue.flagged
                                    ? "border-amber-300 hover:border-amber-400"
                                    : "border-zinc-200 hover:border-zinc-300"
                              }`}
                            >
                              {venue.flagged && (
                                <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white rounded-full p-0.5 z-10">
                                  <AlertTriangle className="w-3 h-3" />
                                </div>
                              )}
                              <div className="h-[100px] bg-zinc-100">
                                {venue.photoUrl ? (
                                  <img src={venue.photoUrl} className="w-full h-full object-cover" alt={venue.name} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-zinc-300" />
                                  </div>
                                )}
                              </div>
                              <div className="p-2.5">
                                {ideaVenue && venue.placeId === ideaVenue.placeId && (
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Chosen venue</p>
                                )}
                                <p className="text-xs font-bold truncate">{venue.name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  {venue.rating && (
                                    <span className="text-xs text-zinc-500">{venue.rating.toFixed(1)} &#9733;</span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-400 truncate mt-0.5">{venue.address}</p>
                              </div>
                            </button>
                          ))}
                          {venuesLoading && [0, 1, 2, 3, 4].map((i) => (
                            <div key={`venue-skeleton-${i}`} className="min-w-[160px] h-[180px] bg-zinc-100 rounded-xl animate-pulse shrink-0" />
                          ))}
                        </div>
                      );
                    })()}
                    {selectedVenue && (
                      <div>
                        <p className="text-xs text-zinc-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {selectedVenue.name} &mdash; {selectedVenue.address}
                        </p>
                        {selectedVenue.flagged && (
                          <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1.5">
                            <AlertTriangle className="w-3 h-3 shrink-0" /> This venue type is restricted by the admin. Your request will need approval.
                          </p>
                        )}
                      </div>
                    )}
                    {chosen && venueSearchInput}
                  </div>
                    );
                  })()}

                  <form onSubmit={handleHostSubmit} className="space-y-8">
                    {/* Name & Phone for non-owners */}
                    {!(org.isOwner || org.isHost) && (
                      <>
                        <PhoneVerifyFields verify={hostVerify} />
                        <div className="space-y-2">
                          <label className="text-xs tracking-wider uppercase font-bold">
                            Email (optional)
                          </label>
                          <input
                            type="email"
                            value={hostEmail}
                            onChange={(e) => setHostEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full border-b border-zinc-300 py-3 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors"
                          />
                          <p className="text-xs text-zinc-400">We&apos;ll send updates about your plan here.</p>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Preferred Date
                      </label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().split("T")[0]}
                        max={org.tier === "starter" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : undefined}
                        defaultValue={(() => {
                          // Featured: read the admin's wall-clock directly.
                          // Deriving it from the UTC instant would land on the
                          // wrong DAY for any evening event whose venue-local
                          // date and UTC date differ (9 PM PT is next-day UTC).
                          if (hostingIdea.isFeatured && hostingIdea.localWallClock) {
                            return hostingIdea.localWallClock.slice(0, 10);
                          }
                          // Prefill the spread cadence date so the modal
                          // matches the date shown on the idea's card;
                          // fall back to the server date.
                          const d =
                            spreadIdeaDates.get(hostingIdea.id) ??
                            (hostingIdea.date ? new Date(hostingIdea.date) : null);
                          return d ? d.toISOString().split("T")[0] : "";
                        })()}
                        className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Start Time
                      </label>
                      <input
                        type="time"
                        required
                        defaultValue={
                          hostingIdea.isFeatured && hostingIdea.localWallClock
                            ? hostingIdea.localWallClock.slice(11, 16)
                            : hostingIdea.preferredTime || "18:00"
                        }
                        className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                      {hostingIdea.isFeatured && hostingIdea.venueTimeZone && (
                        <p className="text-xs text-zinc-400 font-light">
                          {hostingIdea.timeMode === "local_wall_clock"
                            ? "Local time in your city."
                            : `Times are ${hostingIdea.venueTimeZone.split("/").pop()?.replace(/_/g, " ")}.`}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Host&apos;s Note
                      </label>
                      <textarea
                        value={hostNote}
                        onChange={(e) => setHostNote(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="w-full border border-zinc-200 rounded-lg p-4 text-sm font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                        placeholder="Add a personal note for attendees (optional)"
                      />
                      <p className="text-xs text-zinc-400 text-right">{hostNote.length}/500</p>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs tracking-wider uppercase font-bold">Require approval to attend</p>
                        <p className="text-xs text-zinc-400 font-light">Visitors must be approved before confirming</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setHostRequireApproval(!hostRequireApproval)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${hostRequireApproval ? "bg-zinc-900" : "bg-zinc-200"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hostRequireApproval ? "left-5" : "left-0.5"}`} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Visibility
                      </label>
                      <div className="p-6 border border-zinc-900 bg-zinc-50">
                        <span className="block font-bold text-xs uppercase tracking-widest mb-1">
                          Public Stream
                        </span>
                        <span className="text-sm font-light text-zinc-500">
                          Visible to all community members.
                        </span>
                      </div>
                    </div>
                    {/* Disclosed, not silent: hosting creates the follow, so
                        say so before the tap rather than surprising them after. */}
                    {!org.isFollower && (
                      <p className="text-sm text-zinc-500 leading-relaxed pt-2">
                        Hosting also follows{" "}
                        <span className="font-medium text-zinc-700">{org.name}</span>, so
                        you&rsquo;ll get updates. You can unfollow any time.
                      </p>
                    )}
                    {hostError && (
                      <p
                        role="alert"
                        className="text-sm text-red-600 leading-relaxed pt-2"
                      >
                        {hostError}
                      </p>
                    )}
                    <div className="pt-8 flex gap-4">
                      <button
                        type="button"
                        onClick={() => setHostingIdea(null)}
                        className="flex-1 text-xs uppercase tracking-widest font-medium text-zinc-500 hover:text-zinc-900 py-3"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={hostSubmitting || (!(org.isOwner || org.isHost) && !hostVerify.isVerified)}
                        className="flex-1 text-white py-3.5 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
                        style={{ backgroundColor: org.brandColor || "#18181b" }}
                      >
                        {hostSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          org.isOwner || org.isHost ? "Host Plan" : "Request to Host"
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Plan Request Overlay */}
      {creatingCustomPlan && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] md:h-[90vh] md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl rounded-t-3xl md:rounded-none relative">
            <button
              onClick={() => {
                setCreatingCustomPlan(false);
                setCustomFromDeal(false);
                setCustomSuccess(false);
                setSelectedImageUrl(null);
                setUnsplashPhotos([]);
                // If the user landed here from /m/{notificationId} (returnTo
                // was set on the URL) and is cancelling without submitting,
                // bounce back to the memory page.
                if (!customSuccess && returnTo) {
                  window.location.replace(returnTo);
                }
              }}
              className="absolute top-6 right-6 z-50 p-2 rounded-full text-zinc-900"
            >
              <Plus className="w-8 h-8 rotate-45" />
            </button>

            <div className="flex-1 overflow-y-auto p-8 md:p-16 space-y-8">
              {customSuccess ? (
                <div className="py-20 text-center space-y-6">
                  <div className="w-20 h-20 border border-zinc-900 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h4 className="text-2xl font-light">
                    {customSuccess === "published" ? "Plan published!" : "Request submitted!"}
                  </h4>
                  <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                    {customSuccess === "published"
                      ? "Your plan is live. Followers will see it on the calendar."
                      : "The organizer will review your custom plan and get back to you."}
                  </p>
                  <p className="text-zinc-400 uppercase tracking-widest text-xs">
                    Closing...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs tracking-wider uppercase font-bold text-emerald-700">
                      Be the Host
                    </p>
                    <h3 className="text-3xl font-light italic">Propose a plan</h3>
                    <p className="text-zinc-500 font-light">
                      {org.isOwner || org.isHost
                        ? `Create a new plan for ${org.name}. It will go live immediately.`
                        : `Bring something new to ${org.name}. The organizer will review and approve.`}
                    </p>
                  </div>

                  {!org.hidePlanIdeas && !customFromDeal && org.planIdeas.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs tracking-wider uppercase font-bold text-zinc-500">
                        Or host one of these ideas
                      </p>
                      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory -mx-8 md:-mx-16 px-8 md:px-16 pb-2">
                        {org.planIdeas.filter((idea) => idea.image).map((idea) => (
                          <button
                            type="button"
                            key={idea.id}
                            onClick={() => {
                              setCreatingCustomPlan(false);
                              setHostingIdea(idea);
                              setHostSubmitting(false);
                              setHostError(null);
                              setHostSuccess(false);
                              setHostNote("");
                              setSelectedVenue(null);
                            }}
                            className="text-left min-w-[140px] max-w-[140px] snap-start group"
                          >
                            <div className="aspect-square overflow-hidden bg-zinc-100 mb-2 relative rounded-md">
                              {idea.image ? (
                                <img
                                  src={idea.image}
                                  alt={idea.title}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Sparkles className="w-7 h-7 text-zinc-300" />
                                </div>
                              )}
                            </div>
                            <h5 className="text-xs font-medium tracking-tight line-clamp-2 group-hover:italic leading-snug">
                              {idea.title}
                            </h5>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleCustomPlanSubmit} className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Plan Title
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={200}
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="e.g. Saturday Morning Trail Run"
                        className="w-full border-b border-zinc-300 py-4 text-xl font-light focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Description
                      </label>
                      <textarea
                        required
                        rows={3}
                        maxLength={2000}
                        value={customDescription}
                        onChange={(e) => setCustomDescription(e.target.value)}
                        placeholder="What is this plan about? Who is it for?"
                        className="w-full border border-zinc-200 rounded-lg p-4 text-sm font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs tracking-wider uppercase font-bold">
                          Date
                        </label>
                        <input
                          type="date"
                          required
                          // Uncontrolled — keyed so a prefill from a suggestion
                          // remounts the input instead of being ignored.
                          key={`custom-date-${customPrefillDate}`}
                          defaultValue={customPrefillDate || undefined}
                          min={new Date().toISOString().split("T")[0]}
                          max={org.tier === "starter" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : undefined}
                          className="w-full border-b border-zinc-300 py-4 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs tracking-wider uppercase font-bold">
                          Start Time
                        </label>
                        <input
                          type="time"
                          required
                          key={`custom-time-${customPrefillTime}`}
                          defaultValue={customPrefillTime || "18:00"}
                          className="w-full border-b border-zinc-300 py-4 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
                        />
                      </div>
                    </div>

                    {customFromDeal && selectedVenue ? (
                      <div className="space-y-3">
                        <label className="text-xs tracking-wider uppercase font-bold">
                          Venue <span className="text-zinc-400">(from this deal)</span>
                        </label>
                        <div className="border border-zinc-200 rounded-xl p-3 flex items-center gap-3 bg-zinc-50">
                          <div className="w-14 h-14 rounded-lg bg-zinc-100 overflow-hidden shrink-0">
                            {selectedVenue.photoUrl ? (
                              <img
                                src={selectedVenue.photoUrl}
                                alt={selectedVenue.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-zinc-300" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-900 truncate">
                              {selectedVenue.name}
                            </p>
                            <p className="text-xs text-zinc-500 truncate">
                              {selectedVenue.address}
                            </p>
                          </div>
                          <Lock className="w-3.5 h-3.5 text-zinc-400 ml-auto shrink-0" />
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Deals are tied to a specific business — venue can&apos;t be changed.
                        </p>
                      </div>
                    ) : (
                    <>
                    {/* Venue search */}
                    <div className="space-y-3">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Venue Type / Search
                      </label>
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="e.g. coffee shop, park, brewery"
                        className="w-full border-b border-zinc-300 py-3 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
                      />
                      <p className="text-[11px] text-zinc-400">
                        We&apos;ll search nearby venues in {org.orgCity || "your area"}.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Choose a Venue <span className="text-red-500">*</span>
                      </label>
                      {venuesLoading ? (
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div key={i} className="min-w-[160px] h-[180px] bg-zinc-100 rounded-xl animate-pulse shrink-0" />
                          ))}
                        </div>
                      ) : nearbyVenues.length > 0 ? (
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                          {nearbyVenues.map((venue) => (
                            <button
                              key={venue.placeId}
                              type="button"
                              onClick={() => setSelectedVenue(selectedVenue?.placeId === venue.placeId ? null : venue)}
                              className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left relative ${
                                selectedVenue?.placeId === venue.placeId
                                  ? "border-zinc-900 shadow-lg"
                                  : venue.flagged
                                    ? "border-amber-300 hover:border-amber-400"
                                    : "border-zinc-200 hover:border-zinc-300"
                              }`}
                            >
                              {venue.flagged && (
                                <div className="absolute top-1.5 right-1.5 bg-amber-500 text-white rounded-full p-0.5 z-10">
                                  <AlertTriangle className="w-3 h-3" />
                                </div>
                              )}
                              <div className="h-[100px] bg-zinc-100">
                                {venue.photoUrl ? (
                                  <img src={venue.photoUrl} className="w-full h-full object-cover" alt={venue.name} />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <MapPin className="w-6 h-6 text-zinc-300" />
                                  </div>
                                )}
                              </div>
                              <div className="p-2.5">
                                <p className="text-xs font-bold truncate">{venue.name}</p>
                                {venue.rating && (
                                  <span className="text-xs text-zinc-500">{venue.rating.toFixed(1)} &#9733;</span>
                                )}
                                <p className="text-xs text-zinc-400 truncate mt-0.5">{venue.address}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-400 italic">
                          {customCategory ? "No venues found. Try a different search." : "Type a venue type above to search."}
                        </p>
                      )}
                      {selectedVenue && (
                        <div>
                          <p className="text-xs text-zinc-600 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {selectedVenue.name} &mdash; {selectedVenue.address}
                          </p>
                          {selectedVenue.flagged && (
                            <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1.5">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> This venue type is restricted by the admin. Your request will need approval.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    </>
                    )}

                    {/* Cover Image Picker */}
                    {selectedVenue && customTitle.trim() && (
                      <div className="space-y-3">
                        <label className="text-xs tracking-wider uppercase font-bold">
                          Cover Image
                        </label>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                          {/* Venue photo option */}
                          {selectedVenue.photoUrl && (
                            <button
                              key="venue-photo"
                              type="button"
                              onClick={() => setSelectedImageUrl(
                                selectedImageUrl === selectedVenue.photoUrl ? null : selectedVenue.photoUrl!
                              )}
                              className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left relative ${
                                selectedImageUrl === selectedVenue.photoUrl
                                  ? "border-zinc-900 shadow-lg"
                                  : "border-zinc-200 hover:border-zinc-300"
                              }`}
                            >
                              {selectedImageUrl === selectedVenue.photoUrl && (
                                <div className="absolute top-1.5 right-1.5 bg-zinc-900 text-white rounded-full p-0.5 z-10">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                              <div className="h-[120px] bg-zinc-100">
                                <img src={selectedVenue.photoUrl} className="w-full h-full object-cover" alt={selectedVenue.name} />
                              </div>
                            </button>
                          )}

                          {/* Unsplash skeleton loaders */}
                          {unsplashLoading && [0, 1, 2, 3].map((i) => (
                            <div key={`skel-${i}`} className="min-w-[160px] h-[140px] bg-zinc-100 rounded-xl animate-pulse shrink-0" />
                          ))}

                          {/* Unsplash results */}
                          {!unsplashLoading && unsplashPhotos.map((photo) => (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => setSelectedImageUrl(
                                selectedImageUrl === photo.url ? null : photo.url
                              )}
                              className={`min-w-[160px] max-w-[160px] shrink-0 rounded-xl overflow-hidden border-2 transition-all text-left relative ${
                                selectedImageUrl === photo.url
                                  ? "border-zinc-900 shadow-lg"
                                  : "border-zinc-200 hover:border-zinc-300"
                              }`}
                            >
                              {selectedImageUrl === photo.url && (
                                <div className="absolute top-1.5 right-1.5 bg-zinc-900 text-white rounded-full p-0.5 z-10">
                                  <Check className="w-3 h-3" />
                                </div>
                              )}
                              <div className="h-[120px] bg-zinc-100">
                                <img src={photo.thumbUrl} className="w-full h-full object-cover" alt={photo.alt} />
                              </div>
                            </button>
                          ))}
                        </div>
                        {(() => {
                          const selected = unsplashPhotos.find(p => p.url === selectedImageUrl);
                          if (!selected) return null;
                          return (
                            <p className="text-xs text-zinc-400">
                              Photo by{" "}
                              <a
                                href={`${selected.photographerUrl}?utm_source=leaf&utm_medium=referral`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-zinc-600"
                              >
                                {selected.photographerName}
                              </a>
                              {" / "}
                              <a
                                href="https://unsplash.com/?utm_source=leaf&utm_medium=referral"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-zinc-600"
                              >
                                Unsplash
                              </a>
                            </p>
                          );
                        })()}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs tracking-wider uppercase font-bold">
                          Capacity <span className="text-zinc-400 normal-case">(optional)</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={customCapacity}
                          onChange={(e) => setCustomCapacity(e.target.value)}
                          placeholder="e.g. 20"
                          className="w-full border-b border-zinc-300 py-3 text-base font-light focus:outline-none focus:border-zinc-900 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs tracking-wider uppercase font-bold">
                        Host&apos;s Note <span className="text-zinc-400 normal-case">(optional)</span>
                      </label>
                      <textarea
                        value={hostNote}
                        onChange={(e) => setHostNote(e.target.value)}
                        rows={3}
                        maxLength={500}
                        className="w-full border border-zinc-200 rounded-lg p-4 text-sm font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none"
                        placeholder="Add a personal note for attendees"
                      />
                      <p className="text-xs text-zinc-400 text-right">{hostNote.length}/500</p>
                    </div>

                    {!(org.isOwner || org.isHost) && (
                      <>
                        <PhoneVerifyFields verify={customVerify} />
                        <div className="space-y-2">
                          <label className="text-xs tracking-wider uppercase font-bold">
                            Email (optional)
                          </label>
                          <input
                            type="email"
                            value={customEmail}
                            onChange={(e) => setCustomEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full border-b border-zinc-300 py-3 text-lg font-light focus:outline-none focus:border-zinc-900 transition-colors"
                          />
                          <p className="text-xs text-zinc-400">We&apos;ll send updates about your plan here.</p>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between py-1">
                      <div>
                        <p className="text-xs tracking-wider uppercase font-bold">Require approval to attend</p>
                        <p className="text-xs text-zinc-400 font-light">Visitors must be approved before confirming</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomRequireApproval(!customRequireApproval)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${customRequireApproval ? "bg-zinc-900" : "bg-zinc-200"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${customRequireApproval ? "left-5" : "left-0.5"}`} />
                      </button>
                    </div>

                    <div className="pt-4 flex gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingCustomPlan(false);
                          if (returnTo) window.location.replace(returnTo);
                        }}
                        className="flex-1 text-xs uppercase tracking-widest font-medium text-zinc-500 hover:text-zinc-900 py-3"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={
                          customSubmitting ||
                          (!(org.isOwner || org.isHost) && !customVerify.isVerified) ||
                          !selectedVenue ||
                          !customTitle.trim() ||
                          !customDescription.trim()
                        }
                        className="flex-1 text-white py-3.5 text-xs uppercase tracking-wider font-bold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
                        style={{ backgroundColor: org.brandColor || "#18181b" }}
                      >
                        {customSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          org.isOwner || org.isHost ? "Create Plan" : "Submit for Approval"
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Your Own Calendar CTA */}
      <section ref={ctaSectionRef} className="py-10 px-6 border-t border-zinc-100 bg-zinc-50/60">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-xs tracking-wider uppercase text-zinc-400 mb-1">
              Powered by Leaf
            </p>
            <p className="text-sm text-zinc-600 font-light">
              Create a free social calendar for your community.
            </p>
          </div>
          <a
            href={`${SITE_URL}/organizations/setup`}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 text-xs uppercase tracking-wider font-bold hover:bg-zinc-800 transition-colors shrink-0"
          >
            Get Started — It&apos;s Free <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </section>

      </>
      )}

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-4">
            <span className="text-xl font-light tracking-wider uppercase">
              {org.name}
            </span>
            <p className="text-zinc-400 text-sm font-light max-w-xs leading-relaxed">
              {org.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-4">
              <h5 className="text-xs tracking-wider uppercase font-bold text-zinc-900">
                Platform
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <Link href="/about" className="hover:text-zinc-900 transition-colors">
                  About
                </Link>
                <Link href="/terms-conditions" className="hover:text-zinc-900 transition-colors">
                  Terms
                </Link>
                <Link href="/safety" className="hover:text-zinc-900 transition-colors">
                  Safety
                </Link>
                <Link href="/privacy-policy" className="hover:text-zinc-900 transition-colors">
                  Privacy
                </Link>
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-xs tracking-wider uppercase font-bold text-zinc-900">
                Connect
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <a
                  href="mailto:team@getleaflets.co"
                  className="hover:text-zinc-900 transition-colors"
                >
                  Contact
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Follow Modal */}
      {showFollowModal && (
        <FollowModal
          calendarId={org.objectId}
          calendarName={org.name}
          brandColor={org.brandColor || undefined}
          isPrivate={org.isPrivate}
          onClose={() => setShowFollowModal(false)}
          onFollowed={(_name, _phone, pending) => {
            if (pending) {
              setFollowRequestPending(true);
            } else {
              setIsFollowing(true);
              setFollowerCount((c) => c + 1);
            }
            setShowFollowModal(false);
          }}
        />
      )}

      {/* Host Login Modal */}
      {showHostLogin && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-t-2xl md:rounded-xl p-8 relative">
            <button
              onClick={() => setShowHostLogin(false)}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-light tracking-tight">Host Login</h3>
                <p className="text-sm text-zinc-500 mt-1">
                  Sign in to manage this calendar.
                </p>
              </div>
              <GoogleSignInButton
                onSignIn={(u) => {
                  setParseUser(u as unknown as Parse.User);
                  setShowHostLogin(false);
                  fetchOrg();
                  const name = (u as unknown as Parse.User)?.get?.("full_name") || (u as unknown as Parse.User)?.get?.("name") || "";
                  if (name) {
                    setToast(`Signed in as ${name}`);
                    setTimeout(() => setToast(null), 3000);
                  }
                }}
                onError={(err) => console.error("Sign-in error:", err)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Per-plan leaf-host chat drawer. Owner-only — pill that opens
          this only renders when the server surfaced the chat metadata
          on the plan, which itself is stripped for non-owners. */}
      {leafHostChatPlanId && org.isOwner && (
        <LeafHostPlanThread
          planId={leafHostChatPlanId}
          onClose={() => setLeafHostChatPlanId(null)}
        />
      )}

      {virtualHostPlan && org.isOwner && (
        <VirtualHostSheet
          calendarId={virtualHostPlan.calendarId}
          eventGroupId={virtualHostPlan.eventGroupId}
          planIdeaId={virtualHostPlan.planIdeaId}
          aiEventIndex={virtualHostPlan.aiEventIndex}
          returnTo={typeof window !== "undefined" ? window.location.href : undefined}
          onClose={() => setVirtualHostPlan(null)}
          onAttached={() => { setVirtualHostPlan(null); fetchOrg(); }}
        />
      )}

      {/* Welcome / "Make it your own" invite — shown after first calendar creation */}
      {showWelcomeInvite && org.isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowWelcomeInvite(false)}
          />
          <div className="relative bg-white max-w-md w-full mx-4 shadow-2xl">
            <button
              onClick={() => setShowWelcomeInvite(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-8 space-y-6">
              <div className="w-14 h-14 border-2 border-zinc-900 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-light tracking-tight">
                  Make it your own first
                </h3>
                <p className="text-zinc-500 font-light">
                  Before sharing your calendar, take a moment to manage your
                  settings — tune your preferred days, times, blacklist
                  categories, and brand.
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <Link
                  href={`/dashboard/${org.parentOrgId || org.objectId}?tab=calendars`}
                  className="bg-zinc-900 text-white px-6 py-3.5 text-xs uppercase tracking-wider font-bold text-center hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                >
                  Manage Calendar Settings <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setShowWelcomeInvite(false)}
                  className="px-6 py-3 text-xs uppercase tracking-wider font-medium text-zinc-500 hover:text-zinc-900 text-center transition-colors"
                >
                  Skip and view my calendar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow Popup */}
      {showFollowPopup && org && (
        <div
          className="fixed bottom-6 right-6 left-6 md:left-auto md:w-80 z-40"
          style={{ animation: "slideUp 0.3s ease-out" }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 p-4">
            <button
              onClick={dismissFollowPopup}
              className="absolute top-3 right-3 p-1 text-zinc-300 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-3 pr-6">
              {org.profilePhoto ? (
                <img src={org.profilePhoto} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-zinc-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate">{org.name}</p>
                <p className="text-xs text-zinc-500">{org.isPrivate ? "Request access to see plans" : "Get notified about new plans"}</p>
              </div>
            </div>
            <button
              onClick={handlePopupFollow}
              disabled={followPopupLoading}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: org.brandColor || "#18181b" }}
            >
              {followPopupLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                org.isPrivate ? "Request to Follow" : "Follow"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Plan Idea Popup for Followers */}
      {showPlanIdeaPopup && popupIdea && org && (
        <div
          className="fixed bottom-6 right-6 left-6 md:left-auto md:w-80 z-40"
          style={{ animation: "slideUp 0.3s ease-out" }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden">
            <button
              onClick={dismissPlanIdeaPopup}
              className="absolute top-3 right-3 z-10 p-1 text-zinc-300 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
            {popupIdea.image && (
              <div className="h-28 w-full overflow-hidden">
                <img
                  src={popupIdea.image}
                  alt={popupIdea.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="p-4">
              <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold mb-1.5">
                {popupIdea.category}
              </p>
              <h4 className="text-sm font-medium tracking-tight text-zinc-900 mb-3 pr-6">
                {popupIdea.title}
              </h4>
              <button
                onClick={() => {
                  dismissPlanIdeaPopup();
                  setHostingIdea(popupIdea);
                  setHostSubmitting(false);
                  setHostSuccess(false);
                  setHostNote("");
                  setSelectedVenue(null);
                }}
                className="w-full py-2.5 text-xs font-bold uppercase tracking-widest text-white rounded-lg transition-opacity hover:opacity-90"
                style={{ backgroundColor: org.brandColor || "#18181b" }}
              >
                Host This Plan
              </button>
              <button
                onClick={dismissPlanIdeaPopup}
                className="w-full mt-2 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast. z-[60] because the modals below are z-50 and render LATER in
          the DOM — at equal z-index they painted over the toast, so every
          error surfaced inside an open modal was invisible and the failure
          read as "the button does nothing". */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-zinc-900 text-white px-5 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4" />
          {toast}
        </div>
      )}

      {/* "Text me when this gets hosted" — shown after an interest tap from a
          browser with no identity. Deliberately AFTER the tap: the count is
          already saved, so this is a bonus ask and "No thanks" costs nothing.
          Compact and dismissible on purpose — an anonymous tap that stays
          anonymous is the status quo, not a failure. */}
      {notifyPromptFor && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm"
          onClick={() => { if (!notifyAttaching) setNotifyPromptFor(null); }}
        >
          <div
            className="bg-white w-full max-w-md p-8 md:p-10 space-y-6 shadow-2xl rounded-t-3xl md:rounded-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400">
                You&rsquo;re interested
              </p>
              <h3 className="text-2xl font-light tracking-tight">
                Want a text if someone hosts{" "}
                <span className="font-medium">{notifyPromptFor.title}</span>?
              </h3>
              <p className="text-sm text-zinc-500 font-light leading-relaxed">
                We&rsquo;ll only text you about this plan. Your interest is
                already counted either way.
              </p>
            </div>

            {notifyAttaching ? (
              <div className="flex items-center gap-2 py-3 text-sm text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving your number…
              </div>
            ) : (
              <PhoneVerifyFields verify={notifyVerify} />
            )}

            <button
              onClick={() => setNotifyPromptFor(null)}
              disabled={notifyAttaching}
              className="w-full py-2 text-[11px] uppercase tracking-widest text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
            >
              No thanks
            </button>
          </div>
        </div>
      )}

      {/* Host This review modal — fires when a visitor with host permission
          taps Host This on a Suggestion card. Shows the suggestion in full
          (cover, date, venue, blurb, interest) rather than a bare yes/no, so
          the visitor reviews the actual plan before committing, and spells
          out that followers and interested users get notified on confirm.
          Mirrors the Plan Detail Overlay's split layout so hosting a
          suggestion and opening a live plan feel like the same surface. */}
      {hostThisEventIndex !== null && org && (() => {
        const ev = org.aiSourceEvents?.[hostThisEventIndex];
        if (!ev) return null;
        const eventIndex = hostThisEventIndex;
        const canHostAsHost = !!(org.isOwner || org.isHost);
        const interestCount =
          aiInterestCounts[eventIndex] ??
          org.aiSourceEventInterests?.[eventIndex] ??
          0;
        const resolvedDate = resolveAIEventDate(ev, org.orgTimezone ?? null).date;
        const whenLabel = resolvedDate
          ? `${formatDate(
              resolvedDate.toISOString(),
              FLOATING_EVENT_TZ
            ).toUpperCase()} · ${formatTime(
              resolvedDate.toISOString(),
              FLOATING_EVENT_TZ
            )}`
          : ev.time || null;
        const isAmber = ev.tagVariant === "amber";
        const venueLine = ev.venueLine || ev.address || null;

        const confirmHostThis = async () => {
          if (!canHostAsHost && !hostVerify.isVerified) return;
          setHostThisSubmitting(true);
          try {
            // Server owns venue resolution + role gating and auto-approves
            // owner/co-host (it delegates to requestCustomPlanViaWeb, which
            // creates the EventGroup directly for them and falls back to the
            // owner's approval queue for followers).
            // /org identifies people by verified phone, not Parse session, so
            // pass that identity through — otherwise the server has nothing to
            // act on and rejects a visitor the page considers known.
            const result = (await Parse.Cloud.run("proposeAIEventPlan", {
              shareId,
              eventIndex,
              // Always send the verified identity, even for someone the page
              // considers the owner. /org derives isOwner from the phone
              // cookie while Parse.Cloud.run transmits the SESSION — those can
              // be two different accounts. Withholding the phone here left the
              // server with only the session, and if that account wasn't the
              // owner the call died with "name and phoneNumber are required."
              hostName: hostVerify.isVerified
                ? hostVerify.name.trim()
                : undefined,
              hostPhone: hostVerify.isVerified
                ? `+1${hostVerify.phone.replace(/\D/g, "")}`
                : undefined,
              // Omitting it (cleared field) makes the server fall back to its
              // own attribution line for followers, which is what shipped
              // before this field existed.
              hostNote: hostThisNote.trim() || undefined,
            })) as {
              pendingApproval?: boolean;
              eventGroupId?: string;
              role?: string;
            };
            setHostThisEventIndex(null);
            // The server only auto-follows the follower path; trust its role
            // rather than the page's own guess, so an owner confirming their
            // own suggestion doesn't inflate the follower count.
            if (result?.role === "follower" && !isFollowing) {
              setIsFollowing(true);
              setFollowerCount((c) => c + 1);
            }

            if (result?.pendingApproval) {
              setToast(
                "Sent to the calendar host for approval — you’ll hear back when they decide.",
              );
              setTimeout(() => setToast(null), 5000);
              await fetchOrg();
              return;
            }

            setToast(
              interestCount > 0
                ? `You’re hosting ${ev.name}. The ${interestCount} interested ${interestCount === 1 ? "person has" : "people have"} been texted.`
                : `You’re hosting ${ev.name}. Followers have been notified.`,
            );
            setTimeout(() => setToast(null), 5000);
            // Refresh so the suggestion card is replaced by the live plan,
            // then hand the new plan's id to the ?plan= auto-open effect so
            // the host lands on the full detail overlay with themselves
            // attached — same handoff the virtual-host return path uses.
            await fetchOrg();
            if (result?.eventGroupId) {
              setPlanQueryId(result.eventGroupId);
            } else {
              // No id came back — drop them on the dashboard's Calendars tab
              // with this calendar's plan manager open rather than leaving
              // them to hunt for what they just created.
              router.push(
                `/dashboard/${org.parentOrgId || org.objectId}?tab=calendars&managePlans=${org.objectId}`,
              );
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "";
            // Venue/date the server couldn't resolve (no placeId and Places
            // came back empty, or the suggestion carries no usable date).
            // An owner can fix that by hand, so send them to the prefilled
            // editor instead of dead-ending on an error toast.
            if (canHostAsHost && /places|manually|no date/i.test(msg)) {
              setHostThisEventIndex(null);
              setToast("Couldn’t verify that venue — pick the spot and publish.");
              setTimeout(() => setToast(null), 6000);
              openAIEventInDashboard(ev);
              return;
            }
            setToast(msg || "Couldn’t send that. Try again in a moment.");
            setTimeout(() => setToast(null), 4000);
          } finally {
            setHostThisSubmitting(false);
          }
        };

        return (
          <div
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-zinc-900/60 backdrop-blur-sm"
            onClick={() => { if (!hostThisSubmitting) setHostThisEventIndex(null); }}
          >
            <div
              className="bg-white w-full max-w-4xl max-h-[90vh] md:max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-t-3xl md:rounded-none relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { if (!hostThisSubmitting) setHostThisEventIndex(null); }}
                disabled={hostThisSubmitting}
                aria-label="Close"
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-zinc-100 text-zinc-600 md:bg-transparent md:text-zinc-900 disabled:opacity-40"
              >
                <Plus className="w-8 h-8 rotate-45" />
              </button>

              {/* Cover — the generator's Unsplash photo when it resolved one,
                  otherwise the gradient + serif tag treatment. Same order as
                  the card, so opening a suggestion shows the same image the
                  reader just tapped rather than swapping it for the fallback.
                  (This block predates suggestions having photos at all, and
                  kept rendering the no-image state after they gained one.) */}
              <div
                className="hidden md:flex w-2/5 shrink-0 items-center justify-center relative overflow-hidden"
                style={{
                  background: isAmber
                    ? "linear-gradient(135deg, #f5e6d0 0%, #e8d1a5 100%)"
                    : "linear-gradient(135deg, #e8efe9 0%, #cddcd0 100%)",
                }}
              >
                {ev.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ev.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div
                      className="absolute inset-0 opacity-[0.07]"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 25% 30%, rgba(0,0,0,0.15) 1px, transparent 2px)",
                        backgroundSize: "18px 18px",
                      }}
                    />
                    <span
                      className="relative text-4xl lg:text-5xl font-light tracking-tight text-center px-6"
                      style={{
                        fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                        color: isAmber ? "#8A5F1E" : "#1B4332",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {(ev.tag || "Event").toLowerCase()}
                    </span>
                  </>
                )}
                <span
                  className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-widest rounded-full px-3 py-1"
                  style={{
                    background: "rgba(255,255,255,0.85)",
                    color: isAmber ? "#8A5F1E" : "#1B4332",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  Suggested
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-8">
                <div className="space-y-3">
                  {whenLabel && (
                    <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400">
                      {whenLabel}
                    </p>
                  )}
                  <h2 className="text-3xl md:text-4xl font-light tracking-tighter pr-8">
                    {ev.title || ev.name}
                  </h2>
                  {ev.title && ev.title !== ev.name && (
                    <p className="text-sm text-zinc-700 font-medium">{ev.name}</p>
                  )}
                  {venueLine && (
                    <p className="text-sm text-zinc-500 font-light">{venueLine}</p>
                  )}
                </div>

                {ev.description && (
                  <p className="text-zinc-700 leading-relaxed font-light text-lg">
                    {ev.description}
                  </p>
                )}

                <div className="space-y-3 text-sm text-zinc-600">
                  {whenLabel && (
                    <p className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                      {whenLabel}
                    </p>
                  )}
                  {venueLine && (
                    <p className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                      <span>
                        {venueLine}
                        {ev.address && ev.address !== venueLine ? ` · ${ev.address}` : ""}
                      </span>
                    </p>
                  )}
                  {interestCount > 0 && (
                    <p className="flex items-center gap-2">
                      <Heart className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" />
                      {interestCount} {interestCount === 1 ? "person is" : "people are"} interested
                    </p>
                  )}
                </div>

                {/* Consequence copy — the thing the old confirm dialog
                    existed to say, kept verbatim in intent. */}
                <div className="border-t border-zinc-100 pt-6 space-y-2">
                  <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400">
                    When you confirm
                  </p>
                  {/* Confirming a suggestion VERBATIM publishes immediately for
                      everyone, follower or owner — the calendar already opted
                      into these suggestions, so accepting one unchanged needs
                      no second sign-off. Changing the details is what routes
                      through the owner; "Edit details first" says so. */}
                  {/* Says what actually fires, which this copy did not. Per-plan
                      follower SMS is gated OFF by default
                      (`perPlanFollowerSmsEnabled`) in favor of the Sunday
                      digest, so followers get a push and the rest wait for the
                      weekly roundup — promising a flat "followers will be
                      notified" oversold it. Interested people ARE texted
                      immediately now (notifyInterestedOnAIEventHosted). */}
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    This becomes a real plan on{" "}
                    <span className="font-medium text-zinc-900">{org.name}</span> with you
                    as the host.{" "}
                    {interestCount > 0 ? (
                      <>
                        The {interestCount}{" "}
                        {interestCount === 1 ? "person" : "people"} interested in it
                        {interestCount === 1 ? " gets" : " get"} a text right away, and
                        followers get a notification
                      </>
                    ) : (
                      <>Followers get a notification</>
                    )}
                    {" "}— everyone else sees it in the weekly roundup
                    {canHostAsHost
                      ? ". You can manage RSVPs from your dashboard."
                      : ". You can manage RSVPs from the plan page."}
                  </p>
                  {/* Disclosed, not silent: hosting creates the follow, so say
                      so before the tap rather than surprising them after. */}
                  {!org.isFollower && (
                    <p className="text-sm text-zinc-500 leading-relaxed">
                      Hosting also follows{" "}
                      <span className="font-medium text-zinc-700">{org.name}</span>, so
                      you&rsquo;ll get updates. You can unfollow any time.
                    </p>
                  )}
                </div>

                {/* Note from Host. Followers open with the attribution line
                    prefilled; before this field existed the server stamped
                    that same line on silently and the host had no way to say
                    anything in their own voice. Editing it does NOT route the
                    plan through the owner's approval queue — the note isn't
                    one of the plan details ("Edit details first") that does. */}
                <div className="border-t border-zinc-100 pt-6 space-y-2">
                  <label
                    htmlFor="host-this-note"
                    className="text-[11px] tracking-wider uppercase font-bold text-zinc-400"
                  >
                    Note from Host
                  </label>
                  <textarea
                    id="host-this-note"
                    value={hostThisNote}
                    onChange={(e) => setHostThisNote(e.target.value)}
                    disabled={hostThisSubmitting}
                    rows={3}
                    maxLength={500}
                    className="w-full border border-zinc-200 rounded-lg p-4 text-sm font-light focus:outline-none focus:border-zinc-900 transition-colors resize-none disabled:opacity-50"
                    placeholder="Add a note for attendees (optional)"
                  />
                  <p className="text-[11px] text-zinc-400 text-right">
                    {hostThisNote.length}/500
                  </p>
                </div>

                {/* Identity. The server needs a verified phone to know who is
                    hosting — this modal previously collected none, which is why
                    it only ever worked for someone who happened to hold a Parse
                    session. Owners and co-hosts are already identified. */}
                {!canHostAsHost && !hostVerify.isVerified && (
                  <div className="border-t border-zinc-100 pt-6 space-y-4">
                    <p className="text-[11px] tracking-wider uppercase font-bold text-zinc-400">
                      Confirm it&rsquo;s you
                    </p>
                    <PhoneVerifyFields verify={hostVerify} />
                  </div>
                )}

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    onClick={confirmHostThis}
                    disabled={
                      hostThisSubmitting ||
                      (!canHostAsHost && !hostVerify.isVerified)
                    }
                    className="w-full px-6 py-4 text-xs uppercase tracking-widest font-medium text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: org.brandColor || "#18181b" }}
                  >
                    {hostThisSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Publishing…
                      </>
                    ) : (
                      "Confirm — I'll host this"
                    )}
                  </button>
                  {/* Editing is the path that still needs the owner. Owners get
                      the dashboard drawer; everyone else gets the
                      Propose-a-plan form, prefilled, which submits for
                      approval. */}
                  <button
                    onClick={() => {
                      setHostThisEventIndex(null);
                      if (canHostAsHost) openAIEventInDashboard(ev);
                      else openSuggestionInCustomPlan(ev);
                    }}
                    disabled={hostThisSubmitting}
                    className="w-full px-6 py-3 text-xs uppercase tracking-widest font-medium border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 disabled:opacity-50 transition-colors"
                  >
                    Edit details first
                  </button>
                  {!canHostAsHost && (
                    <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
                      Changing the date, venue, or description sends it to the
                      calendar host for approval instead.
                    </p>
                  )}
                  <button
                    onClick={() => setHostThisEventIndex(null)}
                    disabled={hostThisSubmitting}
                    className="w-full py-2 text-[11px] text-zinc-400 hover:text-zinc-600 disabled:opacity-50 transition-colors"
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
