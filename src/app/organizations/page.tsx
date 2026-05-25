"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
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

const PRICING_TIERS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: "Free",
    yearlyPrice: "Free",
    monthlyPeriod: "",
    yearlyPeriod: "",
    description: "For the casual host",
    cta: "Get Started Free",
    highlight: false,
    features: [
      "1 calendar",
      "5 AI plan ideas per week",
      "Up to 50 RSVPs",
      "Web chat for attendees",
      "Automated follower notifications",
      "Attendance reporting",
      "Photo collection",
      "Access to local events database",
    ],
    excluded: [
      "Custom plan idea preferences",
      "Analytics",
    ],
  },
  {
    id: "growth",
    name: "The Social",
    monthlyPrice: "$4.99",
    yearlyPrice: "$49.99",
    monthlyPeriod: "/mo",
    yearlyPeriod: "/yr",
    yearlySavings: "Save 17%",
    description: "For the individual connector who wants more control and a premium look",
    cta: "Start with The Social",
    highlight: true,
    features: [
      "1 calendar",
      "10 AI plan ideas per week",
      "Unlimited RSVPs",
      "Web chat for attendees",
      "Automated follower notifications",
      "Attendance reporting",
      "Photo collection",
      "Access to local events database",
      "Unlimited scheduling",
      "Custom branding",
      "Custom plan idea preferences",
    ],
    excluded: [
      "Analytics",
    ],
  },
  {
    id: "pro",
    name: "The Organizer",
    monthlyPrice: "$9.99",
    yearlyPrice: "$99.99",
    monthlyPeriod: "/mo",
    yearlyPeriod: "/yr",
    yearlySavings: "Save 17%",
    description: "For building a brand, managing co-hosts, and scaling your community",
    cta: "Start with The Organizer",
    highlight: false,
    features: [
      "5 calendars",
      "15 AI plan ideas per week",
      "Unlimited RSVPs",
      "Web chat for attendees",
      "Automated follower notifications",
      "Attendance reporting",
      "Photo collection",
      "Access to local events database",
      "Unlimited scheduling",
      "Custom branding",
      "Advanced plan idea preferences",
      "Analytics dashboard",
    ],
    excluded: [],
  },
];

const STEPS = [
  {
    number: "01",
    icon: <Sparkles className="w-6 h-6" />,
    title: "Describe your organization",
    description:
      "Tell us your type, vibe, location, and preferences. We handle the rest.",
  },
  {
    number: "02",
    icon: <Zap className="w-6 h-6" />,
    title: "AI creates personalized plan ideas",
    description:
      "Every week, Leaf generates curated event ideas with real venues, times, and images tailored to your community.",
  },
  {
    number: "03",
    icon: <Users className="w-6 h-6" />,
    title: "Members host, people RSVP",
    description:
      "Organization members claim plan ideas and host them. Anyone can RSVP with just a phone number.",
  },
];

const FEATURES = [
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: "AI-Powered Plan Ideas",
    description:
      "Curated event suggestions based on your org's vibe, location, and preferences. Real venues, smart timing, beautiful images.",
  },
  {
    icon: <Calendar className="w-5 h-5" />,
    title: "Branded Calendar Page",
    description:
      "A beautiful public page for your organization. Share the link and let people discover what's happening.",
  },
  {
    icon: <Phone className="w-5 h-5" />,
    title: "Phone Number RSVP",
    description:
      "No app download required. People sign up with just their phone number and get SMS confirmations.",
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Member Hosting",
    description:
      "Organization members browse plan ideas and host events on behalf of your community. Distributed leadership.",
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Full Control",
    description:
      "Blacklist event types, set capacity limits, choose days of the week, and control how many events run at once.",
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    title: "Analytics",
    description:
      "Track RSVPs, follower growth, and event attendance. Understand what resonates with your community.",
  },
];

