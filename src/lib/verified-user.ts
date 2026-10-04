// Shared verified-user cookie used by the web RSVP, follow and poll flows.
//
// The cookie only remembers {name, phone} for prefilling forms. It is NOT
// proof of anything — it's plain JSON any page script can write. What proves
// who someone is, is the Parse session that verifyOTP (or Google, or an email
// code) mints and the page adopts with Parse.User.become. So
// getVerifiedUserCookie() answers "is this browser signed in as a person with
// a phone, and who?" — the cookie's details are returned only when they match
// the signed-in account, and with no session it returns null, which sends
// every "skip the code" shortcut back through verification.

import Parse from "@/lib/parse-client";

const COOKIE_NAME = "leaf_verified_user";

export interface VerifiedUser {
  name: string;
  phone: string; // formatted like "555-555-5555" or "(555) 555-5555"
}

export function setVerifiedUserCookie(name: string, phone: string) {
  if (typeof document === "undefined") return;
  const data = JSON.stringify({ name, phone });
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(data)}; expires=${expires}; path=/; SameSite=Lax`;
}

function readCookie(): VerifiedUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

const last10 = (p: string | null | undefined) => String(p || "").replace(/\D/g, "").slice(-10);

/** "555-555-5555" for a stored "+15555555555". */
function formatPhone(digits: string) {
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
}

/**
 * The signed-in person's name and phone, or null when this browser has no
 * session for someone with a phone. The cookie supplies the name they typed
 * (and their formatting) when it's for the same phone.
 */
export function getVerifiedUserCookie(): VerifiedUser | null {
  if (typeof window === "undefined") return null;
  let user: { get: (k: string) => unknown } | null = null;
  try {
    user = Parse.User.current();
  } catch {
    return null;
  }
  const phone = last10(user?.get("phone") as string | undefined);
  if (!user || phone.length !== 10) return null;
  const cookie = readCookie();
  if (cookie && last10(cookie.phone) === phone) return cookie;
  const name = String(user.get("full_name") || user.get("name") || user.get("first_name") || "");
  return { name, phone: formatPhone(phone) };
}
