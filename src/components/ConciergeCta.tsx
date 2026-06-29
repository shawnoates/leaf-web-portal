"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  deriveConciergeCta,
  loadUserConciergeSummary,
  type UserConciergeSummary,
} from "@/lib/concierge";

/**
 * Eligibility-aware CTA for the Concierge tier card on /organizations.
 *
 * Renders "Book a demo" by default; flips to "Start enrollment" / "Resume
 * enrollment" / "Go to dashboard" / "Re-enroll" / etc. based on the
 * highest-priority Calendar state for the logged-in user.
 *
 * Spec §3 (closing addendum) — owner sees a single, state-aware CTA on
 * the marketing page and pricing anchor. Same logic, both spots.
 */
interface Props {
  dark?: boolean;
  className?: string;
}

export default function ConciergeCta({ dark = true, className = "" }: Props) {
  const [summary, setSummary] = useState<UserConciergeSummary>({
    loading: true,
    loggedIn: false,
    calendars: [],
    primary: null,
  });

  useEffect(() => {
    let mounted = true;
    loadUserConciergeSummary()
      .then((s) => {
        if (mounted) setSummary(s);
      })
      .catch((err) => {
        console.warn("[Concierge] eligibility load failed:", err);
        if (mounted) setSummary({ loading: false, loggedIn: false, calendars: [], primary: null });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const cta = deriveConciergeCta(summary);

  const baseClasses = `w-full py-3.5 text-sm font-semibold text-center flex items-center justify-center gap-2 rounded-full transition-colors ${
    dark ? "bg-white text-zinc-900 hover:bg-white/90" : "border border-zinc-200 text-zinc-900 hover:bg-zinc-50"
  } ${className}`;

  if (summary.loading) {
    return (
      <button
        disabled
        className={`${baseClasses} opacity-60 cursor-wait`}
        aria-busy
      >
        Loading…
      </button>
    );
  }

  if (cta.external) {
    return (
      <a
        href={cta.href}
        target="_blank"
        rel="noopener noreferrer"
        className={baseClasses}
      >
        {cta.label} <ChevronRight className="w-3.5 h-3.5" />
      </a>
    );
  }

  return (
    <Link href={cta.href} className={baseClasses}>
      {cta.label} <ChevronRight className="w-3.5 h-3.5" />
    </Link>
  );
}
