"use client";

import { useState } from "react";
import { CTA } from "./ui";

const items = [
  {
    q: "Does this actually work?",
    a: "Start with one deal or one event and measure it — you'll see the new faces yourself. It's low cost and low risk, and you can roll it out wider once it proves out.",
  },
  {
    q: "I already do Instagram and Google.",
    a: "Those reach strangers anywhere. Leaf OS reaches the people who live a 5-minute walk away — the ones who can become weekly regulars. Different audience, far higher lifetime value.",
  },
  {
    q: "I'm too busy to host an event.",
    a: "Then post a deal for free — it's always on and takes zero effort. Or sponsor an event we've already planned for you — back the room, no logistics on your end. Hosting your own is just one path of three.",
  },
  {
    q: "Is it expensive?",
    a: "Start small. A handful of new regulars pays for it many times over — and repeat customers spend 67% more than one-time visitors.",
  },
  {
    q: "Will residents actually come?",
    a: "They're already on the calendar planning their week, and they want to support local. We bring the promotion and the turnout — that's our job, not yours.",
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
          <CTA to="partner" variant="primary" arrow>
            Become a partner
          </CTA>
        </div>
      </div>
    </section>
  );
}
