"use client";

import { useIsLoggedIn } from "./useMarketingSession";
import MarketingNav from "./MarketingNav";
import MarketingHero from "./MarketingHero";
import CalendarGrid from "./CalendarGrid";
import RsvpDemoSection from "./RsvpDemoSection";
import HowItWorks from "./HowItWorks";
import Toolkit from "./Toolkit";
import OrganizationsBand from "./OrganizationsBand";
import PricingSection from "./PricingSection";
import FaqAccordion from "./FaqAccordion";
import ClosingCta from "./ClosingCta";
import StickyGenerateBar from "./StickyGenerateBar";
import MarketingFooter from "./MarketingFooter";
import type { MarketingContent } from "./content/types";

// The "Real calendars first" page, assembled once.
//
// /personal and /organizations render identical structure and differ only
// in content — copy, chips, tiers, FAQ, and whether the organizations
// cross-sell band appears. They stay two routes on purpose (distinct
// search intent, distinct audiences, and a $499 Concierge tier that would
// only confuse someone planning dinner with friends), but there is one
// page here so the two can't drift the way they did before.

export default function MarketingPage({
  content,
}: {
  content: MarketingContent;
}) {
  const isLoggedIn = useIsLoggedIn();

  return (
    <div className="mkt min-h-screen pb-24 sm:pb-0">
      <MarketingNav isLoggedIn={isLoggedIn} />

      <MarketingHero
        headline={content.hero.headline}
        lead={content.hero.lead}
        chips={content.hero.chips}
      />

      <CalendarGrid />

      <RsvpDemoSection audience={content.audience} />

      <HowItWorks steps={content.steps} heading={content.stepsHeading} />

      <Toolkit items={content.toolkit} heading={content.toolkitHeading} />

      {content.showOrganizationsBand && <OrganizationsBand />}

      <PricingSection
        tiers={content.pricing.tiers}
        isLoggedIn={isLoggedIn}
        subhead={content.pricing.subhead}
        footnote={content.pricing.footnote}
      />

      <FaqAccordion items={content.faq} defaultOpen={1} />

      <ClosingCta
        headline={content.closing.headline}
        emphasis={content.closing.emphasis}
      />

      <MarketingFooter blurb={content.footerBlurb} />

      <StickyGenerateBar />
    </div>
  );
}
