import type { ReactNode } from "react";
import { DEMO_URL, FREE_URL } from "./config";

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
  // Plain inline source citation — no pill, no dot. Quiet grey text
  // prefixed with "Source:" reads as a citation without competing with
  // the surrounding copy.
  return <span className="plaque">Source: {children}</span>;
}

export type CTATarget = "demo" | "free";
export type CTAVariant = "primary" | "ghost";

export function CTA({
  to = "demo",
  variant = "primary",
  arrow = false,
  children,
}: {
  to?: CTATarget;
  variant?: CTAVariant;
  arrow?: boolean;
  children: ReactNode;
}) {
  const href = to === "demo" ? DEMO_URL : FREE_URL;
  const track = to === "demo" ? "book_demo" : "start_free";
  // Only open the demo (external Google Calendar) in a new tab; the free
  // calendar lives on the same site so keep it in-tab.
  const isExternal = /^https?:/.test(href);
  return (
    <a
      className={`btn btn-${variant}`}
      href={href}
      data-cta={track}
      {...(isExternal
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
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
      <span>No app for residents to download</span>
      <span>First event on us</span>
      <span>Start free in minutes</span>
    </div>
  );
}
