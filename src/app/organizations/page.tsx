import Link from "next/link";
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
    name: "Starter",
    price: "Free",
    period: "",
    description: "Try it out with your community",
    cta: "Get Started Free",
    highlight: false,
    features: [
      "1 city",
      "5 AI plan ideas per week",
      "First 50 RSVPs free",
      "Leaf-branded calendar page",
      "Phone Number RSVP",
    ],
    excluded: [
      "Blacklist categories",
      "Day-of-week preferences",
      "Capacity constraints",
      "Max events control",
      "Location type preferences",
      "Analytics",
      "On-demand generation",
    ],
  },
  {
    name: "Growth",
    price: "$29",
    period: "/mo",
    description: "For active single-location organizations",
    cta: "Start with Growth",
    highlight: true,
    features: [
      "1 city",
      "10 AI plan ideas per week",
      "Up to 500 RSVPs per month",
      "Custom branded page",
      "Phone Number RSVP",
      "Blacklist categories",
      "Day-of-week preferences",
      "Capacity constraints",
      "Max events control",
    ],
    excluded: [
      "Location type preferences",
      "Analytics",
      "On-demand generation",
    ],
  },
  {
    name: "Pro",
    price: "$99",
    period: "/mo",
    description: "For multi-location organizations",
    cta: "Start with Pro",
    highlight: false,
    features: [
      "Up to 5 cities",
      "15 AI plan ideas per week",
      "Unlimited RSVPs",
      "Custom branded page",
      "Phone Number RSVP",
      "Blacklist categories",
      "Day-of-week preferences",
      "Capacity constraints",
      "Max events control",
      "Location type preferences per city",
      "Analytics dashboard",
      "On-demand plan generation",
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
              <span className="text-xl font-light tracking-[0.2em] uppercase text-white">OS</span>
            </Link>
            <div className="flex gap-6 items-center">
              <a
                href="#pricing"
                className="text-[10px] tracking-[0.3em] uppercase font-bold text-white/60 hover:text-white transition-colors hidden sm:block"
              >
                Pricing
              </a>
              <Link
                href="/organizations/setup"
                className="bg-white text-zinc-900 px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-white/90 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero content */}
        <div className="relative z-20 h-full flex items-center">
          <div className="max-w-6xl mx-auto px-6 w-full">
            <div className="max-w-3xl space-y-8">
              <h1 className="text-5xl md:text-7xl font-light tracking-tight leading-[1.05] text-white">
                Your community,{" "}
                <span className="italic">fully activated.</span>
              </h1>
              <p className="text-xl text-white/70 font-light leading-relaxed max-w-xl">
                Leaf generates personalized event ideas for your organization.
                Members host plans, people RSVP with just a phone number. No app
                required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  href="/organizations/setup"
                  className="bg-white text-zinc-900 px-8 py-4 text-xs uppercase tracking-[0.3em] font-medium hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
                >
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#how-it-works"
                  className="border border-white/30 text-white px-8 py-4 text-xs uppercase tracking-[0.3em] font-medium hover:bg-white/10 transition-colors text-center"
                >
                  See How It Works
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
            <p className="text-[10px] tracking-[0.4em] uppercase text-zinc-400 font-bold mb-4">
              How It Works
            </p>
            <h2 className="text-4xl font-light tracking-tight italic">
              Three steps to a thriving calendar
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-16">
            {STEPS.map((step) => (
              <div key={step.number} className="space-y-6">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-300">
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
            <p className="text-[10px] tracking-[0.4em] uppercase text-zinc-400 font-bold mb-4">
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
          <div className="mb-20 text-center">
            <p className="text-[10px] tracking-[0.4em] uppercase text-zinc-400 font-bold mb-4">
              Pricing
            </p>
            <h2 className="text-4xl font-light tracking-tight italic">
              Start free, grow when ready
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`bg-white p-8 flex flex-col ${
                  tier.highlight
                    ? "ring-2 ring-zinc-900 relative"
                    : "border border-zinc-200"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-8 bg-zinc-900 text-white px-4 py-1 text-[10px] tracking-[0.2em] uppercase font-bold">
                    Most Popular
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-400 mb-4">
                    {tier.name}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-light tracking-tight">
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span className="text-zinc-400 text-sm">
                        {tier.period}
                      </span>
                    )}
                  </div>
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
                  href={`/organizations/setup?tier=${tier.name.toLowerCase()}`}
                  className={`w-full py-3.5 text-xs uppercase tracking-[0.2em] font-bold text-center flex items-center justify-center gap-2 transition-colors ${
                    tier.highlight
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : "border border-zinc-200 text-zinc-900 hover:bg-zinc-50"
                  }`}
                >
                  {tier.cta} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
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
            href="/organizations/setup"
            className="inline-flex bg-zinc-900 text-white px-10 py-4 text-xs uppercase tracking-[0.3em] font-medium hover:bg-zinc-800 transition-colors items-center gap-2"
          >
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src="/leaf-logo-black.png" alt="Leaf" className="h-7" />
              <span className="text-lg font-light tracking-[0.2em] uppercase">OS</span>
            </div>
            <p className="text-zinc-400 text-sm font-light max-w-xs leading-relaxed">
              AI-powered community calendars that help organizations plan
              meaningful gatherings.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-4">
              <h5 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-900">
                Platform
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <Link href="/organizations" className="hover:text-zinc-900">
                  Organizations
                </Link>
                <a href="#pricing" className="hover:text-zinc-900">
                  Pricing
                </a>
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-[10px] tracking-[0.3em] uppercase font-bold text-zinc-900">
                Legal
              </h5>
              <div className="flex flex-col gap-2 text-sm text-zinc-500 mt-4">
                <a href="#" className="hover:text-zinc-900">
                  Privacy
                </a>
                <a href="#" className="hover:text-zinc-900">
                  Terms
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
