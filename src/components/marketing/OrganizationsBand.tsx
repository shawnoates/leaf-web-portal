"use client";

import Link from "next/link";

// "For organizations" cross-sell band, shown on /personal. The spec pairs
// it with a 380px screenshot of a branded org calendar; that needs a real
// capture from the live app, so until one exists the band runs as a
// single centred column rather than a two-column layout with an empty
// grey rectangle in it.

export default function OrganizationsBand() {
  return (
    <section className="px-5 py-12 sm:px-12 sm:py-24">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4 sm:gap-[18px]">
        <div className="mkt-eyebrow">For organizations</div>
        <h2
          className="m-0"
          style={{
            fontSize: "clamp(28px, 2.8vw, 40px)",
            lineHeight: 1.1,
            letterSpacing: "-0.025em",
            fontWeight: 400,
          }}
        >
          Run clubs, studios, community groups:{" "}
          <em className="mkt-serif italic" style={{ fontSize: "1.15em" }}>
            your calendar, your brand.
          </em>
        </h2>
        <p
          className="m-0 text-[15px] leading-[1.6] sm:text-[17px]"
          style={{ color: "var(--mkt-ink-2)", textWrap: "pretty" }}
        >
          Upload a logo, set a color, and give your members one page to follow.
          Unlimited RSVPs and attendance reporting on Pro.
        </p>
        <div className="mt-1.5">
          <Link
            href="/organizations"
            className="inline-flex items-center rounded-full px-[22px] py-3 text-[14px] font-semibold transition-colors"
            style={{ border: "1.5px solid var(--mkt-ink)", color: "var(--mkt-ink)" }}
          >
            See organizations →
          </Link>
        </div>
      </div>
    </section>
  );
}
