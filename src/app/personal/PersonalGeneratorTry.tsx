"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

// Phase 1 "try it" entry to the AI calendar generator. Sits below the
// video hero on /personal. Design intent + interaction states are
// documented in the paired mockup artifact — three surfaces:
//
//   idle          → prompt bar + 3 rotated chips, no LLM call
//   chip preview  → cached calendar rendered inline (real venues, no
//                   generation cost). "Make it yours" opens the adopt
//                   flow.
//   typing        → freeform prompt in bar; submit routes to
//                   /calendars?q=... where full generation happens
//                   with skeletons / streaming / retries.
//
// Everything below is stubbed: the seed pool is static, the sign-in
// modal is a route push, and generation is a route push. Phase 1 wires
// these to real backends; Phase 5 wires the seed calendars to
// getWeeklyPlanRecommendation as `signalSources: "public_calendar_seed"`.

interface SeededEvent {
  tag: string;
  tagVariant?: "default" | "amber";
  name: string;
  time: string;
  venueLine: string;
}

interface SeededCalendar {
  slug: string;
  chipLabel: string;
  previewKicker: string;
  previewTitle: string;
  sourceName: string;
  adoptionCount: number;
  events: SeededEvent[];
}

// Seed pool. Production pulls from a cached-calendar table; today
// this is hand-curated so /personal always has something to show
// before the gallery is populated (cold-start plan from the spec).
const SEED_POOL: SeededCalendar[] = [
  {
    slug: "family-fun-this-month",
    chipLabel: "Family fun this month",
    previewKicker: "Preview · 4 weekends",
    previewTitle: "Family fun · Brooklyn",
    sourceName: "Brooklyn Parents Group",
    adoptionCount: 147,
    events: [
      { tag: "Museum", name: "Brooklyn Children's Museum", time: "Sat · 10:30 AM", venueLine: "145 Brooklyn Ave" },
      { tag: "Outdoor", name: "Prospect Park Zoo", time: "Sun · 11:00 AM", venueLine: "450 Flatbush Ave" },
      { tag: "Workshop", name: "Powerhouse Arena Kids Story Hour", time: "Sat · 11:00 AM", venueLine: "28 Adams St" },
      { tag: "Play", tagVariant: "amber", name: "Kolo Klub", time: "Sun · 2:00 PM", venueLine: "142 Sackett St · indoor" },
    ],
  },
  {
    slug: "fort-greene-date-night",
    chipLabel: "Date night in Fort Greene",
    previewKicker: "Preview · 5 nights, 4 stops",
    previewTitle: "Fort Greene · Date night",
    sourceName: "Fort Greene Regulars",
    adoptionCount: 213,
    events: [
      { tag: "Cocktails", name: "Bar Camillo", time: "Fri · 7:30 PM", venueLine: "210 Grand Ave" },
      { tag: "Dinner", name: "Cafe Erzulie", time: "Fri · 8:30 PM", venueLine: "894 Fulton St · Haitian" },
      { tag: "Dinner", name: "Roman's", time: "Sat · 8:00 PM", venueLine: "243 DeKalb Ave · Italian, walk-in" },
      { tag: "Nightcap", tagVariant: "amber", name: "The Great Georgiana", time: "Sat · 11:00 PM", venueLine: "351 Grand Ave · Natural wine" },
    ],
  },
  {
    slug: "park-slope-thursday-happy-hours",
    chipLabel: "Thursday happy hours · Park Slope",
    previewKicker: "Preview · every Thursday",
    previewTitle: "Thursday happy hours · Park Slope",
    sourceName: "Park Slope After-Work",
    adoptionCount: 89,
    events: [
      { tag: "Beer", name: "Union Hall", time: "Thu · 5:30 PM", venueLine: "702 Union St · $6 pints" },
      { tag: "Wine", name: "Sea Witch", time: "Thu · 6:30 PM", venueLine: "703 Sackett St · $8 glasses" },
      { tag: "Cocktails", name: "Bar Toto", time: "Thu · 7:30 PM", venueLine: "411 11th St · half-off apps" },
      { tag: "Snacks", tagVariant: "amber", name: "Talde", time: "Thu · 8:30 PM", venueLine: "369 7th Ave · Asian-American" },
    ],
  },
];