export default function OrganizationsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    const currentUser = Parse.User.current();
    setIsLoggedIn(!!currentUser);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero with background video */}
      <section className="relative h-[100vh] min-h-[600px] overflow-hidden">
        {/* Background video/image */}
        <div className="absolute inset-0 bg-zinc-900">
          <video
            className="w-full h-full object-cover opacity-50 scale-105"
            src="/hero-video.mp4"
            autoPlay
            muted
            loop
            playsInline
            poster="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=2000"
          />
        </div>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/80 z-10" />

        {/* Nav overlay */}
        <nav className="absolute top-0 left-0 right-0 z-30 px-6 py-6">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <Link href="/" className="flex items-center gap-3">
              <img src="/leaf-logo-white.svg" alt="Leaf" className="h-8" />
              <span className="text-xl font-light tracking-wider uppercase text-white">OS</span>
            </Link>
            <div className="flex gap-6 items-center">
              <a
                href="#pricing"
                className="text-sm font-medium text-white/70 hover:text-white transition-colors hidden sm:block"
              >
                Pricing
              </a>
              {!isLoggedIn && (
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-white/70 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
              )}
              <Link
                href={isLoggedIn ? "/dashboard" : "/organizations/setup"}
                className="bg-white text-zinc-900 px-5 py-2.5 text-sm font-semibold rounded-full hover:bg-white/90 transition-colors"
              >
                {isLoggedIn ? "Dashboard" : "Get Started"}
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-20 h-full flex items-center">
          <div className="max-w-6xl mx-auto px-6 w-full">
            <div className="max-w-3xl space-y-8">
              <h1 className="text-5xl md:text-7xl font-light tracking-tight leading-[1.05] text-white">
                Community activated,{" "}
                <span className="italic">by its members.</span>
              </h1>
              <p className="text-xl text-white/70 font-light leading-relaxed max-w-xl">
                Leaf generates personalized event ideas for your organization.
                Members host plans, people RSVP with just a phone number. No app
                required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  href={isLoggedIn ? "/dashboard" : "/organizations/setup"}
                  className="bg-white text-zinc-900 px-8 py-4 text-base font-semibold rounded-full hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                >
                  {isLoggedIn ? "Dashboard" : "Get started free"} <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="border border-white/30 text-white px-8 py-4 text-base font-medium rounded-full hover:bg-white/10 transition-colors text-center"
                >
                  See how it works
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-zinc-50 py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-20">
            <p className="text-xs tracking-wider uppercase text-zinc-500 font-semibold mb-3">
              How It Works
            </p>
            <h2 className="text-4xl font-light tracking-tight italic">
              A thriving community, starts with a living calendar
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
              Built for real community building
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
            <h2 className="text-4xl font-light tracking-tight italic mb-8">
              Start free, grow when ready
            </h2>
            {/* Billing period toggle */}
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
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
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
              <h3 className="text-sm font-bold mb-1">What are AI plan ideas?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Every week, Leaf automatically generates personalized event ideas for your calendar based on your location, vibe, and preferences. These include real venues, smart timing, and images — ready for you or your members to host.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">What is the events database?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                The events database gives you access to local events happening in your area. Browse concerts, shows, festivals, and more — then turn them into plans for your community with one tap.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">Can I switch plans later?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Yes. You can upgrade or downgrade at any time from your dashboard. If you upgrade, you'll be charged the new rate immediately. If you downgrade, your current plan stays active until the end of the billing period.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">What counts as an RSVP?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                An RSVP is counted each time someone confirms attendance to one of your plans. On the Starter plan, you get up to 50 RSVPs total. Growth and Organizer plans have unlimited RSVPs.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">Do my members need to download the app?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                No. Anyone can RSVP to your plans with just their phone number — no app download required. They'll receive SMS confirmations and reminders automatically.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-bold mb-1">What does custom branding include?</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                On Growth and Organizer plans, you can upload your own logo and set a brand color for your calendar page. This replaces the default Leaf branding so your community sees your identity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-6">
            Ready to bring your community
            <br />
            <span className="italic">together?</span>
          </h2>
          <p className="text-zinc-500 text-lg font-light mb-10 max-w-lg mx-auto">
            Set up your organization calendar in minutes. Your first plan ideas
            are generated instantly.
          </p>
          <Link
            href={isLoggedIn ? "/dashboard" : "/organizations/setup"}
            className="inline-flex bg-zinc-900 text-white px-10 py-4 text-base font-semibold rounded-full hover:bg-zinc-800 transition-colors items-center gap-2"
          >
            {isLoggedIn ? "Dashboard" : "Get started free"} <ArrowRight className="w-4 h-4" />
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
              AI-powered community calendars that help organizations plan
              meaningful gatherings.
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
                <Link href="/organizations" className="hover:text-zinc-900">
                  Organizations
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
                <Link href="/privacy" className="hover:text-zinc-900">
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
