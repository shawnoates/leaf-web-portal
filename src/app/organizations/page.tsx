"use client";

import { useIsLoggedIn } from "@/components/marketing/useMarketingSession";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingHero from "@/components/marketing/MarketingHero";
import CalendarGrid from "@/components/marketing/CalendarGrid";
import RsvpDemoSection from "@/components/marketing/RsvpDemoSection";
import HowItWorks, { type Step } from "@/components/marketing/HowItWorks";
import Toolkit, { type ToolkitItem } from "@/components/marketing/Toolkit";
import PricingSection, {
  type PricingTier,
} from "@/components/marketing/PricingSection";
import FaqAccordion, { type FaqItem } from "@/components/marketing/FaqAccordion";
import ClosingCta from "@/components/marketing/ClosingCta";
import StickyGenerateBar from "@/components/marketing/StickyGenerateBar";
import MarketingFooter from "@/components/marketing/MarketingFooter";

// /organizations — same "Real calendars first" design as /personal, with
// the org framing: members host, the calendar carries a brand, and the
// Concierge tier is available for orgs that want Leaf run for them.

const CHIPS = [
  "Monthly member mixers",
  "Weeknight fitness classes",
  "Family weekend programming",
  "Quarterly volunteer days",
];

const STEPS: Step[] = [
  {
    number: "01",
    title: "Describe your organization",
    body: "Your type, vibe, location, and preferences. Leaf builds a real calendar: venues, times, photos. In seconds.",
  },
  {
    number: "02",
    title: "Make it yours",
    body: "Swap a venue, shift a date, cut anything that isn't right for your community. Add your logo and color.",
  },
  {
    number: "03",
    title: "Members host, people RSVP",
    body: "Members claim a plan and run it. Anyone RSVPs with a phone number and gets SMS reminders. No app required.",
  },
];

const TOOLKIT: ToolkitItem[] = [
  {
    title: "AI-suggested plans, ready to host",
    body: "Curated plans matched to your org's vibe and location, every week. Real venues, smart timing.",
  },
  {
    title: "A branded calendar page",
    body: "Your logo, your color, one page your members follow. Share the link and people discover what's happening.",
  },
  {
    title: "Phone-number RSVPs",
    body: "Members sign up with just a number and get SMS confirmations. No app, no account.",
  },
  {
    title: "Member hosting",
    body: "Members browse suggested plans and host on behalf of your community. Distributed leadership.",
  },
  {
    title: "Full control",
    body: "Block event types, set capacity limits, choose days, and cap how many events run at once.",
  },
  {
    title: "See what's actually working",
    body: "Track RSVPs, follower growth, and attendance. Understand what resonates with your community.",
  },
];

const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Free",
    monthlyPrice: "$0",
    yearlyPrice: "$0",
    monthlyPeriod: "",
    yearlyPeriod: "",
    description: "For getting your community off the ground",
    cta: "Start free →",
    highlight: false,
    ctaFocusesHero: true,
    features: [
      "1 calendar",
      "5 AI-suggested plans per week",
      "Up to 50 RSVPs per month",
      "SMS confirmations & reminders",
      "Member hosting",
      "Attendance reporting",
    ],
    excluded: ["Custom branding", "Analytics"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: "$9.99",
    yearlyPrice: "$99",
    monthlyPeriod: "/mo",
    yearlyPeriod: "/yr",
    yearlySavings: "2 months free",
    description: "For organizers who want their own brand and room to grow",
    cta: "Go Pro →",
    highlight: true,
    inheritsLabel: "Everything in Free, plus:",
    features: [
      "Unlimited calendars",
      "15 AI-suggested plans per week",
      "Unlimited RSVPs",
      "Custom branding (logo + color)",
      "Analytics dashboard",
      "Co-host management",
      "Follower re-engagement texts",
    ],
    excluded: [],
  },
  {
    id: "managed",
    name: "Concierge",
    monthlyPrice: "$499",
    yearlyPrice: "$499",
    monthlyPeriod: "/mo",
    yearlyPeriod: "/mo",
    customPrice: "$499",
    description:
      "For apartment buildings and professional orgs that want Leaf run for them",
    cta: "Book a demo",
    ctaHref: "https://calendar.app.google/NCUYc6LUKSiwLUa67",
    highlight: false,
    dark: true,
    inheritsLabel: "Everything in Pro, plus:",
    features: [
      "A dedicated host who plans and coordinates your events",
      "Post-event surveys feed a personalized monthly plan",
      "Vendor coordination, setup, and member communication",
      "Local merchant deals featured on your calendar",
      "Priority support",
    ],
    excluded: [],
  },
];

