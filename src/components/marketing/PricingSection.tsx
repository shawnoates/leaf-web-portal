"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import ConciergeCta from "@/components/ConciergeCta";
import { focusHeroInput } from "./useGenerate";
import { trackMarketingEvent } from "./analytics";

// Pricing. Restyled to the spec's card treatment while keeping every
// behaviour the old sections had: the monthly/yearly toggle (the backend
// does support it, and the spec says to keep it where it does), the
// external "Book a demo" link, and the eligibility-aware ConciergeCta.

export interface PricingTier {
  id: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyPeriod: string;
  yearlyPeriod: string;
  yearlySavings?: string;
  customPrice?: string;
  description: string;
  cta: string;
  ctaHref?: string;
  highlight: boolean;
  dark?: boolean;
  inheritsLabel?: string;
  features: string[];
  excluded: string[];
  /** Free tier sends people back to the hero input rather than to a
   *  signup form — the whole page is built on "generate before you
   *  sign up". */
  ctaFocusesHero?: boolean;
}

export default function PricingSection({
  tiers,
  isLoggedIn,
  subhead,
  footnote,
}: {
  tiers: PricingTier[];
  isLoggedIn: boolean;
  subhead: string;
  footnote?: string;
}) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly"
  );

  return (
    <section
      id="pricing"
      className="px-5 py-12 sm:px-12 sm:py-[88px]"
      style={{ borderTop: "1px solid var(--mkt-line-section)" }}
    >
      <div className="mx-auto max-w-[1440px]">
        <div className="mkt-eyebrow text-center">Pricing</div>
        <h2
          className="mkt-serif m-0 mb-3 mt-2 text-center italic"
          style={{ fontSize: "clamp(30px, 3.1vw, 44px)", lineHeight: 1.1 }}
        >
          Simple pricing that grows with you
        </h2>
        <p
          className="mx-auto mb-8 max-w-[560px] text-center text-[15px] sm:text-[16px]"
          style={{ color: "var(--mkt-ink-2)" }}
        >
          {subhead}
        </p>

        <div className="mb-10 flex justify-center">
          <div
            className="inline-flex items-center gap-1 rounded-full p-1"
            style={{ background: "var(--mkt-bg-alt)" }}
          >
            {(["monthly", "yearly"] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setBillingPeriod(period)}
                className="rounded-full px-5 py-2 text-sm font-medium capitalize transition-colors"
                style={
                  billingPeriod === period
                    ? { background: "var(--mkt-ink)", color: "#fff" }
                    : { color: "var(--mkt-ink-2)" }
                }
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`mx-auto grid gap-5 ${
            tiers.length > 2 ? "max-w-[1100px] lg:grid-cols-3" : "max-w-[900px] sm:grid-cols-2"
          }`}
        >
          {tiers.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              billingPeriod={billingPeriod}
              isLoggedIn={isLoggedIn}
            />
          ))}
        </div>

        {footnote && (
          <p
            className="mx-auto mt-10 max-w-[720px] text-center text-sm leading-relaxed"
            style={{ color: "var(--mkt-ink-2)" }}
          >
            {footnote}
          </p>
        )}
      </div>
    </section>
  );
}

