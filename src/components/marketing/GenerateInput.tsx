"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useDetectedCity } from "@/lib/useDetectedCity";
import { useGenerate } from "./useGenerate";
import type { GenerateSource } from "./analytics";

// The single primary CTA of the marketing pages. Renders as a 999px pill
// on desktop and a stacked card on mobile (spec §Mobile), because a pill
// at 390px leaves the field too narrow to read a full prompt.
//
// Placeholder rotates every 4s. The prompts are the spec's, with the
// neighbourhood swapped for the visitor's own when the edge resolves a
// non-NYC city — a Chicago visitor being told to try "Prospect Park"
// reads as a stock page, which is the one thing this design is trying
// not to be.

const ROTATION_MS = 4000;

function promptsFor(neighborhood: string | null): string[] {
  const hood = neighborhood || "Prospect Park";
  return [
    `Sunday runs in ${hood}`,
    `date night in ${neighborhood || "Fort Greene"}`,
    "Thursday happy hour",
    "Family fun this month",
  ];
}

interface Props {
  source: GenerateSource;
  /** Marks this instance as the hero field — gives it the id other
   *  surfaces scroll to and focus. Only one per page. */
  isHero?: boolean;
  /** Renders light-on-dark for use over the forest band. */
  className?: string;
}

export default function GenerateInput({ source, isHero = false, className = "" }: Props) {
  const { generate, isGenerating } = useGenerate();
  const { city } = useDetectedCity();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  // SSR renders index 0 so the server and first client paint agree;
  // rotation starts only after mount.
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const neighborhood = city.fallback ? null : city.neighborhoods[0] ?? null;
  const prompts = promptsFor(neighborhood);
  const placeholder = `Try "${prompts[index % prompts.length]}"`;

  useEffect(() => {
    if (value.trim()) return; // don't rotate under someone who is typing
    const fade = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((n) => n + 1);
        setVisible(true);
      }, 220);
    }, ROTATION_MS);
    return () => window.clearInterval(fade);
  }, [value]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Empty submit runs the prompt currently on show, so hitting Enter on
    // an untouched field still produces a calendar rather than nothing.
    const text = value.trim() || prompts[index % prompts.length];
    if (!text) {
      setError("Type a vibe to get started.");
      return;
    }
    generate(text, source);
  }

  const buttonLabel = isGenerating ? "Building…" : "Generate";

  return (
    <div className={`w-full max-w-[640px] ${className}`}>
      <form onSubmit={submit} autoComplete="off">
        {/* Mobile: stacked card. Desktop: pill. */}
        <div
          className="flex flex-col gap-2 rounded-[18px] bg-white p-3.5 sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:py-2 sm:pl-[26px] sm:pr-2"
          style={{
            border: `1px solid ${focused ? "var(--mkt-ink)" : "var(--mkt-line-input)"}`,
            boxShadow: "0 14px 44px rgba(0,0,0,.08)",
            transition: "border-color 160ms ease",
          }}
        >
          <input
            ref={inputRef}
            id={isHero ? "mkt-hero-input" : undefined}
            type="text"
            name="vibe"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={isGenerating}
            aria-label="Describe a vibe"
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-[15px] outline-none sm:px-0 sm:py-2.5 sm:text-[17px]"
            style={{
              color: "var(--mkt-ink)",
              opacity: visible ? 1 : 0.35,
              transition: "opacity 200ms ease",
            }}
          />
          <button
            type="submit"
            disabled={isGenerating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold text-white transition-colors disabled:opacity-80 sm:w-auto sm:whitespace-nowrap sm:rounded-full sm:px-6 sm:py-3.5"
            style={{ background: "var(--mkt-ink)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--mkt-ink)")}
          >
            {buttonLabel}
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </form>
      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--mkt-ink-2)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/** The suggestion chips that sit under the hero input. Clicking one
 *  generates immediately rather than only filling the field — the spec's
 *  "fills the input and submits", collapsed into one tap. */
export function SuggestionChips({ chips }: { chips: string[] }) {
  const { generate } = useGenerate();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => generate(chip, "chip")}
          className="rounded-full px-3.5 py-[7px] text-[13px] transition-colors"
          style={{
            border: "1px solid var(--mkt-line-input)",
            color: "var(--mkt-ink-2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--mkt-ink)";
            e.currentTarget.style.color = "var(--mkt-ink)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--mkt-line-input)";
            e.currentTarget.style.color = "var(--mkt-ink-2)";
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
