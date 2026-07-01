import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./styles.css";

const OG_IMAGE = "/partners-opportunity.png";
const OG_ALT =
  "A local storefront with neighbors walking up from nearby buildings";

export const metadata: Metadata = {
  title: "Leaf OS for local businesses — Your next regulars live around the corner",
  description:
    "Get your business in front of the residents who live minutes from your door — through their building's community calendar, or an event we fill for you. Post a deal or host an event.",
  openGraph: {
    title: "Leaf OS — Your next regulars live around the corner",
    description:
      "Reach nearby residents inside the community they trust. Post a deal or host an event — we bring the people.",
    type: "website",
    url: "https://os.joinleaf.com/partners",
    siteName: "Leaf OS",
    images: [{ url: OG_IMAGE, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Leaf OS — Your next regulars live around the corner",
    description:
      "Reach nearby residents inside the community they trust. Post a deal or host an event — we bring the people.",
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#1b4332",
};

/**
 * Route-scoped layout. The single wrapper div carries .partner-landing
 * so the imported styles.css (every selector prefixed with that class)
 * stays out of the rest of os.joinleaf.com.
 */
export default function PartnersLayout({ children }: { children: ReactNode }) {
  return <div className="partner-landing">{children}</div>;
}
