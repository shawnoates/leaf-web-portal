import type { ReactNode } from "react";
import { PARTNER_URL, SAMPLE_URL } from "./config";

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

export type CTATarget = "partner" | "sample";
export type CTAVariant = "primary" | "ghost";

const MAP: Record<CTATarget, { href: string; track: string }> = {
  partner: { href: PARTNER_URL, track: "become_partner" },
  sample: { href: SAMPLE_URL, track: "view_sample" },
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
