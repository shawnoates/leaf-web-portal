"use client";

import { useEffect, useRef } from "react";
import { CTA } from "./ui";
import { JOIN_URL, LOGIN_URL } from "./config";
import { signedInPartner } from "@/lib/merchant-session";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WindowWithDataLayer = Window & { dataLayer?: any[] };

export default function Header() {
  // A device that's signed in goes straight to its dashboard (set after load, like ?lead= below).
  const signIn = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const p = signedInPartner();
    const a = signIn.current;
    if (!p || !a) return;
    a.href = `/o/m/${p.token}`;
    a.textContent = "Your dashboard";
    a.setAttribute("data-cta", "partner_dashboard");
  }, []);

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
          <a ref={signIn} className="link-ghost" href={LOGIN_URL} data-cta="partner_sign_in">
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
