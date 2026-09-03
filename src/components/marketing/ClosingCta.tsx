"use client";

import GenerateInput from "./GenerateInput";

// Closing CTA — the same generate input as the hero, so the page both
// opens and closes on the one action it wants.

export default function ClosingCta({
  headline,
  emphasis,
}: {
  headline: string;
  emphasis: string;
}) {
  return (
    <section
      id="mkt-closing"
      className="flex flex-col items-center gap-5 px-5 py-16 text-center sm:gap-[22px] sm:px-12 sm:py-28"
    >
      <h2
        className="m-0"
        style={{
          fontSize: "clamp(32px, 3.7vw, 52px)",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          fontWeight: 400,
        }}
      >
        {headline}
        <br />
        <em className="mkt-serif italic" style={{ fontSize: "1.15em" }}>
          {emphasis}
        </em>
      </h2>

      <div className="mt-2 flex w-full justify-center">
        <GenerateInput source="closing" />
      </div>

      <div className="text-[14px]" style={{ color: "var(--mkt-ink-3)" }}>
        Sign up only when you want to keep it.
      </div>
    </section>
  );
}
