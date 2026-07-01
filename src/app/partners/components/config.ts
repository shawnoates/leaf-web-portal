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
// "Become a partner" / self-serve claim form. Every CTA that isn't
// explicitly a "Book a demo" now funnels here.
export const PARTNER_URL = "https://partner.joinleaf.com/request";
export const SAMPLE_URL = "/partners/preview";
// Post-a-deal self-serve entry — aliases the same claim form for now.
// TODO: replace with the real self-serve deal-submission URL when it ships.
export const DEAL_URL = PARTNER_URL;
// CLAIM_URL is a semantic alias — currently the same partner form.
export const CLAIM_URL = PARTNER_URL;
// Dedicated "Book a demo" calendar for the paid Host-an-event path.
export const DEMO_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ3dkMyfIKR2I5qXFGgk3-bkHxtddPY-AkQu2KZnFELQq1AvajnYAL-Ltwn-QREem2qnujqds22i";
