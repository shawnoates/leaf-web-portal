"use client";

import { useState } from "react";
import { CTA, SectionHead } from "./ui";

const items = [
  {
    q: "What's the catch?",
    a: "There isn't one. Your first Neighbor Hour is free: no listing fee, no RSVP fees. If you like how it goes, book more nights at $6 per RSVP.",
  },
  {
    q: "Who are these people?",
    a: "Residents of the buildings around you who use their neighborhood's Leaf calendar to plan their week. They live a short walk away, so they can become regulars.",
  },
  {
    q: "Do I have to run anything?",
    a: "No. Give the group a few tables or a corner of the room, and they order off your menu like anyone else. If you'd rather someone run the night, add a Leaf host for $99.",
  },
  {
    q: "What if nobody shows up?",
    a: "You only pay for neighbors who RSVP, inside the days and times you pick, and never more than your weekly limit. Your first Neighbor Hour is free.",
  },
  {
    q: "How is this different from an ad?",
    a: "An ad reaches strangers anywhere and charges for clicks. Leaf reaches the people who live a 5-minute walk away, and you pay per person who RSVPs.",
  },
  {
    q: "I'm already a partner. How do I sign in?",
    a: "Use Partner sign in and enter your email. We'll send you a link to your dashboard, no password needed.",
  },
]

export default function Objections() {
  const [open, setOpen] = useState<number>(0);
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
              Claim your free Neighbor Hour
            </CTA>
          </div>
        </div>
      </div>
    </section>
  );
}
