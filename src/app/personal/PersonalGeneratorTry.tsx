"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { pickSeeds, type SeedCalendar } from "@/lib/aiCalendarSeed";

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
// The seed pool is shared with /calendars via @/lib/aiCalendarSeed —
// both surfaces show the same starter supply while the real
// cached-calendar table is populated.

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
  const chips = useMemo(() => pickSeeds(3), []);
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

  function handleChipTap(cal: SeedCalendar) {
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
    // Route to the calendar's detail page where the adopt CTA lives on
    // a proper surface (sign-in modal + adopt confirmation). Handling
    // it here would require an auth check inline, which duplicates
    // logic /c/<slug> already needs.
    router.push(`/cal/${activeCalendar.slug}?adopt=1`);
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
                      {activeCalendar.title}
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
