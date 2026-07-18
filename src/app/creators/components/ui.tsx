import type { ReactNode } from "react";
import { PARTNER_URL } from "./config";

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
  return <span className="plaque">{children}</span>;
}

export type CTAVariant = "primary" | "ghost";

/**
 * Primary CTAs open a pre-addressed email to PARTNER_URL. Pass an
 * explicit `href` (e.g. "#how") for in-page anchor links. Only http(s)
 * external links open in a new tab — mailto and anchors stay in place.
 */
export function CTA({
  href,
  variant = "primary",
  arrow = false,
  track,
  children,
}: {
  href?: string;
  variant?: CTAVariant;
  arrow?: boolean;
  track?: string;
  children: ReactNode;
}) {
  const target = href ?? PARTNER_URL;
  const isHttp = /^https?:/.test(target);
  const isAnchor = target.startsWith("#");
  const cta = track ?? (isAnchor ? "anchor" : "partner");
  return (
    <a
      className={`btn btn-${variant}`}
      href={target}
      data-cta={cta}
      {...(isHttp ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
      <span>Brooklyn + NYC first</span>
      <span>1k followers is plenty</span>
      <span>Paid within 24h</span>
    </div>
  );
}