// Rotate 3 chips per visit out of the pool. Deterministic per mount so
// re-renders don't shuffle mid-interaction. Production picks weighted
// by adoption_count + area match.
function pickChips(pool: SeededCalendar[]): SeededCalendar[] {
  const copy = [...pool];
  const picks: SeededCalendar[] = [];
  while (picks.length < Math.min(3, pool.length) && copy.length) {
    picks.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return picks;
}

// Analytics — thin dataLayer.push so GTM/Segment can pick up the
// /personal funnel from launch. All Phase 1 events for the generator
// hook go through this so the Part 11 guardrail is satisfied.
type PersonalGenEvent =
  | "prompt_typed"
  | "prompt_submitted"
  | "generation_completed"
  | "adopt_clicked"
  | "sign_in_from_adopt"
  | "adopted";

function trackPersonalGen(event: PersonalGenEvent, detail?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { dataLayer?: Array<Record<string, unknown>> };
  if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
  w.dataLayer.push({ event: `personal_gen_${event}`, ...(detail || {}) });
}

export default function PersonalGeneratorTry() {
  const router = useRouter();
  const chips = useMemo(() => pickChips(SEED_POOL), []);
  const [typed, setTyped] = useState("");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [promptTypedFired, setPromptTypedFired] = useState(false);

  const isTyping = typed.trim().length > 0;
  const activeCalendar =
    activeSlug ? chips.find((c) => c.slug === activeSlug) || null : null;

  function handleTyping(value: string) {
    setTyped(value);
    // Fire prompt_typed once per session-of-typing so the funnel counts
    // people who *engaged* with the input, not every keystroke.
    if (!promptTypedFired && value.trim().length > 0) {
      trackPersonalGen("prompt_typed");
      setPromptTypedFired(true);
    }
  }

  function handleFreeformSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!typed.trim()) return;
    trackPersonalGen("prompt_submitted", { prompt: typed.trim() });
    router.push(`/calendars?q=${encodeURIComponent(typed.trim())}`);
  }

  function handleChipTap(cal: SeededCalendar) {
    setActiveSlug(cal.slug);
    // Chip taps count as generation_completed since the cached calendar
    // is the "generated" artifact — no LLM ran but the visitor got the
    // same outcome (a real calendar to consider).
    trackPersonalGen("generation_completed", {
      source: "chip",
      slug: cal.slug,
    });
  }

  function handleAdopt() {
    if (!activeCalendar) return;
    trackPersonalGen("adopt_clicked", { slug: activeCalendar.slug });
    // Phase 1 stub: route to sign-in with a return path that carries
    // the calendar we want to fork. The signed-in landing then calls
    // the adopt endpoint and routes to /c/<owned-slug>.
    router.push(
      `/dashboard?adoptFrom=${encodeURIComponent(activeCalendar.slug)}`
    );
  }

  return (
    <section
      id="try-it"
      className="relative py-24 md:py-28"
      style={{ background: "#FBFAF6" }}
    >
      <div className="max-w-2xl mx-auto px-6">
        <div
          className="bg-white rounded-3xl border p-8 md:p-12"
          style={{ borderColor: "#E3E5DE" }}
        >
          <div className="flex flex-col gap-6">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.18em] inline-flex items-center gap-2.5"
              style={{ color: "#1B4332" }}
            >
              <span
                className="inline-block h-px w-4"
                style={{ background: "#1B4332" }}
              />
              Try it
            </span>

            <h2
              className="font-serif font-normal leading-[1.15] tracking-tight text-balance m-0"
              style={{
                color: "#131714",
                fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                fontSize: "clamp(1.625rem, 3vw, 2.125rem)",
              }}
            >
              Type a vibe, get a{" "}
              <em className="italic" style={{ color: "#1B4332" }}>
                calendar
              </em>
              .
            </h2>

            <p
              className="text-[15px] leading-relaxed max-w-[52ch] m-0"
              style={{ color: "#6B7168" }}
            >
              Leaf builds you a starter calendar of real venues in seconds.
              Adopt it, edit it, share it with your people.
            </p>

            <form
              onSubmit={handleFreeformSubmit}
              className="flex items-center gap-2 bg-white rounded-full pl-6 pr-2 py-2 border transition-all"
              style={{
                borderColor: isTyping ? "#1B4332" : "#E3E5DE",
                boxShadow: isTyping
                  ? "0 0 0 3px rgba(27,67,50,0.08), 0 8px 24px rgba(19,23,20,0.08)"
                  : "0 1px 0 rgba(19,23,20,0.02), 0 8px 24px rgba(19,23,20,0.06)",
              }}
            >
              <input
                value={typed}
                onChange={(e) => handleTyping(e.target.value)}
                placeholder="Try “date night in Fort Greene” or “Thursday happy hours”"
                aria-label="Describe a vibe"
                className="flex-1 border-0 outline-none bg-transparent py-2.5 text-base min-w-0"
                style={{ color: "#131714" }}
              />
              <button
                type="submit"
                disabled={!isTyping}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default"
                style={{
                  background: isTyping ? "#1B4332" : "#E3E5DE",
                  color: isTyping ? "#ffffff" : "#6B7168",
                }}
              >
                {isTyping ? "See what Leaf makes" : "Generate"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.16em] mr-1"
                style={{ color: "#6B7168" }}
              >
                Or try
              </span>
              {chips.map((c) => {
                const active = c.slug === activeSlug;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => handleChipTap(c)}
                    className="rounded-full px-4 py-2 text-[13px] font-medium transition-all"
                    style={{
                      background: active ? "#1B4332" : "#E8EFE9",
                      color: active ? "#ffffff" : "#1B4332",
                      opacity: isTyping && !active ? 0.55 : 1,
                    }}
                  >
                    {c.chipLabel}
                  </button>
                );
              })}
            </div>

            {activeCalendar && (
              <div
                className="mt-2 rounded-2xl border overflow-hidden bg-white"
                style={{ borderColor: "#E3E5DE" }}
              >
                <div className="flex items-center justify-between gap-3 pt-5 px-5 pb-3">
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color: "#6B7168" }}
                    >
                      {activeCalendar.previewKicker}
                    </span>
                    <h3
                      className="m-0 text-[20px] leading-tight tracking-tight"
                      style={{
                        color: "#131714",
                        fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                        fontWeight: 400,
                      }}
                    >
                      {activeCalendar.previewTitle}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleAdopt}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors"
                    style={{ background: "#131714", color: "#ffffff" }}
                  >
                    Make it yours
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex gap-3 overflow-x-auto px-5 pb-5 pt-1 scrollbar-none">
                  {activeCalendar.events.map((ev, i) => (
                    <article
                      key={i}
                      className="rounded-xl border p-3.5 flex flex-col gap-2 shrink-0"
                      style={{
                        minWidth: 200,
                        maxWidth: 200,
                        background: "#FBFAF6",
                        borderColor: "#E3E5DE",
                      }}
                    >
                      <span
                        className="self-start text-[10px] font-bold uppercase tracking-[0.12em] rounded px-1.5 py-0.5"
                        style={{
                          background:
                            ev.tagVariant === "amber"
                              ? "rgba(200,138,59,0.14)"
                              : "#E8EFE9",
                          color:
                            ev.tagVariant === "amber" ? "#C88A3B" : "#1B4332",
                        }}
                      >
                        {ev.tag}
                      </span>
                      <h4
                        className="m-0 text-[16px] leading-tight text-balance"
                        style={{
                          color: "#131714",
                          fontFamily:
                            'ui-serif, Georgia, "Times New Roman", serif',
                          fontWeight: 400,
                        }}
                      >
                        {ev.name}
                      </h4>
                      <div
                        className="text-[12px] leading-normal flex flex-col gap-0.5"
                        style={{ color: "#6B7168" }}
                      >
                        <span
                          className="font-medium tabular-nums"
                          style={{ color: "#131714" }}
                        >
                          {ev.time}
                        </span>
                        <span>{ev.venueLine}</span>
                      </div>
                    </article>
                  ))}
                </div>

                <div
                  className="flex items-center justify-between gap-3 px-5 py-3 border-t text-[12px]"
                  style={{ borderColor: "#E3E5DE", color: "#6B7168" }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    From{" "}
                    <strong
                      className="font-semibold"
                      style={{ color: "#131714" }}
                    >
                      {activeCalendar.sourceName}
                    </strong>
                  </span>
                  <span className="tabular-nums">
                    {activeCalendar.adoptionCount} people adopted this
                  </span>
                </div>
              </div>
            )}

            <p
              className="text-[12px] text-center leading-relaxed"
              style={{ color: "#6B7168" }}
            >
              Free to try. Adopt to save it as your own.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
