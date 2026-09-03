"use client";

// "From a vibe to see you Saturday" — three steps.
//
// Desktop renders bordered cards; mobile collapses to a numbered list
// (spec §Mobile). The spec calls for a 200px product screenshot at the
// top of each card; those need real 2x captures from the live app, so
// the slot is left out until the captures exist rather than shipping a
// striped placeholder to production.

export interface Step {
  number: string;
  title: string;
  body: string;
}

export default function HowItWorks({
  steps,
  heading,
}: {
  steps: Step[];
  heading: string;
}) {
  return (
    <section className="px-5 py-12 sm:px-12 sm:pb-20 sm:pt-24">
      <div className="mx-auto max-w-[1440px]">
        <div className="mkt-eyebrow">How it works</div>
        <h2
          className="mkt-serif m-0 mb-7 mt-1.5 italic sm:mb-11 sm:mt-2"
          style={{ fontSize: "clamp(30px, 3.1vw, 44px)", lineHeight: 1.1 }}
        >
          {heading}
        </h2>

        <div className="flex flex-col gap-7 sm:grid sm:grid-cols-3 sm:gap-5">
          {steps.map((step) => (
            <div
              key={step.number}
              className="flex gap-3.5 sm:block sm:overflow-hidden sm:rounded-2xl sm:p-[22px]"
              style={{ borderColor: "var(--mkt-line)" }}
            >
              <span
                className="mkt-mono shrink-0 pt-1 text-[11px] sm:mb-2 sm:block sm:pt-0 sm:text-[12px]"
                style={{ color: "var(--mkt-ink-3)" }}
              >
                {step.number}
              </span>
              <div>
                <div className="text-[16px] font-semibold sm:text-[19px]">
                  {step.title}
                </div>
                <div
                  className="mt-1 text-[14px] leading-[1.55] sm:mt-2 sm:text-[15px]"
                  style={{ color: "var(--mkt-ink-2)" }}
                >
                  {step.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
