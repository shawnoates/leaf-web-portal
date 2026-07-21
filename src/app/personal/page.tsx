"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import PersonalHero from "./PersonalHero";
import {
  Sparkles,
  Calendar,
  Users,
  ArrowRight,
  Phone,
  BarChart3,
  Shield,
  Zap,
  Check,
  ChevronRight,
} from "lucide-react";

type PricingTier = {
  id: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyPeriod: string;
  yearlyPeriod: string;
  yearlySavings?: string;
  description: string;
  cta: string;
  highlight: boolean;
  inheritsLabel?: string;
  features: string[];
  excluded: string[];
};

const PRICING_TIERS: PricingTier[] = [
  {
    id: "starter",
    name: "Free",
    monthlyPrice: "Free",
    yearlyPrice: "Free",
    monthlyPeriod: "",
    yearlyPeriod: "",
    description: "For getting your calendar off the ground",
    cta: "Get started free",
    highlight: false,
    features: [
      "1 calendar",
      "5 AI-suggested plans per week",
      "Up to 50 RSVPs per month",
      "Phone-number RSVP with SMS confirmations",
      "Co-host with friends",
      "Automated follower notifications",
      "Attendance reporting",
      "Photo collection",
      "Access to local events database",
    ],
    excluded: [
      "Custom branding",
      "Analytics",
      "Unlimited scheduling",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: "$9.99",
    yearlyPrice: "$99",
    monthlyPeriod: "/mo",
    yearlyPeriod: "/yr",
    yearlySavings: "2 months free",
    description: "For planners who want their own brand and room to grow",
    cta: "Start with Pro",
    highlight: true,
    inheritsLabel: "Everything in Free, plus:",
    features: [
      "Unlimited calendars",
      "15 AI-suggested plans per week",
      "Unlimited RSVPs",
      "Unlimited scheduling",
      "Custom branding (logo + brand color)",
      "Custom plan-suggestion controls",
      "Analytics dashboard",
    ],
    excluded: [],
  },
];

const STEPS = [
  {
    number: "01",
    icon: <Sparkles className="w-6 h-6" />,
    title: "Type what you're in the mood for",
    description:
      "\"Family fun this month.\" \"Date night in Fort Greene.\" Leaf turns it into a real calendar — actual venues, smart timing, beautiful images — in seconds. No quiz, no signup.",
  },
  {
    number: "02",
    icon: <Zap className="w-6 h-6" />,
    title: "Make it yours",
    description:
      "Swap a venue, shift a date, cut anything you'd never show up for. Keep what you love. The calendar bends to your life, not the other way around.",
  },
  {
    number: "03",
    icon: <Users className="w-6 h-6" />,
    title: "Your people RSVP by phone",
    description:
      "Share your calendar link. Friends sign up with just a phone number — SMS confirmations and reminders, no app required.",
  },
];

const FEATURES = [
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "AI-suggested plans, ready to host",
    description:
      "Stop spending Sundays scrolling for ideas. Leaf hands you a week of plans matched to your taste — coffee walks, dinners, run routes, trivia nights.",
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    title: "Your own calendar page",
    description:
      "A clean, shareable page that's just yours. Drop the link in a group chat or your bio — no friction to RSVP.",
  },
  {
    icon: <Phone className="w-5 h-5" />,
    title: "Phone-number RSVPs",
    description:
      "Friends sign up with just a number and get SMS confirmations and reminders. No app downloads, no account required.",
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Co-host with friends",
    description:
      "Hand a plan to a friend to run. Share the load when you're busy and keep the calendar alive.",
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Plan on your terms",
    description:
      "Cap guest counts, block out off-days, skip stuff you'd never go to. The calendar bends to your life — not the other way around.",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "See what's actually working",
    description:
      "Track who showed up, who keeps coming back, and which plans land. Your social life, with a bit of insight.",
  },
];

