"use client";

import Link from "next/link";

export default function MarketingFooter({ blurb }: { blurb: string }) {
  return (
    <footer
      className="px-5 py-10 sm:px-12"
      style={{
        borderTop: "1px solid var(--mkt-line-section)",
        color: "var(--mkt-ink-3)",
      }}
    >
      <div className="mx-auto grid max-w-[1440px] gap-8 text-[13px] sm:grid-cols-[2fr_1fr_1fr] sm:gap-6">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/leaf-logo-black.png" alt="Leaf" className="h-[18px]" />
            <span
              className="text-[16px] font-light uppercase tracking-[0.14em]"
              style={{ color: "var(--mkt-ink)", opacity: 0.5 }}
            >
              OS
            </span>
          </div>
          <div className="max-w-[280px] leading-[1.5]">{blurb}</div>
        </div>

        <FooterColumn
          title="Platform"
          links={[
            { href: "/about", label: "About" },
            { href: "/personal", label: "For individuals" },
            { href: "/organizations", label: "For organizations" },
            { href: "/help", label: "Help" },
            { href: "#pricing", label: "Pricing" },
          ]}
        />
        <FooterColumn
          title="Legal"
          links={[
            { href: "/terms-conditions", label: "Terms" },
            { href: "/privacy-policy", label: "Privacy" },
            { href: "/safety", label: "Safety" },
          ]}
        />
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="mkt-mono text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--mkt-ink)" }}
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
