import type { ReactNode } from "react";
import type { Step } from "../HowItWorks";
import type { ToolkitItem } from "../Toolkit";
import type { PricingTier } from "../PricingSection";
import type { FaqItem } from "../FaqAccordion";

/** Everything that differs between /personal and /organizations. The page
 *  structure itself lives in MarketingPage. */
export interface MarketingContent {
  hero: {
    headline: ReactNode;
    lead: string;
    chips: string[];
  };
  /** What this page calls the people who RSVP — "Friends" vs "Members". */
  audience: string;
  stepsHeading: string;
  steps: Step[];
  toolkitHeading: string;
  toolkit: ToolkitItem[];
  /** The organizations cross-sell band — /personal only; on
   *  /organizations it would point at the page you're already on. */
  showOrganizationsBand: boolean;
  pricing: {
    subhead: string;
    footnote?: string;
    tiers: PricingTier[];
  };
  faq: FaqItem[];
  closing: {
    headline: string;
    emphasis: string;
  };
  footerBlurb: string;
}
