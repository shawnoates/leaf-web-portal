// Personal plan invites — "Save a spot for a friend" (server:
// cloud/plan-invites.js).
//
// A guest (or the host) names a friend; the server mints a short code and a
// prefilled text, and the sender's own Messages app sends it. The friend lands
// on /p/<plan>?i=<code>, which redirects calendar plans to
// /org/<shareId>?plan=<plan>&i=<code>. Wherever they land, the code is
// remembered for that plan in this tab so the RSVP that follows (from any
// modal) carries it — the same session-scoped idea as follow-source.ts.

import Parse from "@/lib/parse-client";

const KEY = (planId: string) => `leaf_invite_${planId}`;
const VALID = /^[A-Za-z0-9]{4,16}$/;

/** Read ?i= from the URL and remember it for `planId`. Returns the code when the URL has one. */
export function captureInviteCode(planId: string | null | undefined): string | null {
  if (typeof window === "undefined" || !planId) return null;
  const code = new URLSearchParams(window.location.search).get("i");
  if (!code || !VALID.test(code)) return null;
  try {
    sessionStorage.setItem(KEY(planId), code);
  } catch {
    // Private mode: the banner still shows; the RSVP just goes unattributed.
  }
  return code;
}

/** The invite code to send with an RSVP on this plan, if the visit came from one. */
export function inviteCodeFor(planId: string | null | undefined): string | undefined {
  if (typeof window === "undefined" || !planId) return undefined;
  try {
    const v = sessionStorage.getItem(KEY(planId));
    if (v && VALID.test(v)) return v;
  } catch {
    /* fall through to the URL */
  }
  const fromUrl = new URLSearchParams(window.location.search).get("i");
  return fromUrl && VALID.test(fromUrl) ? fromUrl : undefined;
}

export interface PlanInviteInfo {
  found: boolean;
  eventGroupId?: string | null;
  inviterFirstName?: string;
  inviterPhoto?: string | null;
  friendName?: string | null;
  fromHost?: boolean;
  holdsSeat?: boolean;
  expiresAt?: string | null;
  status?: "open" | "claimed" | "expired" | "released";
}

export async function fetchPlanInvite(code: string, eventGroupId: string): Promise<PlanInviteInfo | null> {
  try {
    return (await Parse.Cloud.run("getPlanInvite", { code, eventGroupId })) as PlanInviteInfo;
  } catch {
    return null;
  }
}

export interface CreatedPlanInvite {
  code: string;
  url: string;
  holdsSeat: boolean;
  expiresAt: string | null;
  smsBody: string;
}

export async function createPlanInvite(eventGroupId: string, friendName: string): Promise<CreatedPlanInvite> {
  return (await Parse.Cloud.run("createPlanInvite", { eventGroupId, friendName })) as CreatedPlanInvite;
}

export interface MyPlanInvite {
  code: string;
  friendName: string | null;
  url: string;
  holdsSeat: boolean;
  expiresAt: string | null;
  status: "open" | "claimed" | "expired" | "released";
  createdAt: string;
}

export async function listMyPlanInvites(eventGroupId: string): Promise<MyPlanInvite[]> {
  try {
    const r = (await Parse.Cloud.run("listMyPlanInvites", { eventGroupId })) as { invites?: MyPlanInvite[] };
    return r?.invites ?? [];
  } catch {
    return [];
  }
}

/** `sms:` link that opens the sender's Messages app with the body filled in. */
export const smsHref = (body: string) => `sms:?&body=${encodeURIComponent(body)}`;

/** "Sun 6pm" in the viewer's zone, for the hold countdown. */
export function holdUntilLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const minute = get("minute");
  return `${get("weekday")} ${get("hour")}${minute && minute !== "00" ? `:${minute}` : ""}${get("dayPeriod").toLowerCase()}`;
}
