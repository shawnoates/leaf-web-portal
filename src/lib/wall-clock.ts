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
