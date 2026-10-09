/**
 * Merchant sign-in on this device (the server side is offer-merchant-session
 * in leaflets-server). A signed-up business's page needs a signed-in device:
 * a fresh link from a Leaf email signs in on open, otherwise the page asks
 * for a code emailed to the business. The session key lives in browser
 * storage per page token and rides along on every call from the page.
 *
 * Shawn's preview links carry ?preview=<signature> instead, read-only.
 */

import Parse from "@/lib/parse-client";

const KEY = "leaf.partnerSessions";
export const SIGN_IN_REQUIRED = "SIGN_IN_REQUIRED";
/** Fired when a call finds this device signed out, so the page can ask for a code. */
export const SIGN_IN_EVENT = "leaf:merchant-sign-in";

type Entry = { session: string; name: string; at: number };

function all(): Record<string, Entry> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function write(v: Record<string, Entry>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // Private mode or blocked storage: they'll be asked for a code next time.
  }
}

export function sessionFor(token: string): string | null {
  return all()[token]?.session || null;
}

export function saveSession(token: string, session: string, name = "") {
  write({ ...all(), [token]: { session, name, at: Date.now() } });
}

export function forgetSession(token: string) {
  const v = all();
  delete v[token];
  write(v);
}

/** A business this device is signed in to (for "Go to your dashboard"), newest first. */
export function signedInPartner(): { token: string; name: string } | null {
  const rows = Object.entries(all()).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  return rows.length ? { token: rows[0][0], name: rows[0][1].name || "" } : null;
}

/** The signed preview from the address bar (not the old ?preview=1). */
export function previewSignature(): string | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("preview");
  return p && p !== "1" ? p : null;
}

export function isSignInError(e: unknown): boolean {
  return e instanceof Error && e.message === SIGN_IN_REQUIRED;
}

/** What a merchant-page call needs besides its own params: this device's session, or Shawn's preview. */
export function merchantAuth(token: string): { session?: string; preview?: string } {
  const out: { session?: string; preview?: string } = {};
  const s = sessionFor(token);
  if (s) out.session = s;
  const p = previewSignature();
  if (p) out.preview = p;
  return out;
}

/**
 * Parse.Cloud.run for the merchant page: adds the session (or preview).
 * A signed-out answer forgets the stale session and asks the page for a code.
 */
export async function merchantRun<T = unknown>(name: string, params: { token: string } & Record<string, unknown>): Promise<T> {
  try {
    return (await Parse.Cloud.run(name, { ...params, ...merchantAuth(params.token) })) as T;
  } catch (e) {
    if (isSignInError(e)) {
      forgetSession(params.token);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SIGN_IN_EVENT));
      throw new Error("Please sign in again to make changes.");
    }
    throw e;
  }
}
