// Wall-clock helpers for admin-curated Featured suggestions, whose time belongs
// to the VENUE's timezone rather than the viewer's browser.
//
// Shared by the public /org calendar page and the owner dashboard's
// suggested-plans rail so both anchor a hosted featured plan identically. The
// repo has already been bitten by two copies of the offset math disagreeing by
// an hour — keep this the only implementation.

/**
 * UTC-offset suffix ("-04:00") for a wall-clock instant in a given IANA zone.
 *
 * Lets the browser hand the server an unambiguous absolute time anchored to
 * the VENUE's zone rather than its own. Mirrors the server's
 * `wallClockToUtcInTimezone` so both sides resolve DST the same way.
 */
export function zoneOffsetSuffix(dateStr: string, timeStr: string, timeZone: string): string {
  try {
    const tentative = new Date(`${dateStr}T${timeStr}:00Z`);
    if (isNaN(tentative.getTime())) return "Z";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(tentative);
    const value = parts.find((p) => p.type === "timeZoneName")?.value;
    const m = value?.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!m) return "Z"; // GMT+0 renders bare "GMT"; UTC is the correct read
    return `${m[1]}${m[2].padStart(2, "0")}:${m[3] || "00"}`;
  } catch {
    return "Z";
  }
}

/**
 * UTC offset in ms for an instant in a given IANA zone. Mirrors the server's
 * `getTimezoneOffsetMs` (cloud/timezone-utils.js) so both sides resolve DST
 * identically.
 */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    // Intl renders midnight as "24" in some engines.
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUTC - instant.getTime();
}

/**
 * A FLOATING ISO string — a wall clock stamped with a `Z` it never earned —
 * resolved to the real instant it names in `timeZone`.
 *
 * `aiSourceEvents[].isoDatetime` is written this way (see FLOATING_EVENT_TZ in
 * the /org page): "8:30 PM" is stored as `...T20:30:00Z`, which as an actual
 * moment is 4:30 PM Eastern. Reading it with a bare `new Date()` is right for
 * DISPLAY (formatted back out in UTC, it returns the generator's wall clock to
 * every viewer) and wrong for everything else — comparing it to `Date.now()`
 * hid day-of cards hours early, and it stamped hosted plans at the wrong time.
 *
 * Mirrors the server's `parseFloatingIsoInTimezone`, single-pass, so the two
 * agree. Falls back to the bare read when no zone is known.
 */
export function floatingIsoToInstant(
  iso: string,
  timeZone: string | null,
): Date | null {
  const wallAsUTC = new Date(iso);
  if (Number.isNaN(wallAsUTC.getTime())) return null;
  if (!timeZone) return wallAsUTC;
  try {
    return new Date(wallAsUTC.getTime() - tzOffsetMs(wallAsUTC, timeZone));
  } catch {
    return wallAsUTC;
  }
}

/** Minimum visibility after start, when end-of-local-day would be sooner. */
export const PLAN_MIN_GRACE_MS = 3 * 60 * 60 * 1000;

/**
 * Assumed plan length when the server sends no `endDate`. That is the common
 * case, not the rare one — only ~6% of plans carry an end_date. Mirrors the
 * server's PLAN_DEFAULT_DURATION_MS.
 */
export const PLAN_DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

/** When a plan is over: its endDate if present, else start + default duration. */
export function planEndInstant(
  startISO: string | null | undefined,
  endISO: string | null | undefined = null,
): Date | null {
  const startMs = Date.parse(String(startISO ?? ""));
  if (!Number.isFinite(startMs)) return null;
  const endMs = Date.parse(String(endISO ?? ""));
  if (Number.isFinite(endMs) && endMs > startMs) return new Date(endMs);
  return new Date(startMs + PLAN_DEFAULT_DURATION_MS);
}

/**
 * Lifecycle of a plan, for deciding what the RSVP button should say.
 *
 * "live" is a real state, not a rounding error: a neighborhood plan that
 * started 20 minutes ago is exactly the one someone wants to join. RSVP stays
 * open through it and closes at `ended`. An unknown/unparseable start reads as
 * "upcoming" — never refuse an RSVP because a date is missing.
 */
export function planLifecycle(
  startISO: string | null | undefined,
  endISO: string | null | undefined = null,
  now: Date = new Date(),
): "upcoming" | "live" | "ended" {
  const startMs = Date.parse(String(startISO ?? ""));
  if (!Number.isFinite(startMs)) return "upcoming";
  if (now.getTime() < startMs) return "upcoming";
  const end = planEndInstant(startISO, endISO);
  return end && now.getTime() >= end.getTime() ? "ended" : "live";
}

/**
 * Lower bound on a plan/suggestion's start for it to still be worth showing:
 * visible while `start > cutoff`.
 *
 * A plan stays up until the end of its own local day, with a 3h floor so an
 * 11 PM plan doesn't vanish at midnight. Mirrors the server's
 * `calendarDayVisibilityCutoff` (cloud/timezone-utils.js) — the card filter
 * and the plans query have to agree, or a card and the plan it became
 * disappear at different times.
 */
export function calendarDayVisibilityCutoff(
  timeZone: string | null,
  now: Date = new Date(),
  minGraceMs: number = PLAN_MIN_GRACE_MS,
): Date {
  const floor = new Date(now.getTime() - minGraceMs);
  if (!timeZone) return floor;
  try {
    // Local midnight today: read now's calendar date in the zone, then
    // resolve that date at 00:00 back to an instant.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const midnight = floatingIsoToInstant(
      `${get("year")}-${get("month")}-${get("day")}T00:00:00Z`,
      timeZone,
    );
    if (!midnight) return floor;
    return midnight.getTime() < floor.getTime() ? midnight : floor;
  } catch {
    return floor;
  }
}

/**
 * The calendar DAY a featured suggestion happens on, as a local Date.
 *
 * Read off `localWallClock` (the string the admin typed, verbatim) rather than
 * derived from the UTC instant: a 9 PM PT event is next-day UTC, so formatting
 * the instant lands on the wrong day. Anchored at local noon — the same
 * convention `updatePlanIdea` uses for suggestion dates — so no DST shift or
 * `toISOString()` round-trip can push it across a day boundary.
 *
 * Falls back to the suggestion's `date` (`startsAtUTC`), which is null for
 * date-only rows and for `local_wall_clock` suggestions.
 */
export function featuredWallClockDate(idea: {
  localWallClock?: string | null;
  date?: string | null;
}): Date | null {
  const m = String(idea.localWallClock || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  if (idea.date) {
    const d = new Date(idea.date);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}
