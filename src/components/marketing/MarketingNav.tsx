"use client";

import Link from "next/link";

// Nav for the marketing pages. The spec demotes the old "Get Started"
// button to a plain "Log in" text link so the hero's generate input is
// the only button above the fold.

export default function MarketingNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <nav className="px-5 py-4 sm:px-12 sm:py-[22px]">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/leaf-logo-black.png" alt="Leaf" className="h-[18px] sm:h-5" />
          <span
            className="text-[15px] font-light uppercase tracking-[0.14em] sm:text-[17px]"
            style={{ color: "var(--mkt-ink)", opacity: 0.5 }}
          >
            OS
          </span>
        </Link>
        <div className="flex items-center gap-5 text-sm sm:gap-7 sm:text-[14px]">
          <a
            href="#pricing"
            className="hidden transition-colors hover:opacity-70 sm:block"
            style={{ color: "var(--mkt-ink-2)" }}
          >
            Pricing
          </a>
          <Link
            href="/organizations"
            className="hidden transition-colors hover:opacity-70 sm:block"
            style={{ color: "var(--mkt-ink-2)" }}
          >
            For organizations
          </Link>
          <Link
            href="/dashboard"
            className="font-semibold transition-colors hover:opacity-70"
            style={{ color: "var(--mkt-ink)" }}
          >
            {isLoggedIn ? "Dashboard" : "Log in"}
          </Link>
        </div>
      </div>
    </nav>
  );
}
