/**
 * Date resolution for AI starter events (`Groups.aiSourceEvents`).
 *
 * EXTRACTED FROM /org/[shareId]/page.tsx, where this logic was developed and
 * two separate bugs were already fixed. PlansManager.tsx carried its own copy
 * whose header claimed it "mirrors the logic in /org" — it had stopped doing
 * that, and it still had BOTH bugs:
 *
 *   1. The weekly branch returned a browser-LOCAL Date, which the UTC
 *      formatter then shifted by the viewer's offset.
 *   2. "Which day is next Friday" was asked of the viewer's clock rather than
 *      the calendar's, so a Pacific manager at 11 PM Tuesday — already
 *      Wednesday in Brooklyn — resolved a week off.
 *
 * One copy, imported by both, is the point: the drift IS the bug. Anything
 * else rendering an aiSourceEvents date should import from here rather than
 * re-deriving it.
 */

import { tzOffsetMs, floatingIsoToInstant } from "./wall-clock";

/**
 * AI source events store a FLOATING wall-clock, not an instant: the server
 * builds isoDatetime as `${dateISO}T${hh}:${mm}:00Z` (ai-calendar-functions.js),
 * stamping the venue's wall-clock with a Z it never earned. "Wed 8:30 AM"
 * becomes 08:30Z.
 *
 * So these must be read back in UTC, which returns the exact wall-clock the
 * generator wrote — 8:30 AM to every viewer, anywhere. Localizing them instead
 * shifted the time by the VIEWER's offset: a Pacific reader saw a Brooklyn
 * 8:30 AM event as 1:30 AM. Formatting in the venue's real zone is equally
 * wrong here — that yields 4:30 AM — because the stored instant is not a true
 * instant.
 *
 * Floating is the right model for these: a template generated for one prompt
 * is cached and reused across cities, so "Wed 8:30 AM" has to mean 8:30 local
 * wherever it lands. Real plans are different — they carry a genuine instant
 * plus their venue's IANA zone, and go through their own formatters with it.
 */
export const FLOATING_EVENT_TZ = "UTC";

export interface AIEventDateInput {
  time?: string;
  isoDatetime?: string | null;
  dateISO?: string | null;
}

export interface ResolvedAIEventDate {
  date: Date | null;
  instant: Date | null;
  isWeekly: boolean;
}

const NO_AI_EVENT_DATE: ResolvedAIEventDate = {
  date: null,
  instant: null,
  isWeekly: false,
};

/**
 * Resolve an AI-adopted event's actual date. Call it on every render so weekly
 * suggestions ("Fri · 7:30 PM") roll forward as their target day passes.
 *
 * Two shapes:
 *   Fixed-date (Ticketmaster): time string contains a month name
 *   ("Sat, Sep 14 · 7:05 PM"). isoDatetime stays put. If the event has already
 *   passed, `date` is null so the caller can hide it.
 *
 *   Weekly (Places / Gemini): time string is weekday + time only
 *   ("Fri · 7:30 PM"). The next occurrence is recomputed from "now" so stale
 *   isoDatetimes stored server-side don't leak through.
 *
 * Returns TWO dates, and they are not interchangeable:
 *   `date`    — the FLOATING wall clock (see FLOATING_EVENT_TZ). Read it with
 *               UTC getters or format it in UTC; that yields the hour the
 *               generator wrote, for every viewer. This is the display value.
 *   `instant` — the real moment that wall clock names in the calendar's zone.
 *               This is the ONLY value that may be compared to `Date.now()`.
 * Conflating them is what hid an 8:30 PM Eastern card at 7:30 PM: the floating
 * value is 20:30Z, which as an instant is 4:30 PM, already past the 3h grace.
 *
 * `timeZone` is the CALENDAR's IANA zone (`orgTimezone`). Null falls back to
 * viewer-local for the weekday roll, which is the pre-existing behavior on
 * calendars that have no neighborhood.
 */
export function resolveAIEventDate(
  ev: AIEventDateInput,
  timeZone: string | null = null,
): ResolvedAIEventDate {
  const timeStr = String(ev.time || "").trim();
  const MONTH_RX = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
  // A dateISO on the event means the server locked a specific calendar
  // date for it — Shape B cadence (e.g. "4 times over 6 weeks"), or the
  // month-named Ticketmaster branch. Trust it; do NOT re-resolve to
  // "next Friday" from today.
  const isFixedDate =
    MONTH_RX.test(timeStr) || !!(ev.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(ev.dateISO));

  if (isFixedDate) {
    if (!ev.isoDatetime) return NO_AI_EVENT_DATE;
    const d = new Date(ev.isoDatetime);
    if (Number.isNaN(d.getTime())) return NO_AI_EVENT_DATE;
    // A starter card is ALWAYS "Waiting on host" — nobody has committed to
    // running it — so it retires at its own start time, not at the end of the
    // local day the way a hosted plan does. A 9 AM suggestion still sitting
    // there at 11 AM is advertising something that never happened.
    // Anchored to the calendar's zone: the stored value is a floating wall
    // clock, so comparing it raw retires the card early by the UTC offset.
    const instant = floatingIsoToInstant(ev.isoDatetime, timeZone) ?? d;
    if (instant.getTime() <= Date.now()) return NO_AI_EVENT_DATE;
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
    .match(
      /\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|weds|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday)\b/,
    );
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
  // FLOATING_EVENT_TZ identically to the fixed-date branch. Returning a
  // browser-local Date here is what made weekly cards show the wrong hour —
  // the UTC formatter then shifted them by the viewer's offset.
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
