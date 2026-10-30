// Paste-ready share messages for a calendar owner to drop into a group chat,
// Slack or an email, by org type (the same values as ORG_TYPES). Used by the
// dashboard's "Get your first 10 followers" prompt. The server's day-3 promote
// email (leaflets-server cloud/org-promote-email.js) carries the same lines —
// keep the two in step.

const LINES: Record<string, { lead: string; what: string }> = {
  community: { lead: "We started a calendar for the group.", what: "see what we're doing next" },
  neighborhood: { lead: "We started a calendar for the neighborhood.", what: "see what's happening nearby" },
  apartment_complex: { lead: "We started a calendar for the building.", what: "see resident events" },
  gym: { lead: "We started a calendar for the gym.", what: "see upcoming classes and meetups" },
  church: { lead: "We started a calendar for the church.", what: "see upcoming gatherings" },
  school: { lead: "We started a calendar for our school community.", what: "see upcoming events" },
  company: { lead: "We started a calendar for the team.", what: "see upcoming team events" },
  brick_and_mortar: { lead: "We started a calendar for the shop.", what: "see upcoming events" },
  consumer_brand: { lead: "We started a calendar for our community.", what: "see upcoming events" },
};
const FALLBACK = { lead: "We started a calendar.", what: "see what's coming up" };

export function promoteMessage(orgType: string | null | undefined, name: string, url: string): string {
  const l = (orgType && LINES[orgType]) || FALLBACK;
  return `${l.lead} Follow ${name} to ${l.what} and RSVP in one tap: ${url}`;
}

/** Hint under the message, e.g. "Written for apartment buildings". */
export const PROMOTE_AUDIENCE: Record<string, string> = {
  community: "friend groups",
  neighborhood: "neighborhoods",
  apartment_complex: "apartment buildings",
  gym: "gyms",
  church: "churches",
  school: "schools",
  company: "teams",
  brick_and_mortar: "shops",
  consumer_brand: "brands",
};
