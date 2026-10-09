/**
 * Sign-in for the host and venue pages (server: offer-link-access in
 * leaflets-server), the same way as a business's dashboard
 * (lib/merchant-session): an invitation is open, and once they've said yes
 * the page needs a signed-in device. A fresh link from a Leaf email (?s=)
 * signs in on open; otherwise the page asks for a code sent to their email.
 */

import Parse from "@/lib/parse-client";
import { SIGN_IN_EVENT, isSignInError, previewSignature } from "@/lib/merchant-session";

export type LinkPage = "host" | "venueResults" | "venuePlacard";

const KEY = "leaf.linkSessions";

function all(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function saveLinkSession(token: string, session: string | null | undefined) {
  if (!session) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...all(), [token]: session }));
  } catch {
    // Blocked storage: they'll be asked for a code next time.
  }
}

export function forgetLinkSession(token: string) {
  const v = all();
  delete v[token];
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // nothing to forget
  }
}

/** This device's session for a page (or Shawn's signed preview). */
export function linkAuth(token: string): { session?: string; preview?: string } {
  const out: { session?: string; preview?: string } = {};
  const s = all()[token];
  if (s) out.session = s;
  const p = previewSignature();
  if (p) out.preview = p;
  return out;
}

/** A fresh link from a Leaf email (?s=): sign this device in, then tidy the address bar. */
export async function signInFromEmailLink(page: LinkPage, token: string) {
  if (typeof window === "undefined") return;
  const qs = new URLSearchParams(window.location.search);
  const s = qs.get("s");
  if (!s) return;
  const r = (await Parse.Cloud.run("startLinkSession", { page, token, s }).catch(() => null)) as { session: string | null } | null;
  saveLinkSession(token, r?.session);
  qs.delete("s");
  const rest = qs.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
}

/** The email hint for the code screen. */
export async function linkEmailHint(page: LinkPage, token: string): Promise<string> {
  const r = (await Parse.Cloud.run("checkLinkSession", { page, token }).catch(() => null)) as { emailHint?: string } | null;
  return r?.emailHint || "";
}

/** Parse.Cloud.run for a host or venue page: adds the session; signed out → ask for a code. */
export async function linkRun<T = unknown>(name: string, params: { token: string } & Record<string, unknown>): Promise<T> {
  try {
    return (await Parse.Cloud.run(name, { ...params, ...linkAuth(params.token) })) as T;
  } catch (e) {
    if (isSignInError(e)) {
      forgetLinkSession(params.token);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SIGN_IN_EVENT));
      throw new Error("Please sign in again to make changes.");
    }
    throw e;
  }
}

export { isSignInError, SIGN_IN_EVENT };
