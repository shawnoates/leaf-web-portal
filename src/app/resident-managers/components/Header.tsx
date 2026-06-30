"use client";

import { useEffect } from "react";
import { CTA, LeafMark } from "./ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WindowWithDataLayer = Window & { dataLayer?: any[] };

/**
 * Sticky landing-page header. Also wires a delegated click listener that
 * forwards `data-cta` attributes on any CTA to the page dataLayer (picked
 * up by GTM if installed). CTAs elsewhere on the page benefit too, since
 * the listener is delegated at the document level.
 */
export default function Header() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const el = target.closest("[data-cta]");
      if (!el) return;
      const name = el.getAttribute("data-cta");
      if (typeof window !== "undefined") {
        const w = window as WindowWithDataLayer;
        if (w.dataLayer) {
          w.dataLayer.push({ event: "cta_click", cta: name });
        }
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <header className="header">
      <div className="container header__in">
        <a className="brand" href="#top">
          <span className="brand__mark">
            <LeafMark size={18} />
          </span>
          Leaf
        </a>
        <div className="header__cta">
          <a className="link-ghost" href="#how">
            How it works
          </a>
          <CTA to="demo" variant="primary">
            Book a demo
          </CTA>
        </div>
      </div>
    </header>
  );
}
