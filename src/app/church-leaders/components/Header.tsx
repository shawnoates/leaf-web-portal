"use client";

import { useEffect } from "react";
import { CTA } from "./ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WindowWithDataLayer = Window & { dataLayer?: any[] };

/**
 * Sticky landing header — same shell as /resident-managers so this route
 * reads as part of os.joinleaf.com. The delegated click listener forwards
 * [data-cta] attributes to window.dataLayer for GTM.
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/leaf-logo-black.png" alt="Leaf" className="brand__logo" />
          <span className="brand__os">OS</span>
        </a>
        <div className="header__cta">
          <a className="link-ghost" href="#posts">
            What shows up
          </a>
          <CTA arrow={false}>Start free</CTA>
        </div>
      </div>
    </header>
  );
}
