"use client";

import { useState } from "react";

// FAQ accordion — one open at a time. Copy comes from each page's own
// existing FAQ (spec: "reuse the existing site's FAQ copy verbatim"), so
// the questions differ between /personal and /organizations and are
// passed in rather than defined here.

export interface FaqItem {
  q: string;
  a: string;
}

export default function FaqAccordion({
  items,
  defaultOpen = null,
}: {
  items: FaqItem[];
  defaultOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen);

  return (
    <section
      className="px-5 py-12 sm:px-12 sm:py-[88px]"
      style={{ background: "var(--mkt-bg-alt)" }}
    >
      <div className="mx-auto max-w-[760px]">
        <div className="mkt-eyebrow text-center">FAQ</div>
        <h2
          className="mkt-serif m-0 mb-8 mt-2 text-center italic sm:mb-10"
          style={{ fontSize: "clamp(30px, 3.1vw, 44px)", lineHeight: 1.1 }}
        >
          Common questions
        </h2>
        <div className="flex flex-col">
          {items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={item.q}
                style={{
                  borderTop: "1px solid var(--mkt-line-faq)",
                  borderBottom:
                    i === items.length - 1
                      ? "1px solid var(--mkt-line-faq)"
                      : undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start justify-between gap-6 py-5 text-left"
                >
                  <span className="text-[16px] font-semibold sm:text-[17px]">
                    {item.q}
                  </span>
                  <span
                    className="shrink-0 text-[20px] leading-none"
                    style={{ color: "var(--mkt-ink-3)" }}
                    aria-hidden="true"
                  >
                    {isOpen ? "–" : "+"}
                  </span>
                </button>
                <div
                  className="overflow-hidden"
                  style={{
                    display: "grid",
                    gridTemplateRows: isOpen ? "1fr" : "0fr",
                    transition: "grid-template-rows 200ms ease",
                  }}
                >
                  <div style={{ minHeight: 0 }}>
                    <p
                      className="m-0 max-w-[640px] pb-5 text-[15px] leading-[1.6]"
                      style={{ color: "var(--mkt-ink-2)" }}
                    >
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
