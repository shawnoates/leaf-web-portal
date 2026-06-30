"use client";

import { useState } from "react";
import { CTA } from "./ui";

const items = [
  {
    q: "We already have a resident app.",
    a: "Keep it. Leaf isn't a utility app — it's the social layer those tools don't cover, and there's nothing for residents to download. Your app handles rent and maintenance; Leaf handles community.",
  },
  {
    q: "We don't have time for events.",
    a: "That's the whole point. Concierge is done-for-you — a dedicated concierge plans, books, promotes, and runs each event. You approve; we handle the rest.",
  },
  {
    q: "It's not in the budget.",
    a: "One saved renewal is worth roughly $4,000. Concierge is a fraction of a single move-out — and your first event is on us, so you can see it work before you commit.",
  },
  {
    q: "Our residents won't show up.",
    a: "Switch on the free resident calendar today and watch. We curate events to your building, bring in local sponsors, and handle all the promotion — turnout is our job, not yours.",
  },
  {
    q: "We already do a few events.",
    a: "Then you know the time they eat. We make them consistent and effortless, and stretch your budget further by bringing local businesses in to sponsor.",
  },
];

export default function Objections() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section className="band-white section">
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="section-head" style={{ marginBottom: 30 }}>
          <h2 className="h-lg">What you&rsquo;re probably thinking.</h2>
        </div>
        <div className="acc">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div className="acc__item" key={i} data-open={isOpen}>
                <button
                  className="acc__q"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  {it.q}
                  <span className="acc__sign" aria-hidden="true" />
                </button>
                <div className="acc__a">
                  <p>{it.a}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="inline-cta">
          <CTA to="demo" variant="primary" arrow>
            Book a demo
          </CTA>
        </div>
      </div>
    </section>
  );
}
