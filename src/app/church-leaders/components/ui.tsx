import type { ReactNode } from "react";
import { EXAMPLE_URL, FREE_URL } from "./config";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Plaque({ children }: { children: ReactNode }) {
  return <span className="plaque">Source: {children}</span>;
}

/**
 * The page's only CTA. Deliberately has no `to` prop — there is one
 * destination (/organizations/setup) and one tracked event. Keeping the
 * single destination baked in makes it hard to quietly grow a second
 * conversion path onto this page.
 */
export function CTA({
  variant = "primary",
  arrow = true,
  children = "Start your church's free calendar",
}: {
  variant?: "primary" | "ghost";
  arrow?: boolean;
  children?: ReactNode;
}) {
  return (
    <a className={`btn btn-${variant}`} href={FREE_URL} data-cta="church_start_free">
      {children}
      {arrow && (
        <span className="btn-arrow" aria-hidden="true">
          →
        </span>
      )}
    </a>
  );
}

export function ExampleLink({ className = "" }: { className?: string }) {
  return (
    <a
      className={`cta-stack__hint ${className}`.trim()}
      href={EXAMPLE_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-cta="church_see_example"
    >
      See an example calendar →
    </a>
  );
}

export function TrustStrip({ items }: { items?: string[] }) {
  const line = items ?? [
    "Free",
    "Nothing to download",
    "Your staff doesn't run it",
  ];
  return (
    <div className="trust">
      {line.map((t) => (
        <span key={t}>{t}</span>
      ))}
    </div>
  );
}
