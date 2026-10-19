"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";

// Nav for the marketing pages. The spec demotes the old "Get Started"
// button to a plain "Log in" text link so the hero's generate input is
// the only button above the fold.

// A signed-in member's Leaf points, for the small chip beside "Dashboard".
// Nothing shows until they have earned some.
function usePointsBalance(isLoggedIn: boolean): number {
  const [balance, setBalance] = useState(0);
  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    Parse.Cloud.run("getPointsSummary")
      .then((s: { balance?: number }) => { if (!cancelled) setBalance(s?.balance || 0); })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [isLoggedIn]);
  return balance;
}

export default function MarketingNav({ isLoggedIn }: { isLoggedIn: boolean }) {
  const points = usePointsBalance(isLoggedIn);
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
            href="/partners"
            className="hidden transition-colors hover:opacity-70 sm:block"
            style={{ color: "var(--mkt-ink-2)" }}
          >
            For businesses
          </Link>
          {isLoggedIn && points > 0 && (
            <Link
              href="/me#points"
              aria-label={`${points} points, see my points`}
              className="rounded-full px-3 py-1 text-[12px] font-medium transition-opacity hover:opacity-80"
              style={{ color: "#253a33", background: "#f3f7f5", border: "1px solid rgba(0,0,0,.09)" }}
            >
              {points} pts
            </Link>
          )}
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
