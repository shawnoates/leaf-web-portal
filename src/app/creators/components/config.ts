// CTAs for the /creators landing.
// PARTNER_URL = the partnership inbox. A mailto so every "Partner with
// us" CTA opens a pre-addressed email; kept as a single source so all
// CTAs on the page converge on one address.
// SITE_URL = the live Leaf product, for the header "Try it out" link.
export { SITE_URL } from "@/lib/site";

export const PARTNER_EMAIL = "partner@joinleaf.com";
export const PARTNER_URL = `mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent(
  "Partner with Leaf — creator",
)}`;
