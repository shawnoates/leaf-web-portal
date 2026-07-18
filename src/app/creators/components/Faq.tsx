"use client";

import { useState } from "react";
import { CTA } from "./ui";

const items = [
  {
    q: "Do I need a big following?",
    a: "No. 1k–5k with real engagement beats 50k with none. We check your last five posts, not your follower count.",
  },
  {
    q: "Do you write the script?",
    a: "Yes — we send the script and a bank of overlay/caption ideas, tuned to your night. You bring the people, the place, and film it.",
  },
  {
    q: "Who owns the video?",
    a: "You do. You post it to your account. If we want to boost or reshare it as an ad, we'll ask and pay for usage separately.",
  },
  {
    q: "When do I get paid?",
    a: "Within 24 hours of posting, via Venmo or Zelle. Bonuses pay out within 30 days once the view threshold is confirmed.",
  },
  {
    q: "Can I do this more than once?",
    a: "That's the goal. Our best partnerships are ongoing — a video a month from someone who genuinely uses Leaf beats ten one-offs.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number>(0);
  return (
    <section className="band-white section">
      <div className="container" style={{ maxWidth: 860 }}>
        <div className="section-head" style={{ marginBottom: 30 }}>
          <h2 className="h-lg">Questions, answered.</h2>
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
          <CTA variant="primary" arrow>
            Partner with us
          </CTA>
        </div>
      </div>
    </section>
  );
}
