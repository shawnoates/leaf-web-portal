import type { ReactNode } from "react";
import { JOIN_URL, LOGIN_URL, MANAGER_URL } from "./config";

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

/** Eyebrow + italic serif heading + optional lead, the homepage's section opener. */
export function SectionHead({
  eyebrow,
  title,
  lead,
  center = false,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`section-head${center ? " section-head--center" : ""}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="h-section">{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}

export function Plaque({ children }: { children: ReactNode }) {
  // Plain inline source citation — no pill, no dot. Matches the same
  // treatment on /resident-managers so the two marketing pages share
  // a quieter citation style.
  return <span className="plaque">Source: {children}</span>;
}

export type CTATarget = "join" | "login" | "manager";
export type CTAVariant = "primary" | "ghost";

// Track names feed dataLayer / GA so we can see funnel volume per CTA.
//   join    → /partners/join (claim the free night)
//   login   → /partners/login (partner sign in)
//   manager → the "Talk to a partner manager" calendar
const MAP: Record<CTATarget, { href: string; track: string }> = {
  join: { href: JOIN_URL, track: "claim_free_night" },
  login: { href: LOGIN_URL, track: "partner_sign_in" },
  manager: { href: MANAGER_URL, track: "talk_to_manager" },
};

export function CTA({
  to = "join",
  variant = "primary",
  arrow = false,
  small = false,
  children,
}: {
  to?: CTATarget;
  variant?: CTAVariant;
  arrow?: boolean;
  small?: boolean;
  children: ReactNode;
}) {
  const { href, track } = MAP[to];
  const isExternal = /^https?:/.test(href);
  return (
    <a
      className={`btn btn-${variant}${small ? " btn-sm" : ""}`}
      href={href}
      data-cta={track}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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

export function TrustStrip({ center = false }: { center?: boolean }) {
  return (
    <div className={`trust${center ? " trust--center" : ""}`}>
      <span>First Neighbor Hour free</span>
      <span>$6 per RSVP after</span>
      <span>No contract</span>
    </div>
  );
}
