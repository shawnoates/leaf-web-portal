// Outside events (Ticketmaster, SeatGeek, Eventbrite, Luma) as the server's
// cloud/external-events.js returns them. A plan made from one keeps
// { source, id } and the server re-reads the event when it's created and
// hourly after (time moves, cancellations).

export interface ExternalEvent {
  source: "ticketmaster" | "seatgeek" | "eventbrite" | "luma" | "partiful" | "web";
  sourceLabel: string;
  externalId: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  localDate: string | null; // "2026-12-11"
  localTime: string | null; // "19:00"
  timezone: string | null;
  startUtc: string | null;
  venue: { name: string | null; address: string | null; city: string | null; lat: number | null; lng: number | null } | null;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  status: "scheduled" | "cancelled" | "postponed" | "rescheduled";
}

/** The `external` block getOrgCalendarPage / getPlanShareInfo put on a plan. */
export interface PlanExternal {
  source: string;
  sourceLabel: string;
  id: string | null;
  status: string;
  ticketUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  lastSyncedAt: string | null;
}

function money(v: number): string {
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
}

/** "$28–$45", "From $22", "Free"; null when the source gave no price. */
export function priceLine(p: { priceMin: number | null; priceMax: number | null; isFree: boolean }): string | null {
  if (p.isFree) return "Free";
  const { priceMin: min, priceMax: max } = p;
  if (min != null && max != null && max > min) return `${money(min)}–${money(max)}`;
  if (min != null) return `From ${money(min)}`;
  if (max != null) return `Up to ${money(max)}`;
  return null;
}

/** "Fri, Dec 11 · 7:00 PM", read in the venue's zone. */
export function whenLine(ev: Pick<ExternalEvent, "localDate" | "localTime" | "startUtc" | "timezone">): string {
  if (ev.startUtc && ev.localTime) {
    try {
      return new Date(ev.startUtc).toLocaleString("en-US", {
        timeZone: ev.timezone || undefined,
        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      }).replace(/, (\d)/, " · $1").replace(/^(\w+), (\w+ \d+) ·/, "$1, $2 ·");
    } catch { /* fall through */ }
  }
  if (!ev.localDate) return "Date to be announced";
  const [y, m, d] = ev.localDate.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
  return ev.localTime ? `${day} · ${to12h(ev.localTime)}` : day;
}

function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Ticket and event sites a pasted link is read from (resolveExternalEventFromUrl). */
export function isEventLink(text: string): boolean {
  return /^(https?:\/\/)?([a-z0-9-]+\.)*(ticketmaster\.[a-z.]+|livenation\.com|ticketweb\.[a-z.]+|seatgeek\.com|eventbrite\.[a-z.]+|lu\.ma|luma\.com|partiful\.com)(\/|$)/i.test(text.trim());
}
