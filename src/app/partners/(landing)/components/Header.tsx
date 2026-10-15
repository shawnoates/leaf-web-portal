"use client";

import { useEffect, useRef, useState } from "react";
import { CTA } from "./ui";
import { JOIN_URL, LOGIN_URL } from "./config";
import { signedInPartner } from "@/lib/merchant-session";
import { COPY, type Kind } from "./copy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WindowWithDataLayer = Window & { dataLayer?: any[] };

export default function Header({ kind = "bar" }: { kind?: Kind }) {
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

  // Hairline under the bar only once the page has scrolled under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
  // sign-up button (so the sign-up still credits the rep) and onto the
  // bars / shops / studios tabs. The sign-up gets ?for= too, so its words match.
  useEffect(() => {
    const lead = new URLSearchParams(window.location.search).get("lead");
    const q = new URLSearchParams();
    if (lead) q.set("lead", lead);
    if (kind !== "bar") q.set("for", kind);
    if (q.toString()) {
      document.querySelectorAll<HTMLAnchorElement>(`a[href="${JOIN_URL}"]`).forEach((a) => {
        a.href = `${JOIN_URL}?${q.toString()}`;
      });
    }
    if (lead) {
      document.querySelectorAll<HTMLAnchorElement>("a[data-kind-tab]").forEach((a) => {
        const k = a.getAttribute("data-kind-tab");
        a.href = `/partners?${k && k !== "bar" ? `for=${k}&` : ""}lead=${encodeURIComponent(lead)}`;
      });
    }
  }, [kind]);

  return (
    <header className="header" data-scrolled={scrolled}>
      <div className="container header__in">
        <a className="brand" href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/leaf-logo-black.png" alt="Leaf" className="brand__logo" />
          <span className="brand__os">OS</span>
          <span className="brand__for">For businesses</span>
        </a>
        <nav className="header__nav">
          <a className="header__link header__link--anchor" href="#how">
            How it works
          </a>
          <a className="header__link header__link--anchor" href="#offer">
            Pricing
          </a>
          <a
            ref={signIn}
            className="header__link header__link--strong"
            href={LOGIN_URL}
            data-cta="partner_sign_in"
          >
            Partner sign in
          </a>
          <CTA to="join" variant="primary" small>
            {COPY[kind].cta}
          </CTA>
        </nav>
      </div>
    </header>
  );
}
