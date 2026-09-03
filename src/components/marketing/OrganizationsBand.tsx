"use client";

import Link from "next/link";
import { ORG_BAND_PHOTO, PHOTO_FILTER } from "./photos";

// "For organizations" cross-sell band, shown on /personal.
//
// Two-column per the mockup: image left, copy right. The spec asks for a
// screenshot of a branded org calendar here, which would be the stronger
// image — it shows the logo-and-colour story the copy is selling. No
// branded org calendar exists to capture yet, so this runs a photograph
// instead; swap it for the real capture when there is one.

export default function OrganizationsBand() {
  return (
    <section className="px-5 py-12 sm:px-12 sm:py-24">
      <div className="mx-auto grid max-w-[1440px] items-center gap-8 lg:grid-cols-2 lg:gap-[72px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ORG_BAND_PHOTO.url}
          alt={ORG_BAND_PHOTO.alt}
          loading="lazy"
          className="h-[220px] w-full rounded-2xl object-cover sm:h-[380px] sm:rounded-[20px]"
          style={{ filter: PHOTO_FILTER, background: "var(--mkt-bg-tile)" }}
        />

        <div className="flex flex-col gap-4 sm:gap-[18px]">
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
            className="m-0 max-w-[480px] text-[15px] leading-[1.6] sm:text-[17px]"
            style={{ color: "var(--mkt-ink-2)", textWrap: "pretty" }}
          >
            Upload a logo, set a color, and give your members one page to
            follow. Unlimited RSVPs and attendance reporting on Pro.
          </p>
          <div className="mt-1.5">
            <Link
              href="/organizations"
              className="inline-flex items-center rounded-full px-[22px] py-3 text-[14px] font-semibold transition-colors"
              style={{
                border: "1.5px solid var(--mkt-ink)",
                color: "var(--mkt-ink)",
              }}
            >
              See organizations →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