function TierCard({
  tier,
  billingPeriod,
  isLoggedIn,
}: {
  tier: PricingTier;
  billingPeriod: "monthly" | "yearly";
  isLoggedIn: boolean;
}) {
  const price = tier.customPrice
    ? tier.customPrice
    : billingPeriod === "yearly"
      ? tier.yearlyPrice
      : tier.monthlyPrice;
  const period = tier.customPrice
    ? "/mo"
    : billingPeriod === "yearly"
      ? tier.yearlyPeriod
      : tier.monthlyPeriod;

  const isExternal = /^(mailto:|https?:)/.test(tier.ctaHref || "");
  const href = tier.ctaHref
    ? tier.ctaHref
    : isLoggedIn
      ? "/dashboard"
      : `/organizations/setup?tier=${tier.id}&billingPeriod=${billingPeriod}`;
  const ctaLabel = !tier.ctaHref && isLoggedIn ? "Go to dashboard" : tier.cta;

  const dark = !!tier.dark;
  const ctaClasses =
    "mt-2 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-center text-sm font-semibold transition-colors";

  const ctaStyle: React.CSSProperties = tier.highlight
    ? { background: "var(--mkt-ink)", color: "#fff" }
    : dark
      ? { background: "#fff", color: "var(--mkt-ink)" }
      : { border: "1.5px solid var(--mkt-ink)", color: "var(--mkt-ink)" };

  return (
    <div
      className="relative flex flex-col gap-4 rounded-[18px] p-7 sm:p-8"
      style={
        dark
          ? { background: "var(--mkt-ink)", color: "#fff" }
          : {
              background: "#fff",
              border: tier.highlight
                ? "2px solid var(--mkt-ink)"
                : "1px solid var(--mkt-line)",
            }
      }
    >
      {tier.highlight && (
        <div
          className="mkt-mono absolute -top-[13px] left-8 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em]"
          style={{ background: "var(--mkt-ink)", color: "#fff" }}
        >
          Most popular
        </div>
      )}

      <div
        className="mkt-mono text-[12px] uppercase"
        style={{ color: dark ? "rgba(255,255,255,.6)" : "var(--mkt-ink-3)" }}
      >
        {tier.name}
      </div>

      <div className="flex flex-wrap items-baseline gap-1">
        <span
          className="text-[40px] font-semibold"
          style={{ letterSpacing: "-0.02em" }}
        >
          {price}
        </span>
        {period && (
          <span
            className="text-[16px]"
            style={{ color: dark ? "rgba(255,255,255,.5)" : "var(--mkt-ink-3)" }}
          >
            {period}
          </span>
        )}
      </div>
      {!tier.customPrice && billingPeriod === "yearly" && tier.yearlySavings && (
        <span
          className="-mt-2 text-xs font-medium"
          style={{ color: "var(--mkt-green)" }}
        >
          {tier.yearlySavings}
        </span>
      )}

      <p
        className="m-0 text-[15px]"
        style={{ color: dark ? "rgba(255,255,255,.7)" : "var(--mkt-ink-2)" }}
      >
        {tier.description}
      </p>

      <div className="flex flex-1 flex-col">
        {tier.inheritsLabel && (
          <p
            className="mb-3 text-xs font-semibold tracking-wide"
            style={{ color: dark ? "rgba(255,255,255,.8)" : "var(--mkt-ink)" }}
          >
            {tier.inheritsLabel}
          </p>
        )}
        <div className="flex flex-col text-[14.5px]" style={{ lineHeight: 1.9 }}>
          {tier.features.map((f) => (
            <span key={f}>✓ {f}</span>
          ))}
          {tier.excluded.map((f) => (
            <span
              key={f}
              style={{ color: dark ? "rgba(255,255,255,.3)" : "#c8c7c1" }}
            >
              — {f}
            </span>
          ))}
        </div>
      </div>

      {tier.id === "managed" ? (
        <ConciergeCta dark={dark} />
      ) : tier.ctaFocusesHero && !isLoggedIn ? (
        <button
          type="button"
          className={ctaClasses}
          style={ctaStyle}
          onClick={() => {
            trackMarketingEvent("generate_submit_intent", {
              source: "pricing_free",
            });
            focusHeroInput();
          }}
        >
          {tier.cta} <ChevronRight className="h-3.5 w-3.5" />
        </button>
      ) : isExternal ? (
        <a
          href={href}
          target={href.startsWith("mailto:") ? undefined : "_blank"}
          rel={href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
          className={ctaClasses}
          style={ctaStyle}
        >
          {ctaLabel} <ChevronRight className="h-3.5 w-3.5" />
        </a>
      ) : (
        <Link href={href} className={ctaClasses} style={ctaStyle}>
          {ctaLabel} <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
