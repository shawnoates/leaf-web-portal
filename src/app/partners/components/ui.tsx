import type { ReactNode } from "react";
import {
  CLAIM_URL,
  DEAL_URL,
  DEMO_URL,
  MANAGER_URL,
  PARTNER_URL,
  SAMPLE_URL,
} from "./config";

export function LeafMark({
  size = 18,
  color = "#95d5b2",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={color}
        d="M20 3C9 3 4 9.5 4 17c0 1.6.3 3 .8 4 .4-3.2 1.8-6 4.4-8.3 2.3-2 5-3.2 8-3.7-2.6 1.3-4.8 3.2-6.4 5.6-1 1.5-1.7 3.2-2 5.1C14 19.8 21 14.5 21 5c0-.7-.1-1.4-.3-2H20z"
      />
    </svg>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Plaque({ children }: { children: ReactNode }) {
  // Plain inline source citation — no pill, no dot. Matches the same
  // treatment on /resident-managers so the two marketing pages share
  // a quieter citation style.
  return <span className="plaque">Source: {children}</span>;
}

export type CTATarget =
  | "partner"
  | "sample"
  | "deal"
  | "claim"
  | "demo"
  | "manager";
export type CTAVariant = "primary" | "ghost";

// Track names are distinct even when several targets alias the same
// URL, so we can see funnel volume per CTA in dataLayer / GA.
//   partner / claim / deal → partner.joinleaf.com/request (claim form)
//   demo                    → the "Book a demo" calendar
//   manager                 → the "Talk to a partner manager" catch-all
//                             calendar (separate slot so partner managers
//                             can see intent)
//   sample                  → /partners/preview (merchant tour), currently
//                             not wired into any CTA but kept in case we
//                             re-add a "See where you show up" link later
const MAP: Record<CTATarget, { href: string; track: string }> = {
  partner: { href: PARTNER_URL, track: "become_partner" },
  sample: { href: SAMPLE_URL, track: "view_sample" },
  deal: { href: DEAL_URL, track: "post_deal" },
  claim: { href: CLAIM_URL, track: "claim_business" },
  demo: { href: DEMO_URL, track: "book_demo" },
  manager: { href: MANAGER_URL, track: "talk_to_manager" },
};

export function CTA({
  to = "partner",
  variant = "primary",
  arrow = false,
  children,
}: {
  to?: CTATarget;
  variant?: CTAVariant;
  arrow?: boolean;
  children: ReactNode;
}) {
  const { href, track } = MAP[to];
  const isExternal = /^https?:/.test(href);
  return (
    <a
      className={`btn btn-${variant}`}
      href={href}
      data-cta={track}
      {...(isExternal
        ? { target: "_blank", rel: "noopener noreferrer" }
        : { target: "_blank", rel: "noopener noreferrer" })}
    >
      {children}
      {arrow && (
        <span className="btn-arrow" aria-hidden="true">
          →
        </span>
      )}
    </a>
  );
}

export function TrustStrip() {
  return (
    <div className="trust">
      <span>Hyperlocal reach</span>
      <span>You set the offer</span>
      <span>We bring the people</span>
    </div>
  );
}
