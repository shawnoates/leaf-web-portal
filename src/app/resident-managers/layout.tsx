import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = {
  title: "Leaf — Build community. Keep residents. Protect your NOI.",
  description:
    "Leaf runs the social side of your building for you — one done-for-you resident event a month — so neighbors connect, residents renew, and your NOI holds. Book a Concierge demo or start your calendar free.",
  openGraph: {
    title: "Leaf — Neighbors who know each other don't leave",
    description:
      "Done-for-you resident events that build community and drive renewals. Book a Concierge demo or start your building's calendar free.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#1b4332",
};

/**
 * Route-scoped layout. The single wrapper div carries the `.rm-landing`
 * class so the imported styles.css (which prefixes every selector with
 * that class) applies only here — leaves the rest of os.joinleaf.com
 * on Tailwind without collisions.
 */
export default function ResidentManagersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="rm-landing">{children}</div>;
}
