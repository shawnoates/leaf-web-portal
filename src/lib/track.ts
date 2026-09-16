// Product event tracker for the public web portal.
//
// Fans out to two destinations, fire-and-forget, never throws:
//   • window.dataLayer — the house idiom (see scorecard-track.ts). GTM is not
//     installed today; pushing anyway means the events are there the day it is.
//   • recordWebEvent — the first-party `WebEvent` log on the Parse server.
//     This is the one that actually lands and is what the admin portal's
//     Analytics › Web events tab reads.
//
// Identity is best-effort and never prompts: the Parse session when there is
// one, else the verified phone this browser already holds (same precedence as
// interest taps), else only a per-browser anon id.

import Parse from "@/lib/parse-client";
import { getVerifiedUserCookie } from "@/lib/verified-user";

type Props = Record<string, string | number | boolean | null | string[]>;

/** Allowlisted on the server (cloud/web-events.js WEB_EVENTS). Add there first. */
export type WebEvent =
  | "follow_interest_list_shown"
  | "follow_interest_tap"
  | "follow_interest_list_closed"
  | "plan_share_arrival"
  | "cross_promo_share_sent"
  | "cross_promo_decided";

const ANON_COOKIE = "leaf_anon_id";

function anonId(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`${ANON_COOKIE}=([^;]+)`));
  if (m) return m[1];
  const id = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  document.cookie = `${ANON_COOKIE}=${id}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
  return id;
}

function knownPhone(): string | undefined {
  try {
    const stored = localStorage.getItem("leaf_follower_phone");
    const cached = getVerifiedUserCookie();
    const phone = (stored || cached?.phone || "").replace(/\D/g, "");
    return phone.length >= 10 ? phone : undefined;
  } catch {
    return undefined;
  }
}

export function track(event: WebEvent, props: Props = {}, calendarId?: string | null) {
  if (typeof window === "undefined") return;

  try {
    const w = window as Window & { dataLayer?: Record<string, unknown>[] };
    if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
    w.dataLayer.push({ event, calendarId: calendarId ?? null, ...props });
  } catch {
    /* analytics must never break the page */
  }

  try {
    const phone = knownPhone();
    Parse.Cloud.run("recordWebEvent", {
      event,
      props,
      ...(calendarId ? { calendarId } : {}),
      anonId: anonId(),
      path: window.location.pathname,
      ...(phone ? { phone } : {}),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
