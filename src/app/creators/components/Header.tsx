"use client";

import { useEffect } from "react";
import { CTA } from "./ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WindowWithDataLayer = Window & { dataLayer?: any[] };

/**
 * Sticky landing-page header. Mirrors the os.joinleaf.com brand mark
 * (leaf-logo-black.png + "OS" wordmark) so this marketing route reads
 * as part of the same site. A delegated click listener forwards
 * [data-cta] attributes to window.dataLayer for GTM analytics.
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
          <a className="link-ghost" href="#how">
            How it works
          </a>
          <CTA variant="primary">Partner with us</CTA>
        </div>
      </div>
    </header>
  );
}
