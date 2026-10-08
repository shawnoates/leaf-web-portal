"use client";

import { useEffect } from "react";
import { CTA } from "./ui";
import { JOIN_URL, LOGIN_URL } from "./config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WindowWithDataLayer = Window & { dataLayer?: any[] };

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

  // A rep's walk-in email links here with ?lead=: carry it onto every
  // "Claim your free Neighbor Hour" button so the sign-up still credits the rep.
  useEffect(() => {
    const lead = new URLSearchParams(window.location.search).get("lead");
    if (!lead) return;
    document.querySelectorAll<HTMLAnchorElement>(`a[href="${JOIN_URL}"]`).forEach((a) => {
      a.href = `${JOIN_URL}?lead=${encodeURIComponent(lead)}`;
    });
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
          <a className="link-ghost" href={LOGIN_URL} data-cta="partner_sign_in">
            Partner sign in
          </a>
          <CTA to="join" variant="primary">
            Claim your free Neighbor Hour
          </CTA>
        </div>
      </div>
    </header>
  );
}
