"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { trackGenerateSubmit, type GenerateSource } from "./analytics";

// One generate handler behind every "Generate" surface on the marketing
// pages — hero, closing CTA, sticky mobile bar, the "your calendar here"
// grid slot and the Free pricing button. They all land on /calendars?q=,
// which is where generateAICalendar actually runs; keeping the funnel in
// one place means the analytics `source` is the only thing that differs.

export function useGenerate() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(
    (prompt: string, source: GenerateSource) => {
      const text = prompt.trim();
      if (!text) return;
      trackGenerateSubmit(source, text);
      setIsGenerating(true);
      router.push(`/calendars?q=${encodeURIComponent(text)}`);
    },
    [router]
  );

  return { generate, isGenerating };
}

/** Scroll the page to the hero input and focus it. Used by surfaces that
 *  prompt for a vibe without hosting their own field (the grid's empty
 *  slot, the Free pricing button, the mobile sticky bar). */
export function focusHeroInput() {
  if (typeof document === "undefined") return;
  const input = document.getElementById(
    "mkt-hero-input"
  ) as HTMLInputElement | null;
  window.scrollTo({ top: 0, behavior: "smooth" });
  // Focus after the smooth scroll settles, otherwise the browser jumps
  // straight to the field and the scroll animation is wasted.
  window.setTimeout(() => input?.focus(), 420);
}