// Verbatim from the page's existing FAQ, per the spec.
const FAQ: FaqItem[] = [
  {
    q: "What are AI-suggested plans?",
    a: "Every week, Leaf automatically generates personalized, ready-to-host plans for your calendar based on your location, vibe, and preferences. These include real venues, smart timing, and images — each just needs a host, so you or your members can claim one and run it. Free includes 5 per week; Pro and Concierge get 15.",
  },
  {
    q: "Do my members need to download the app?",
    a: "No. Anyone can RSVP to your plans with just their phone number — no app download required. They'll receive SMS confirmations and reminders automatically.",
  },
  {
    q: "What is the events database?",
    a: "The events database gives you access to local events happening in your area. Browse concerts, shows, festivals, and more — then turn them into plans for your community with one tap. Available on every plan.",
  },
  {
    q: "How many calendars can I run?",
    a: "Free includes one calendar. Pro lets you run up to five — useful when one organization covers multiple buildings, chapters, or cohorts. Concierge is set up per calendar; talk to us if you need to run several.",
  },
  {
    q: "What's the difference between member hosting and co-host management?",
    a: "Member hosting (included on every plan) lets anyone you've added as a member claim a suggested plan and run that single event. Co-host management (Pro and Concierge) lets you invite trusted people who can manage every plan, approve RSVPs, and co-run the whole calendar.",
  },
  {
    q: "What counts as an RSVP?",
    a: "An RSVP is counted each time someone confirms attendance to one of your plans. On the Free plan you get up to 50 RSVPs per month, which resets at the start of each calendar month. Pro and Concierge plans have unlimited RSVPs.",
  },
  {
    q: "How far in advance can I schedule plans?",
    a: "As far ahead as you want, on every plan — there's no scheduling window on Free, Pro, or Concierge.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. You can upgrade or downgrade at any time from your dashboard. If you upgrade, you'll be charged the new rate immediately. If you downgrade, your current plan stays active until the end of the billing period.",
  },
  {
    q: "What does custom branding include?",
    a: "On the Pro and Concierge plans, you can upload your own logo and set a brand color for your calendar page. This replaces the default Leaf branding so your community sees your identity.",
  },
  {
    q: "What's the Concierge plan?",
    a: "Concierge is our done-for-you service for organizations that want Leaf run for them — apartment buildings, churches, clubs, HOAs, and more. We build a personalized monthly event plan for your community and handle the coordination, setup, and communication — plus we feature local merchant deals on your calendar. You get a thriving community calendar without adding any work for your team. $499/mo. Book a demo to get set up.",
  },
];

export default function OrganizationsPage() {
  const isLoggedIn = useIsLoggedIn();

  return (
    <div className="mkt min-h-screen pb-24 sm:pb-0">
      <MarketingNav isLoggedIn={isLoggedIn} />

      <MarketingHero
        headline={
          <>
            Type a vibe.
            <br />
            Get a community{" "}
            <em className="italic" style={{ color: "var(--mkt-green)" }}>
              calendar
            </em>
            .
          </>
        }
        lead="Real calendars made by real organizers, below. Yours takes about 20 seconds. Free, no signup to generate."
        chips={CHIPS}
      />

      <CalendarGrid />

      <RsvpDemoSection />

      <HowItWorks
        steps={STEPS}
        heading="A thriving community starts with a living calendar"
      />

      <Toolkit items={TOOLKIT} heading="Built for real community building" />

      <PricingSection
        tiers={PRICING_TIERS}
        isLoggedIn={isLoggedIn}
        subhead="Start free. Upgrade when you want your own brand — or let us run it for you."
        footnote="You keep your event budget — we make it effortless. Curated, locally-sponsored events with zero work for your team. Perfect for apartment buildings, churches, clubs, and any community that wants a thriving calendar without the lift."
      />

      <FaqAccordion items={FAQ} defaultOpen={1} />

      <ClosingCta
        headline="Join the organizers above."
        emphasis="Start a calendar."
      />

      <MarketingFooter blurb="AI-powered community calendars for the organizations that bring people together." />

      <StickyGenerateBar />
    </div>
  );
}
