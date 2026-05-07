import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "About — Leaf",
  description:
    "Leaf exists to help communities show up for one another in person. We build the tools that turn everyday moments into meaningful gatherings.",
};

// Curated Unsplash photos of people gathered in community.
// All images are linked from images.unsplash.com — no API key required.
const HERO_IMAGE =
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=2000&q=80";

const GALLERY = [
  {
    src: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=900&q=80",
    alt: "Friends laughing around a table",
  },
  {
    src: "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=900&q=80",
    alt: "Group of friends sharing a moment outdoors",
  },
  {
    src: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=900&q=80",
    alt: "Community gathering with people talking and smiling",
  },
  {
    src: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=900&q=80",
    alt: "Friends laughing together at sunset",
  },
  {
    src: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=80",
    alt: "People gathered in a warm community space",
  },
  {
    src: "https://images.unsplash.com/photo-1491438590914-bc09fcaaf77a?auto=format&fit=crop&w=900&q=80",
    alt: "Group of friends celebrating together",
  },
];

const VALUES = [
  {
    label: "Gather",
    title: "Bring people into the same room",
    body: "Real connection happens shoulder to shoulder, not screen to screen. We design Leaf to lower the friction between thinking about getting together and actually showing up.",
  },
  {
    label: "Belong",
    title: "Build a place where everyone fits",
    body: "Belonging is what turns a crowd into a community. Every plan, every RSVP, every recurring Saturday morning ritual is a small invitation that says: we noticed you, we saved you a seat.",
  },
  {
    label: "Show Up",
    title: "Consistency is the whole game",
    body: "The best communities aren't built from grand events — they're built from people who keep showing up. Leaf makes the showing-up part simple, so the people who lead can focus on the people who come.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-100 py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-3 hover:opacity-70 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/leaf-logo-black.png" alt="Leaf" className="h-7" />
            <span className="text-lg font-light tracking-wider uppercase">
              OS
            </span>
          </Link>
          <nav className="flex items-center gap-8">
            <Link
              href="/organizations"
              className="text-xs tracking-wider uppercase text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Organizations
            </Link>
            <Link
              href="/organizations/setup"
              className="text-xs tracking-wider uppercase font-bold bg-zinc-900 text-white px-5 py-2.5 hover:bg-zinc-800 transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="relative h-[70vh] min-h-[480px] w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMAGE}
            alt="A community of friends laughing together"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative z-10 h-full flex items-end">
            <div className="max-w-6xl mx-auto px-6 pb-16 md:pb-24 w-full">
              <p className="text-xs tracking-wider uppercase text-white/80 mb-4">
                About Leaf
              </p>
              <h1 className="text-5xl md:text-7xl font-light tracking-tight text-white max-w-3xl leading-[1.05]">
                We believe in showing up for each other.
              </h1>
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <p className="text-xs tracking-wider uppercase text-zinc-400">
            Our Story
          </p>
          <h2 className="text-3xl md:text-4xl font-light tracking-tight leading-tight">
            Leaf started with a simple question — what would it take to make
            community feel easy again?
          </h2>
          <div className="space-y-6 text-lg text-zinc-600 font-light leading-relaxed">
            <p>
              We watched friends get busier, neighborhoods get quieter, and
              calendars get fuller with everything except the things that
              matter most. We watched community organizers — pastors, gym
              owners, club leaders, founders — burn out trying to keep their
              people together.
            </p>
            <p>
              We built Leaf because we believe the people who lead communities
              deserve better tools, and the people who show up to them deserve
              easier ways to belong. Our calendars do the planning so leaders
              can focus on the part only they can do: caring for people in
              person.
            </p>
            <p>
              We&apos;re a small team. We&apos;re building Leaf for the church
              in Brooklyn, the run club in Austin, the moms&apos; group in
              Portland, the founders meetup in Miami — and for everyone who&apos;s
              ever wished gathering felt a little less like work.
            </p>
          </div>
        </div>
      </section>

      {/* Values — three pillars */}
      <section className="py-24 px-6 bg-zinc-50/60 border-y border-zinc-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <p className="text-xs tracking-wider uppercase text-zinc-400">
              What We Believe
            </p>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight">
              Three things we hold to.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {VALUES.map((v) => (
              <div key={v.label} className="space-y-4">
                <p className="text-xs tracking-wider uppercase font-bold text-zinc-900">
                  {v.label}
                </p>
                <h3 className="text-2xl font-light tracking-tight leading-snug">
                  {v.title}
                </h3>
                <p className="text-zinc-500 font-light leading-relaxed">
                  {v.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo gallery — community in action */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <p className="text-xs tracking-wider uppercase text-zinc-400">
              Community
            </p>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight max-w-2xl mx-auto leading-tight">
              The kind of gatherings we&apos;re here to make easier.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {GALLERY.map((photo, i) => (
              <div
                key={i}
                className={`relative overflow-hidden bg-zinc-100 ${
                  i === 0 || i === 5 ? "md:row-span-2 aspect-square md:aspect-[3/4]" : "aspect-square"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-24 md:py-32 px-6 bg-zinc-900 text-white">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <p className="text-xs tracking-wider uppercase text-zinc-400">
            Start Your Community
          </p>
          <h2 className="text-4xl md:text-5xl font-light tracking-tight leading-tight">
            Your community deserves a place to come together.
          </h2>
          <p className="text-lg text-zinc-400 font-light max-w-xl mx-auto leading-relaxed">
            Leaf gives you an AI-powered calendar that helps your people show
            up — without spending your week chasing logistics.
          </p>
          <div className="pt-4">
            <Link
              href="/organizations/setup"
              className="inline-flex items-center gap-2 bg-white text-zinc-900 px-8 py-4 text-xs uppercase tracking-wider font-bold hover:bg-zinc-100 transition-colors"
            >
              Create Your Calendar <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/leaf-logo-black.png" alt="Leaf" className="h-7" />
              <span className="text-lg font-light tracking-wider uppercase">
                OS
              </span>
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
