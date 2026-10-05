"use client";

import Link from "next/link";
import { allCredits } from "./photos";

/** `dark`: on a dark page (Friend Mode's /friends) — white logo, light text. */
export default function MarketingFooter({ blurb, dark = false }: { blurb: string; dark?: boolean }) {
  const ink = dark ? "#F2F1EC" : "var(--mkt-ink)";
  const ink3 = dark ? "#A3ACA6" : "var(--mkt-ink-3)";
  return (
    <footer
      className="px-5 py-10 sm:px-12"
      style={{
        borderTop: `1px solid ${dark ? "#2E4038" : "var(--mkt-line-section)"}`,
        color: ink3,
      }}
    >
      <div className="mx-auto grid max-w-[1440px] gap-8 text-[13px] sm:grid-cols-[2fr_1fr_1fr] sm:gap-6">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dark ? "/leaf-logo-white.svg" : "/leaf-logo-black.png"} alt="Leaf" className={`h-[18px] ${dark ? "brightness-0 invert" : ""}`} />
            <span
              className="text-[16px] font-light uppercase tracking-[0.14em]"
              style={{ color: ink, opacity: 0.5 }}
            >
              OS
            </span>
          </div>
          <div className="max-w-[280px] leading-[1.5]">{blurb}</div>
        </div>

        <FooterColumn
          title="Platform" ink={ink}
          links={[
            { href: "/about", label: "About" },
            { href: "/personal", label: "For individuals" },
            { href: "/friends", label: "Friend Mode" },
            { href: "/organizations", label: "For organizations" },
            { href: "/help", label: "Help" },
            { href: "#pricing", label: "Pricing" },
          ]}
        />
        <FooterColumn
          title="Local businesses" ink={ink}
          links={[
            { href: "/partner", label: "Host neighbors" },
            { href: "/partner/login", label: "Business sign in" },
          ]}
        />
        <FooterColumn
          title="Legal" ink={ink}
          links={[
            { href: "/terms-conditions", label: "Terms" },
            { href: "/privacy-policy", label: "Privacy" },
            { href: "/safety", label: "Safety" },
          ]}
        />
      </div>

      {/* Unsplash's guidelines ask for a visible photographer credit
          wherever their photos are used. */}
      <div
        className="mx-auto mt-8 max-w-[1440px] text-[11px] leading-[1.6]"
        style={{ color: ink3, opacity: 0.75 }}
      >
        Photography via{" "}
        <a
          href="https://unsplash.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-70"
        >
          Unsplash
        </a>
        :{" "}
        {allCredits().map((c, i) => (
          <span key={c.creditUrl}>
            {i > 0 && ", "}
            <a
              href={c.creditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-70"
            >
              {c.credit}
            </a>
          </span>
        ))}
        .
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
  ink,
}: {
  title: string;
  links: { href: string; label: string }[];
  ink: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="mkt-mono text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: ink }}
      >
        {title}
      </div>
      {links.map((link) =>
        link.href.startsWith("#") ? (
          <a key={link.href} href={link.href} className="hover:opacity-70">
            {link.label}
          </a>
        ) : (
          <Link key={link.href} href={link.href} className="hover:opacity-70">
            {link.label}
          </Link>
        )
      )}
    </div>
  );
}
