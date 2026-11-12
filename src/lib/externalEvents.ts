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
  /** What a guest does on the source: pay, sign up, or nothing. */
  admission?: Admission;
  /** Ticketed events: one buyer for the group, or each their own. */
  seating?: "together" | "own" | null;
  /** Friend plans only; on a calendar's plans everyone buys their own. */
  groupBuyAllowed?: boolean;
  /** "Buy near the group: Section 112". */
  section?: string | null;
  groupBuy?: PlanGroupBuyPublic | null;
}

export type Admission = "ticket" | "registration" | "open";

/** The group buy as the plan page shows it before you RSVP (no money). */
export interface PlanGroupBuyPublic {
  buyerFirstName: string;
  lockBy: string | null;
  estimateEachCents: number | null;
  bought: boolean;
  seats: number | null;
  section: string | null;
  row: string | null;
  /** The host set the seats and price; guests pay to hold one (Collect money). */
  collect?: boolean;
  seatsPlanned?: number | null;
}

export function admissionOf(e: Pick<PlanExternal, "admission" | "isFree">): Admission {
  return e.admission ?? (e.isFree ? "registration" : "ticket");
}

/** The words a plan uses for its source, by admission. */
export function admissionWords(e: Pick<PlanExternal, "admission" | "isFree" | "sourceLabel">) {
  const s = e.sourceLabel;
  switch (admissionOf(e)) {
    case "registration":
      return { eyebrow: `Register on ${s}`, action: `Register on ${s}`, covered: "I'm registered", priceSuffix: "" };
    case "open":
      return { eyebrow: `On ${s}`, action: `See it on ${s}`, covered: null, priceSuffix: "" };
    default:
      return { eyebrow: `Tickets on ${s}`, action: `Get tickets on ${s}`, covered: "I'm covered", priceSuffix: " a ticket" };
  }
}

/** One person buys every seat for the group (friend plans, seated venues). */
export function sitsTogether(e: Pick<PlanExternal, "admission" | "isFree" | "seating" | "groupBuyAllowed">): boolean {
  return admissionOf(e) === "ticket" && e.seating === "together" && e.groupBuyAllowed === true;
}

export function dollarsFromCents(cents: number | null | undefined): string {
  const d = (Number(cents) || 0) / 100;
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`;
}

/** "Thu 6 PM" for a lock-in time. */
export function lockByLine(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(":00", "");
}

/**
 * Before the seats are bought: the host's setup (a price, guests pay to hold
 * a seat) or someone going buying for the group (pay them back after).
 */
export function groupBuyPendingLine(gb: PlanGroupBuyPublic): string {
  const name = gb.buyerFirstName;
  const lock = lockByLine(gb.lockBy);
  if (gb.collect) {
    const seats = gb.seatsPlanned ? `${gb.seatsPlanned} seats` : "seats";
    const where = gb.section ? ` in Section ${gb.section}` : "";
    const price = gb.estimateEachCents ? `: ${dollarsFromCents(gb.estimateEachCents)} each` : "";
    return `${name} is getting ${seats} together${where}${price}. Tap I\u2019m going, then pay ${name} to hold yours${lock ? ` by ${lock}` : ""}.`;
  }
  return `${name} is buying seats together${lock ? `; lock in by ${lock}` : ""}. Tap I\u2019m going to get a seat, then pay ${name} back.`;
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
