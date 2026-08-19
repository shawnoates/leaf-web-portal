"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight } from "lucide-react";
import {
  pickSeeds,
  SEED_POOL,
  type SeedCalendar,
} from "@/lib/aiCalendarSeed";
import { useDetectedCity } from "@/lib/useDetectedCity";

// /personal hero — Direction B (prompt over atmosphere).
//
// Video background stays. The old "The easiest way to bring your people
// together" marketing hero is replaced by the prompt-first surface so
// the visitor's first action IS trying the generator, no scroll
// required. Chips route straight to /cal/<slug> (no inline preview);
// freeform text routes to /calendars?q=<...>.
//
// Analytics — same events the earlier "Try it" section fired, so the
// funnel dashboard doesn't need a rename.

function trackPersonalGen(
  event:
    | "prompt_typed"
    | "prompt_submitted"
    | "generation_completed"
    | "adopt_clicked",
  detail?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    dataLayer?: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  w.dataLayer.push({ event: `personal_gen_${event}`, ...(detail || {}) });
}

export default function PersonalHero({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();

  // Deterministic first paint (SSR = client) then shuffle after mount.
  // Same "safe randomness" pattern as before to avoid React error #418.
  const [chips, setChips] = useState<SeedCalendar[]>(() => SEED_POOL.slice(0, 3));
  useEffect(() => {
    setChips(pickSeeds(3));
  }, []);

  // Regionalized copy — SSR renders the fallback ("your neighborhood"),
  // client hydrates with the visitor's timezone-derived city so a
  // Chicago visitor sees "Wicker Park" not "Fort Greene".
  const [city, setCity] = useState<DetectedCity>({
    city: "your area",
    neighborhoods: ["your neighborhood", "your side of town"],
    fallback: true,
    lat: null,
    lng: null,
    promptChips: [],
  });
  useEffect(() => {
    setCity(detectCity());
  }, []);
  const heroPlaceholder = `Try "date night in ${city.neighborhoods[0]}" or "Thursday happy hours"`;

  const [typed, setTyped] = useState("");
  const [promptTypedFired, setPromptTypedFired] = useState(false);
  const isTyping = typed.trim().length > 0;

  function handleTyping(value: string) {
    setTyped(value);
    if (!promptTypedFired && value.trim().length > 0) {
      trackPersonalGen("prompt_typed");
      setPromptTypedFired(true);
    }
  }

  function handleFreeformSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isTyping) return;
    trackPersonalGen("prompt_submitted", { prompt: typed.trim() });
    router.push(`/calendars?q=${encodeURIComponent(typed.trim())}`);
  }

  function handleChipTap(cal: SeedCalendar) {
    trackPersonalGen("generation_completed", {
      source: "chip",
      slug: cal.slug,
    });
    router.push(`/cal/${cal.slug}`);
  }

  // Regionalized prompt chips fire the generator with the visitor's
  // detected city — a Chicago visitor tapping "Date night in Wicker
  // Park" ends up on /calendars?q=... which passes originCity through
  // to the server and returns a Chicago calendar. NYC visitors fall
  // back to the SEED_POOL chips (their curated Brooklyn cards) so the
  // gallery cards get eyeballs.
  function handlePromptChipTap(prompt: string) {
    trackPersonalGen("prompt_submitted", { prompt, source: "regional_chip" });
    router.push(`/calendars?q=${encodeURIComponent(prompt)}`);
  }
  const useRegionalChips = !city.fallback && city.promptChips.length > 0 && city.city !== "NYC";

  return (
    <section
      className="relative overflow-hidden bg-zinc-900"
      style={{ minHeight: "720px", height: "100vh" }}
    >
      {/* Video background */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <video
          className="w-full h-full object-cover opacity-60 scale-105"
          src="/hero-video.mp4"
          autoPlay
          muted
          loop
          playsInline
          poster="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&q=80&w=2000"
        />
      </div>

      {/* Legibility overlay — darker at top and bottom, softer in the
          middle where the prompt sits. Adds a subtle forest hint so
          the atmosphere feels connected to the accent color. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(15,18,16,0.72) 0%, rgba(15,18,16,0.55) 45%, rgba(15,18,16,0.78) 100%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(27,67,50,0.35), transparent 55%), radial-gradient(ellipse 90% 70% at 75% 90%, rgba(27,67,50,0.28), transparent 55%)",
        }}
      />

      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 z-30 px-6 py-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/leaf-logo-white.svg" alt="Leaf" className="h-8" />
            <span className="text-xl font-light tracking-wider uppercase text-white">
              OS
            </span>
          </Link>
          <div className="flex gap-6 items-center">
            <a
              href="#pricing"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors hidden sm:block"
            >
              Pricing
            </a>
            <Link
              href="/organizations"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors hidden sm:block"
            >
              For organizations
            </Link>
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

      {/* Hero content — centered */}
      <div className="relative z-20 h-full flex items-center justify-center px-6 py-24 md:py-32">
        <div className="max-w-2xl mx-auto w-full flex flex-col items-center gap-8 text-center">
          <h1
            className="m-0"
            style={{
              color: "#f7f5ef",
              fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
              fontWeight: 400,
              fontSize: "clamp(44px, 6vw, 74px)",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              textWrap: "balance",
            }}
          >
            Type a vibe.
            <br />
            Get a{" "}
            <em style={{ fontStyle: "italic", color: "#a7bfa9" }}>
              calendar
            </em>
            .
          </h1>

          <p
            className="m-0 leading-relaxed max-w-[52ch]"
            style={{
              color: "rgba(247,245,239,0.72)",
              fontSize: "clamp(15px, 1.4vw, 18px)",
              lineHeight: 1.55,
            }}
          >
            Not a list of ideas — real places near you, on real dates.
            Change anything, share the link, and friends RSVP with a tap.
          </p>

          <form
            onSubmit={handleFreeformSubmit}
            autoComplete="off"
            className="flex items-center gap-2 rounded-full pl-6 pr-2 py-2 w-full max-w-xl"
            style={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(255,255,255,0.4)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow:
                "0 12px 40px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <input
              type="search"
              name="calendar-prompt"
              value={typed}
              onChange={(e) => handleTyping(e.target.value)}
              placeholder={heroPlaceholder}
              aria-label="Describe a vibe"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              className="flex-1 border-0 outline-none bg-transparent py-2.5 text-base min-w-0 hero-prompt-input"
              style={{ color: "#131714" }}
            />
            {/* Suppress the browser's native type="search" X — we want
                the input to stay clean while typing; the Generate
                button on the right IS the primary affordance, an X
                next to it competes with the CTA visually. */}
            <style jsx>{`
              .hero-prompt-input::-webkit-search-cancel-button,
              .hero-prompt-input::-webkit-search-decoration {
                -webkit-appearance: none;
                appearance: none;
                display: none;
              }
            `}</style>
            <button
              type="submit"
              disabled={!isTyping}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors disabled:cursor-default"
              style={{
                background: isTyping ? "#131714" : "#d4d4d8",
                color: "#ffffff",
              }}
            >
              Generate
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-2 max-w-xl">
            {useRegionalChips
              ? city.promptChips.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handlePromptChipTap(prompt)}
                    className="rounded-full px-4 py-2 text-sm font-medium transition-all hover:-translate-y-0.5"
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      color: "rgba(247,245,239,0.92)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                    }}
                  >
                    {prompt}
                  </button>
                ))
              : chips.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => handleChipTap(c)}
                    className="rounded-full px-4 py-2 text-sm font-medium transition-all hover:-translate-y-0.5"
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      color: "rgba(247,245,239,0.92)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                    }}
                  >
                    {c.chipLabel}
                  </button>
                ))}
          </div>

          <p
            className="m-0 text-xs"
            style={{
              color: "rgba(247,245,239,0.55)",
              letterSpacing: "0.02em",
            }}
          >
            Free to try — sign up only when you want to keep it.
          </p>
        </div>
      </div>

      {/* Below-fold hint */}
      <a
        href="#how-it-works"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 inline-flex flex-col items-center gap-1.5 text-xs transition-opacity hover:opacity-100"
        style={{
          color: "rgba(247,245,239,0.65)",
          letterSpacing: "0.02em",
        }}
      >
        <span>See how it works</span>
        <ArrowDown className="w-3 h-3" />
      </a>
    </section>
  );
}
