/**
 * Extract YYYY-MM-DD in a specific IANA zone from an ISO date string.
 *
 * Used to pre-fill `<input type="date">` for plan-edit modals with the
 * venue's calendar day, not the editor's. Without the timezone arg, a
 * Bangkok editor opening a NYC plan stored as 23:30 UTC would see the form
 * pre-loaded with Aug 21 (Bangkok-local) instead of Aug 20 (NYC-local).
 *
 * Falls back to viewer-local when no tz is supplied — preserves legacy
 * behavior for plans without a venue timezone.
 */
export function formatDateInputInTimezone(
  iso: string,
  timezone: string | null,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (!timezone) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  // en-CA gives us "YYYY-MM-DD" with a fixed ordering; timeZone option pins
  // the calendar day to the venue's zone.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Extract HH:MM in a specific IANA zone from an ISO date string. Pairs with
 * `formatDateInputInTimezone` for the time-input pre-fill.
 *
 * Most edit paths already prefer `time_event` (a venue-anchored wall-clock
 * string), so this is only useful as a fallback when the stored time string
 * is missing and we have to derive it from `expiryDate`.
 */
export function formatTimeInputInTimezone(
  iso: string,
  timezone: string | null,
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (!timezone) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Format a venue-anchored wall-clock time string for display in 12-hour form,
 * e.g. "18:00" → "6:00 PM". `time_event` is stored as a 24-hour "HH:mm" string,
 * so surfaces that render it verbatim show military time — pass it through here.
 *
 * Accepts either "HH:mm" (24h) or "h:mm AM/PM" (already 12h, normalized).
 * Returns "" for null/blank and echoes back anything it can't parse.
 */
export function formatWallClockTime12h(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  const m24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    let h = Number(m24[1]);
    const min = m24[2];
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${min} ${ap}`;
  }
  const m12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (m12) return `${Number(m12[1])}:${m12[2] || "00"} ${m12[3].toUpperCase()}`;
  return trimmed;
}
