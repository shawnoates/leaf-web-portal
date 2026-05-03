// Shared verified-user cookie used by both web RSVP flows and poll voting.
// Once a phone is OTP-verified on this domain, we cache {name, phone} for a year
// and skip the OTP step on subsequent submissions. The corresponding server
// endpoints (rsvpToPlanViaWeb, submitCalendarPollVote without `code`) accept
// phone+name on trust — anyone with the same browser session inherits this
// verification, same as a logged-in cookie.

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

export function getVerifiedUserCookie(): VerifiedUser | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}
