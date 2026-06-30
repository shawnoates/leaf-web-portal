import type { Metadata } from "next";
import CalendarLandingPage from "@/components/CalendarLandingPage";
import { config as apartmentConfig } from "@/app/apartment/page";

/**
 * Merchant-facing preview of the resident calendar. Reuses the
 * /apartment config so the page reads as a real building calendar, but
 * passes merchantPreview={true} to CalendarLandingPage to layer a
 * "Merchant preview" banner + numbered callouts on top of the three
 * placement zones:
 *
 *   1. Post a deal       → the local-deals carousel
 *   2. Host an event     → the upcoming plans stream
 *   3. Sponsor an event  → the plan we explicitly mark sponsoredBy
 *
 * The sponsored plan also renders a "Sponsored by …" tag on its card
 * so the merchant can see what their sponsorship looks like in the
 * wild — not just a label, but the actual badge residents will read.
 *
 * Linked from the /partners "See where your deal appears" CTA.
 */
export const metadata: Metadata = {
  title: "Merchant preview — how your offerings appear on a Leaf calendar",
  description:
    "Tour the three places your business shows up on a building's community calendar: posted deals, hosted events, and sponsored events.",
  // Don't index — this is a sales tool, not an SEO destination.
  robots: { index: false, follow: false },
};

const previewConfig = {
  ...apartmentConfig,
  plans: apartmentConfig.plans.map((plan, i) =>
    // Tag the second plan as sponsored so the merchant can see how a
    // sponsorship reads on a real calendar card. Picks plan #2 (rather
    // than #1) so the merchant scrolls past a "vanilla" host example
    // first — the sponsor variant lands as a clear contrast.
    i === 1
      ? { ...plan, sponsoredBy: "Bocca Trattoria" }
      : plan,
  ),
};

export default function PartnersPreviewPage() {
  return <CalendarLandingPage config={previewConfig} merchantPreview />;
}