export default function PersonalPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    const currentUser = Parse.User.current();
    setIsLoggedIn(!!currentUser);
  }, []);

  return (
    <div className="min-h-screen">
      <PersonalHero isLoggedIn={isLoggedIn} />

      {/* Who it's for */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <p className="text-xs tracking-wider uppercase text-zinc-500 font-semibold">
            Who it's for
          </p>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight">
            The friend who's <span className="italic">always</span> the planner.
          </h2>
          <p className="text-zinc-500 text-lg font-light leading-relaxed max-w-2xl mx-auto">
            Your supper club. Your weekend run crew. Your "we should hang out
            more" group chat. The yoga students you want to actually meet up
            with. Leaf takes the planning off your plate so the calendar runs
            itself.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-zinc-50 py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-20 text-center md:text-left">
            <p className="text-xs tracking-wider uppercase text-zinc-500 font-semibold mb-3">
              How It Works
            </p>
            <h2 className="text-4xl font-light tracking-tight italic">
              From a vibe to &ldquo;see you Saturday&rdquo;
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-16">
            {STEPS.map((step) => (
              <div key={step.number} className="space-y-6">
                <div className="flex items-center gap-4">
                  <span className="text-xs tracking-wider uppercase font-semibold text-zinc-400">
                    {step.number}
                  </span>
                  <div className="h-px flex-1 bg-zinc-200" />
                </div>
                <div className="w-12 h-12 border border-zinc-200 flex items-center justify-center">
                  {step.icon}
                </div>
                <h3 className="text-xl font-light tracking-tight">
                  {step.title}
                </h3>
                <p className="text-sm text-zinc-500 font-light leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-20">
            <p className="text-xs tracking-wider uppercase text-zinc-500 font-semibold mb-3">
              Everything You Need
            </p>
            <h2 className="text-4xl font-light tracking-tight italic">
              The planner's toolkit, finally
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="space-y-4">
                <div className="w-10 h-10 bg-zinc-100 flex items-center justify-center">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-medium tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-500 font-light leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-zinc-50 py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 text-center">
            <p className="text-xs tracking-wider uppercase text-zinc-500 font-semibold mb-3">
              Pricing
            </p>
            <h2 className="text-4xl font-light tracking-tight italic mb-3">
              Simple pricing that grows with you
            </h2>
            <p className="text-zinc-500 font-light mb-8 max-w-xl mx-auto">
              Start free. Upgrade when you want your own brand and more room to grow.
            </p>
            <div className="inline-flex items-center gap-1 bg-zinc-100 rounded-full p-1">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
                  billingPeriod === "monthly"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod("yearly")}
                className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
                  billingPeriod === "yearly"
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                Yearly
              </button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {PRICING_TIERS.map((tier) => {
              const price = billingPeriod === "yearly" ? tier.yearlyPrice : tier.monthlyPrice;
              const period = billingPeriod === "yearly" ? tier.yearlyPeriod : tier.monthlyPeriod;
              return (
              <div
                key={tier.name}
                className={`bg-white p-8 flex flex-col ${
                  tier.highlight
                    ? "ring-2 ring-zinc-900 relative"
                    : "border border-zinc-200"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-8 bg-zinc-900 text-white px-3.5 py-1 text-xs tracking-wider uppercase font-semibold rounded-full">
                    Most popular
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xs tracking-wider uppercase font-semibold text-zinc-500 mb-4">
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-light tracking-tight">
                      {price}
                    </span>
                    {period && (
                      <span className="text-zinc-400 text-sm">
                        {period}
                      </span>
                    )}
                  </div>
                  {billingPeriod === "yearly" && tier.yearlySavings && (
                    <span className="text-xs text-green-600 font-medium mt-1 inline-block">
                      {tier.yearlySavings}
                    </span>
                  )}
                  <p className="text-sm text-zinc-500 font-light mt-2">
                    {tier.description}
                  </p>
                </div>
                <div className="flex-1 space-y-3 mb-8">
                  {tier.inheritsLabel && (
                    <p className="text-xs font-semibold tracking-wide text-zinc-700 mb-4">
                      {tier.inheritsLabel}
                    </p>
                  )}
                  {tier.features.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-start gap-3 text-sm"
                    >
                      <Check className="w-4 h-4 text-zinc-900 mt-0.5 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                  {tier.excluded.map((feature) => (
                    <div
                      key={feature}
                      className="flex items-start gap-3 text-sm text-zinc-300"
                    >
                      <span className="w-4 h-4 flex items-center justify-center mt-0.5 shrink-0">
                        &mdash;
                      </span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={isLoggedIn ? "/dashboard" : `/organizations/setup?tier=${tier.id}&billingPeriod=${billingPeriod}`}
                  className={`w-full py-3.5 text-sm font-semibold text-center flex items-center justify-center gap-2 rounded-full transition-colors ${
                    tier.highlight
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : "border border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                  }`}
                >
                  {isLoggedIn ? "Go to dashboard" : tier.cta} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-xs tracking-wider uppercase text-zinc-500 font-semibold mb-3 text-center">
            FAQ
          </p>
          <h2 className="text-3xl font-light tracking-tight italic mb-12 text-center">
            Common questions
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-bold mb-1">Is this just for big groups?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Not at all. Most personal calendars start with five to ten close
                friends. Leaf works just as well for a regular dinner crew as it
                does for a 200-person run club.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">Do my friends need to download an app?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                No. Anyone can RSVP to your plans with just their phone number.
                They'll get SMS confirmations and reminders automatically — no
                account, no app.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">What are AI-suggested plans?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Ready-to-host plans that keep your calendar alive between the
                ones you host — real venues, smart timing, beautiful images.
                Each one just needs a host: your crew can claim one and run it
                themselves, so you&rsquo;re not the only one carrying the group chat.
                Free gets 5 per week; Pro gets 15.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">What counts as an RSVP?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Every confirmed attendee on one of your plans. Free includes 50
                RSVPs per calendar month, resetting on the 1st. Pro is
                unlimited.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">How far in advance can I plan?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Free schedules up to two weeks out — enough for an active
                week-to-week calendar. Pro removes the window so you can
                schedule farther ahead.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">Can a friend help me run it?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Yes. Hand off individual plans to a friend so you don't have to
                be at every one. Great for when you're traveling or just need a
                break.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">Can I switch plans later?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Yes. Upgrade or downgrade anytime from your dashboard. Upgrades
                take effect immediately; downgrades kick in at the end of your
                billing period.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">What does custom branding include?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                On the Pro plan, you can upload your own logo and set a brand
                color for your calendar page — so it feels like yours, not
                Leaf's.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-6">
            Stop being the group chat planner.
            <br />
            <span className="italic">Start a calendar.</span>
          </h2>
          <p className="text-zinc-500 text-lg font-light mb-10 max-w-lg mx-auto">
            Type a vibe and watch your first calendar build in seconds. Sign up only when you want to keep it.
          </p>
          <Link
            href={isLoggedIn ? "/dashboard" : "/organizations/setup"}
            className="inline-flex bg-zinc-900 text-white px-10 py-4 text-base font-semibold rounded-full hover:bg-zinc-800 transition-colors items-center gap-2"
          >
            {isLoggedIn ? "Dashboard" : "Start your calendar"} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src="/leaf-logo-black.png" alt="Leaf" className="h-7" />
              <span className="text-lg font-light tracking-wider uppercase">OS</span>
            </div>
            <p className="text-zinc-400 text-sm font-light max-w-xs leading-relaxed">
              AI-powered calendars for the friends who do the planning.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-4">
              <h5 className="text-xs tracking-wider uppercase font-bold text-zinc-900">
                Platform
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <Link href="/about" className="hover:text-zinc-900">
                  About
                </Link>
                <Link href="/personal" className="hover:text-zinc-900">
                  For individuals
                </Link>
                <Link href="/organizations" className="hover:text-zinc-900">
                  For organizations
                </Link>
                <a href="#pricing" className="hover:text-zinc-900">
                  Pricing
                </a>
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-xs tracking-wider uppercase font-bold text-zinc-900">
                Legal
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <Link href="/privacy-policy" className="hover:text-zinc-900">
                  Privacy
                </Link>
                <Link href="/safety" className="hover:text-zinc-900">
                  Safety
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
