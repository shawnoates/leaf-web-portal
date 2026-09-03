"use client";

import { useEffect, useState } from "react";
import { focusHeroInput } from "./useGenerate";
import { trackMarketingEvent } from "./analytics";

// Mobile-only sticky generate bar. Appears once the hero input scrolls
// out of view and hides again when the closing input is on screen, so
// the two never compete for the same tap.

export default function StickyGenerateBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("mkt-hero-input");
    const closing = document.getElementById("mkt-closing");
    if (!hero) return;

    let heroVisible = true;
    let closingVisible = false;
    const sync = () => setShow(!heroVisible && !closingVisible);

    const heroIo = new IntersectionObserver((entries) => {
      heroVisible = entries[0]?.isIntersecting ?? false;
      sync();
    });
    heroIo.observe(hero);

    let closingIo: IntersectionObserver | undefined;
    if (closing) {
      closingIo = new IntersectionObserver((entries) => {
        closingVisible = entries[0]?.isIntersecting ?? false;
        sync();
      });
      closingIo.observe(closing);
    }

    return () => {
      heroIo.disconnect();
      closingIo?.disconnect();
    };
  }, []);

  return (
    <div
      className="fixed bottom-3 left-3 right-3 z-40 flex items-center rounded-full py-1.5 pl-[18px] pr-1.5 sm:hidden"
      style={{
        background: "var(--mkt-ink)",
        color: "#fff",
        boxShadow: "0 14px 40px rgba(0,0,0,.3)",
        opacity: show ? 1 : 0,
        transform: show ? "none" : "translateY(12px)",
        pointerEvents: show ? "auto" : "none",
        transition: "opacity 180ms ease, transform 180ms ease",
      }}
      aria-hidden={!show}
    >
      <span className="flex-1 text-[14px]" style={{ opacity: 0.7 }}>
        Type a vibe…
      </span>
      <button
        type="button"
        tabIndex={show ? 0 : -1}
        onClick={() => {
          trackMarketingEvent("generate_submit_intent", { source: "sticky" });
          focusHeroInput();
        }}
        className="rounded-full px-4 py-[11px] text-[13px] font-semibold"
        style={{ background: "#fff", color: "var(--mkt-ink)" }}
      >
        Generate
      </button>
    </div>
  );
}
