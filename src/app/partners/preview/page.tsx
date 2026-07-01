import type { Metadata } from "next";
import CalendarLandingPage from "@/components/CalendarLandingPage";
import { config as apartmentConfig } from "@/app/apartment/config";

/**
 * Merchant-facing preview of the resident calendar. Reuses the
 * /apartment config verbatim and passes merchantPreview={true} to
 * CalendarLandingPage.
 *
 * Preview mode turns the page into a two-step guided tour:
 *
 *   1. Post a deal    → the local-deals carousel
 *   2. Host an event  → the upcoming plans stream
 *
 * A "Take the tour" trigger appears bottom-right on load; clicking it
 * dims the page, scrolls to the target placement, and pops a callout
 * with Back / Next / Skip controls.
 *
 * Linked from the /partners "See where your deal appears" CTA.
 */
export const metadata: Metadata = {
  title: "Merchant preview — how your offerings appear on a Leaf calendar",
  description:
    "Tour the two places your business shows up on a building's community calendar: posted deals and hosted events.",
  // Don't index — this is a sales tool, not an SEO destination.
  robots: { index: false, follow: false },
};

export default function PartnersPreviewPage() {
  return <CalendarLandingPage config={apartmentConfig} merchantPreview />;
}
