import type { MarketingContent } from "./types";

// /personal — content only. Structure lives in MarketingPage.
// Copy is the homepage v2 spec's, which marks it final; the FAQ is the
// page's own existing copy, reused verbatim per the spec.

export const personalContent: MarketingContent = {
  hero: {
    headline: (
      <>
        Type a vibe.
        <br />
        Get a{" "}
        <em className="italic" style={{ color: "var(--mkt-green)" }}>
          calendar
        </em>
        .
      </>
    ),
    lead: "Real calendars made by real planners, below. Yours takes about 20 seconds. Free, no signup to generate.",
    chips: [
      "LES first date",
      "Family fun this month",
      "Thursday happy hour",
      "Sunday long runs",
    ],
  },

  audience: "Friends",
  stepsHeading: 'From a vibe to "see you Saturday"',
  steps: [
    {
      number: "01",
      title: "Type what you're in the mood for",
      body: '"Family fun this month." Leaf builds a real calendar: venues, times, photos. In seconds, no signup.',
    },
    {
      number: "02",
      title: "Make it yours",
      body: "Swap a venue, shift a date, cut anything you'd never show up for. The calendar bends to your life.",
    },
    {
      number: "03",
      title: "Your people RSVP by phone",
      body: "Share the link. Friends tap in with a number and get SMS reminders. No app required.",
    },
  ],

  toolkitHeading: "The planner's toolkit, finally",
  toolkit: [
    {
      title: "AI-suggested plans, ready to host",
      body: "Stop spending Sundays scrolling. Leaf hands you a week of plans matched to your taste.",
    },
    {
      title: "Your own calendar page",
      body: "A clean, shareable page that's just yours. Drop the link in a group chat and you're done.",
    },
    {
      title: "Phone-number RSVPs",
      body: "Friends sign up with just a number and get SMS confirmations. No app, no account.",
    },
    {
      title: "Co-host with friends",
      body: "Hand a plan to a friend to run. Share the load when you're busy.",
    },
    {
      title: "Plan on your terms",
      body: "Cap guest counts, block out off-days, skip stuff you'd never go to.",
    },
    {
      title: "See what's actually working",
      body: "Track who showed up, who keeps coming back, and which plans land.",
    },
  ],

  showOrganizationsBand: true,

  pricing: {
    subhead:
      "Start free. Upgrade when you want your own brand and more room to grow.",
    tiers: [
      {
        id: "starter",
        name: "Free",
        monthlyPrice: "$0",
        yearlyPrice: "$0",
        monthlyPeriod: "",
        yearlyPeriod: "",
        description: "For getting your calendar off the ground",
        cta: "Start free →",
        highlight: false,
        ctaFocusesHero: true,
        features: [
          "1 calendar",
          "5 AI-suggested plans per week",
          "Up to 50 RSVPs per month",
          "SMS confirmations & reminders",
          "Co-host with friends",
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
        description:
          "For planners who want their own brand and room to grow",
        cta: "Go Pro →",
        highlight: true,
        inheritsLabel: "Everything in Free, plus:",
        features: [
          "Unlimited calendars",
          "15 AI-suggested plans per week",
          "Unlimited RSVPs",
          "Custom branding (logo + color)",
          "Custom plan-suggestion controls",
          "Analytics dashboard",
        ],
        excluded: [],
      },
    ],
  },

  faq: [
    {
      q: "Is this just for big groups?",
      a: "Not at all. Most personal calendars start with five to ten close friends. Leaf works just as well for a regular dinner crew as it does for a 200-person run club.",
    },
    {
      q: "Do my friends need to download an app?",
      a: "No. Anyone can RSVP to your plans with just their phone number. They'll get SMS confirmations and reminders automatically — no account, no app.",
    },
    {
      q: "What are AI-suggested plans?",
      a: "Ready-to-host plans that keep your calendar alive between the ones you host — real venues, smart timing, beautiful images. Each one just needs a host: your crew can claim one and run it themselves, so you're not the only one carrying the group chat. Free gets 5 per week; Pro gets 15.",
    },
    {
      q: "What counts as an RSVP?",
      a: "Every confirmed attendee on one of your plans. Free includes 50 RSVPs per calendar month, resetting on the 1st. Pro is unlimited.",
    },
    {
      q: "How far in advance can I plan?",
      a: "As far ahead as you want. There's no scheduling window on Free or Pro — put next weekend and next season on the same calendar.",
    },
    {
      q: "Can a friend help me run it?",
      a: "Yes. Hand off individual plans to a friend so you don't have to be at every one. Great for when you're traveling or just need a break.",
    },
    {
      q: "Can I switch plans later?",
      a: "Yes. Upgrade or downgrade anytime from your dashboard. Upgrades take effect immediately; downgrades kick in at the end of your billing period.",
    },
    {
      q: "What does custom branding include?",
      a: "On the Pro plan, you can upload your own logo and set a brand color for your calendar page — so it feels like yours, not Leaf's.",
    },
  ],

  closing: {
    headline: "Join the planners above.",
    emphasis: "Start a calendar.",
  },

  footerBlurb: "AI-powered calendars for the friends who run things.",
};
