import Parse from "@/lib/parse-client";
import { getVerifiedUserCookie } from "@/lib/verified-user";

/**
 * Drops: curated experiences Leaf pre-buys and drops on a calendar, with a
 * countdown to when spots open (server: leaflets-server cloud/drop-functions.js).
 */

export type DropStatus = "scheduled" | "open" | "sold_out" | "cancelled" | "done";

export type Drop = {
  id: string;
  title: string;
  teaser: string;
  includes: string;
  valueCents: number;
  /** The attendance-guarantee fee: the whole charge, no booking fee on top. */
  feeCents: number;
  imageUrl: string | null;
  /** Loops silently behind the /me popup (the plan's invitationVideo). */
  videoUrl: string | null;
  place: string;
  opensAt: string | null;
  startsAt: string | null;
  capacity: number | null;
  spotsLeft: number | null;
  status: DropStatus;
  calendar: { id: string; name: string; shareId: string | null } | null;
  notified: boolean;
  /** On the waitlist of a full Drop. */
  waitlisted: boolean;
  pass: { token: string | null; status: "paid" | "cancelled"; refundedCents: number } | null;
};

export function money(cents: number): string {
  const d = (cents || 0) / 100;
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}`;
}

/** "Ticket + a drink · $40 value", or whichever half exists. */
export function dropGets(drop: Pick<Drop, "includes" | "valueCents" | "feeCents">): string {
  const value = drop.valueCents > drop.feeCents ? `${money(drop.valueCents)} value` : "";
  return [drop.includes, value].filter(Boolean).join(" · ");
}

/** "Sat, Nov 8 · 7:30 PM" */
export function dropWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

const COOKIE = "leaf_interest_cookie";

/** The same per-browser id interest taps use, so a Notify me dedupes across reloads. */
export function interestCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (match) return match[1];
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  document.cookie = `${COOKIE}=${random}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
  return random;
}

/** Notify me / Join the waitlist: the same follower-gated interest row. */
export async function sendDropInterest(fn: "notifyMeForDrop" | "joinDropWaitlist", planId: string, typedPhone?: string) {
  const known = getVerifiedUserCookie();
  // The calendar page's follow flow keeps the phone they followed with.
  let followedWith = "";
  try {
    followedWith = localStorage.getItem("leaf_follower_phone") || "";
  } catch {}
  const phone = typedPhone || known?.phone || followedWith;
  return Parse.Cloud.run(fn, {
    planId,
    cookie: interestCookie(),
    ...(phone ? { phone } : {}),
    ...(known?.name ? { name: known.name } : {}),
  });
}
