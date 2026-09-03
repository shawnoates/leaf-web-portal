"use client";

import GenerateInput, { SuggestionChips } from "./GenerateInput";

// Hero — headline, lead, the generate input (the only button on the
// fold) and the suggestion chips.
//
// The spec's live pill ("132 calendars made in Brooklyn this week") is
// deliberately absent: it needs a real per-city count endpoint, and the
// spec says to omit it rather than ship an invented number. Drop it back
// in here the moment that endpoint exists.

interface Props {
  /** Headline second line's emphasised word — "calendar" everywhere
   *  today, kept a prop so /organizations can diverge without a fork. */
  headline: React.ReactNode;
  lead: string;
  chips: string[];
}

export default function MarketingHero({ headline, lead, chips }: Props) {
  return (
    <section className="flex flex-col items-center gap-4 px-5 pb-9 pt-9 text-center sm:gap-[22px] sm:px-12 sm:pb-9 sm:pt-[72px]">
      <h1
        className="mkt-serif m-0"
        style={{
          fontSize: "clamp(52px, 6.1vw, 88px)",
          lineHeight: 0.99,
          letterSpacing: "-0.015em",
        }}
      >
        {headline}
      </h1>

      <p
        className="m-0 max-w-[520px] text-[15px] leading-[1.5] sm:text-[19px]"
        style={{ color: "var(--mkt-ink-2)", textWrap: "pretty" }}
      >
        {lead}
      </p>

      <div className="mt-2 flex w-full justify-center">
        <GenerateInput source="hero" isHero />
      </div>

      <SuggestionChips chips={chips} />
    </section>
  );
}
