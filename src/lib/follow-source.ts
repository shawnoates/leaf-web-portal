// Where a calendar follow came from (?src= on the calendar link).
//
// A venue placard's QR opens /org/<shareId>?src=v-xxxxxxxx. The page records
// the arrival once per visit and remembers the tag for this tab, so a follow
// made anywhere on the page carries it to followCalendarViaWeb, which stamps
// it on the new membership (GroupMembership.followSource). Session-scoped on
// purpose: attribution belongs to the scan that brought someone in today.

const KEY = (calendarId: string) => `leaf_src_${calendarId}`;
const VALID = /^[A-Za-z0-9_:.-]{1,40}$/;

/** Read ?src= from the URL and remember it. Returns the tag the first time only. */
export function captureFollowSource(calendarId: string): string | null {
  if (typeof window === "undefined" || !calendarId) return null;
  const src = new URLSearchParams(window.location.search).get("src");
  if (!src || !VALID.test(src)) return null;
  try {
    if (sessionStorage.getItem(KEY(calendarId)) === src) return null;
    sessionStorage.setItem(KEY(calendarId), src);
  } catch {
    // Private mode: the arrival still counts, the follow just goes untagged.
  }
  return src;
}

/** The tag to send with a follow on this calendar, if the visit came from one. */
export function followSource(calendarId: string | null | undefined): string | undefined {
  if (typeof window === "undefined" || !calendarId) return undefined;
  try {
    const v = sessionStorage.getItem(KEY(calendarId));
    return v && VALID.test(v) ? v : undefined;
  } catch {
    return undefined;
  }
}
