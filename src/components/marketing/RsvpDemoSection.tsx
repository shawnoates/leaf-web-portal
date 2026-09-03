"use client";

import { useEffect, useRef, useState } from "react";
import { makeClientValue } from "./useClientValue";
import { DEMO_VENUE_PHOTOS, PHOTO_FILTER } from "./photos";

// "How RSVPs work" — the forest band. Rows fade up in sequence when the
// section enters the viewport, then an RSVP toast loops over the card.
//
// Dates are computed from today (the next three Thursdays) so the demo
// never goes stale. Venue thumbs are Unsplash stand-ins for the subject
// (a wine bar, a rooftop, a raw bar) rather than photographs of the
// named venues, so they carry no alt text — they're decoration inside a
// product demo, and describing them as those businesses would be a
// claim the picture can't support.

const TOAST_NAMES = [
  { name: "Jordan", initial: "J" },
  { name: "Priya", initial: "P" },
  { name: "Marcus", initial: "M" },
];

const ROWS = [
  { title: "Natural wine at Ops", time: "6:30pm", area: "Fort Greene", going: 7 },
  { title: "Rooftop at The Tillary", time: "6:00pm", area: "Downtown BK", going: 4 },
  { title: "Oysters at Maison Premiere", time: "7:00pm", area: "Williamsburg", going: 2 },
];

/** The next `count` Thursdays after today, formatted "Thu Sep 4". */
function nextThursdays(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  // 4 = Thursday. Always step at least one day forward so "today is
  // Thursday" doesn't render a date that is already half over.
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== 4);
  for (let i = 0; i < count; i++) {
    // "Thu Sep 4" — en-US would render "Thu, Sep 4"; the comma isn't in
    // the spec's row format and reads heavy at 13px.
    out.push(
      d
        .toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
        .replace(",", "")
    );
    d.setDate(d.getDate() + 7);
  }
  return out;
}

// Both are client-only reads: the dates depend on today (SSR rendering
// them would mismatch across midnight) and the media query has no server
// answer. Cached per page load rather than set from an effect.
const demoDates = makeClientValue<string[] | null>(() => nextThursdays(3), null);
const prefersReducedMotion = makeClientValue(
  () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  false
);

export default function RsvpDemoSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [loop, setLoop] = useState(0);
  const dates = demoDates.use();
  const reduceMotion = prefersReducedMotion.use();

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || started) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  // Advance the toast identity each loop, and bump the first row's count
  // in step with it. Resets after three loops so the number stays
  // plausible rather than climbing forever.
  useEffect(() => {
    if (!started || reduceMotion) return;
    const t = window.setInterval(() => setLoop((n) => (n + 1) % 3), 6000);
    return () => window.clearInterval(t);
  }, [started, reduceMotion]);

  const toast = TOAST_NAMES[loop % TOAST_NAMES.length];
  const anim = (delayMs: number) =>
    started && !reduceMotion
      ? { animation: `mktFadeUp .5s ${delayMs}ms ease-out both` }
      : {};

  return (
    <section
      ref={sectionRef}
      className="px-5 py-12 sm:px-12 sm:py-24"
      style={{ background: "var(--mkt-forest)", color: "#fff" }}
    >
      <div className="mx-auto grid max-w-[1440px] items-center gap-8 lg:grid-cols-2 lg:gap-[72px]">
        <div className="flex flex-col gap-4 sm:gap-[18px]">
          <div className="mkt-eyebrow" style={{ color: "rgba(255,255,255,.55)" }}>
            How RSVPs work
          </div>
          <h2
            className="m-0"
            style={{
              fontSize: "clamp(30px, 3.1vw, 44px)",
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              fontWeight: 400,
            }}
          >
            Friends tap in with a phone number.{" "}
            <em
              className="mkt-serif italic"
              style={{ fontSize: "1.14em", color: "var(--mkt-green-light)" }}
            >
              That&rsquo;s it.
            </em>
          </h2>
          <p
            className="m-0 max-w-[480px] text-[15px] leading-[1.6] sm:text-[17px]"
            style={{ opacity: 0.75, textWrap: "pretty" }}
          >
            No downloads, no accounts. SMS confirmations and reminders go out on
            their own. You see who&rsquo;s coming and who actually showed.
          </p>
        </div>

        <div className="relative pb-5 lg:pb-6 lg:pr-6">
          <div
            className="flex flex-col gap-2.5 rounded-2xl bg-white p-4 sm:gap-3 sm:rounded-[20px] sm:p-[22px]"
            style={{
              color: "var(--mkt-ink)",
              boxShadow: "0 30px 80px rgba(0,0,0,.35)",
            }}
          >
            <div className="flex items-baseline justify-between">
              <div className="mkt-serif italic text-[19px] sm:text-[24px]">
                Thursday happy hours
              </div>
              <div
                className="hidden text-[12.5px] sm:block"
                style={{ color: "var(--mkt-ink-3)" }}
              >
                leaf.so/maya
              </div>
            </div>

            {ROWS.map((row, i) => {
              // Third row is desktop-only (spec: mobile card shows 2).
              const going =
                i === 0 && started && !reduceMotion ? row.going + loop : row.going;
              return (
                <div
                  key={row.title}
                  className={`flex items-center gap-2.5 rounded-[10px] p-2.5 sm:gap-3.5 sm:rounded-xl sm:p-3 ${
                    i === 2 ? "hidden sm:flex" : ""
                  }`}
                  style={{
                    background: "var(--mkt-bg-tile)",
                    ...anim(i * 500),
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={DEMO_VENUE_PHOTOS[i].url}
                    alt=""
                    loading="lazy"
                    className="shrink-0 rounded-md object-cover sm:rounded-lg"
                    style={{
                      width: 44,
                      height: 44,
                      filter: PHOTO_FILTER,
                      background: "linear-gradient(135deg,#dcdad3,#e6e4de)",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold sm:text-[15px]">
                      {row.title}
                    </div>
                    <div
                      className="text-[11px] sm:text-[13px]"
                      style={{ color: "var(--mkt-ink-3)" }}
                    >
                      {dates ? `${dates[i]} · ` : ""}
                      {row.time}
                      <span className="hidden sm:inline"> · {row.area}</span>
                    </div>
                  </div>
                  <div
                    className="text-[11px] font-semibold sm:text-[13px]"
                    style={{ color: "var(--mkt-green)" }}
                  >
                    {going} going
                  </div>
                </div>
              );
            })}
          </div>

          {/* RSVP toast — spans the card on mobile, tucks bottom-right on
              desktop, overlapping the card by ~24px. */}
          <div
            className="absolute bottom-0 left-3 right-3 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 sm:gap-3 lg:left-auto lg:right-0 lg:rounded-[14px] lg:px-4 lg:py-3"
            style={{
              background: "var(--mkt-ink)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,.12)",
              boxShadow: "0 14px 40px rgba(0,0,0,.4)",
              ...(started && !reduceMotion
                ? { animation: "mktToastPop 6s 1.8s infinite both" }
                : {}),
            }}
          >
            <span
              className="flex shrink-0 items-center justify-center rounded-full text-[12px] font-bold sm:text-[14px]"
              style={{
                width: 28,
                height: 28,
                background: "var(--mkt-green-avatar)",
                color: "var(--mkt-ink)",
              }}
            >
              {toast.initial}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold sm:text-[14px]">
                {toast.name} RSVP&rsquo;d
              </div>
              <div
                className="truncate text-[11px] sm:text-[12.5px]"
                style={{ opacity: 0.7 }}
              >
                via text · Natural wine at Ops
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
