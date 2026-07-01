import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./styles.css";

const OG_IMAGE = "/resident-managers-hero.png";
const OG_ALT =
  "Neighbors gathering at a resident event on a rooftop at dusk";

export const metadata: Metadata = {
  title: "Leaf — Build community. Keep residents. Protect your NOI.",
  description:
    "Leaf OS runs the social side of your building for you — one done-for-you resident event a month — so neighbors connect, residents renew, and your NOI holds. Book a demo or start your calendar free.",
  openGraph: {
    title: "Leaf — Neighbors who know each other don't leave",
    description:
      "Done-for-you resident events that build community and drive renewals. Book a demo or start your building's calendar free.",
    type: "website",
    url: "https://os.joinleaf.com/resident-managers",
    siteName: "Leaf OS",
    images: [{ url: OG_IMAGE, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Leaf — Neighbors who know each other don't leave",
    description:
      "Done-for-you resident events that build community and drive renewals. Book a demo or start your building's calendar free.",
    images: [OG_IMAGE],
  },
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
