"use client";

import { useState } from "react";
import { CTA, SectionHead } from "./ui";
import { COPY, type Kind } from "./copy";

export default function Objections({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState<number>(0);
  const items = COPY[kind].faq;
  return (
    <section className="section">
      <div className="container">
        <SectionHead center eyebrow="FAQ" title={<>What you&rsquo;re probably thinking.</>} />
        <div className="faq">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div className="acc__item" key={i} data-open={isOpen}>
                <button
                  type="button"
                  className="acc__q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  {it.q}
                  <span className="acc__sign" aria-hidden="true">
                    +
                  </span>
                </button>
                <div className="acc__a">
                  <div>
                    <p>{it.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="inline-cta" style={{ textAlign: "center" }}>
            <CTA to="join" variant="primary" arrow>
              {COPY[kind].cta}
            </CTA>
          </div>
        </div>
      </div>
    </section>
  );
}
