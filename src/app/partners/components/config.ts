// CTAs for the /partners landing.
//
// PARTNER_URL = partner contact / booking link, used by every paid
// offering (host, "become a partner"). Reuses the same Google Calendar
// slot as /organizations and /resident-managers so every "book a demo"
// CTA across the site funnels into one calendar.
//
// SAMPLE_URL = the merchant-facing preview at /partners/preview. Same
// rendering as the /apartment demo but with a two-step guided tour
// pointing to where the two offerings (post a deal / host an event)
// appear for residents.
//
// DEAL_URL = self-serve "post a deal" link. This is the FREE on-ramp
// (merchant equivalent of the property-managers' free calendar) and
// must NOT route through the demo calendar — adding a deal should be
// instant.
// TODO: replace with the real self-serve deal-submission URL once it
// ships. Falls back to PARTNER_URL so the button still lands
// somewhere actionable in the meantime.
export const PARTNER_URL = "https://calendar.app.google/NCUYc6LUKSiwLUa67";
export const SAMPLE_URL = "/partners/preview";
export const DEAL_URL = PARTNER_URL;
// CLAIM_URL = the "Claim your business for free" form. Runs outside
// os.joinleaf.com on the dedicated partner.joinleaf.com subdomain.
export const CLAIM_URL = "https://partner.joinleaf.com/request";
