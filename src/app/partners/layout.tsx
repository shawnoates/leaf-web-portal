import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import "./styles.css";

// Absolute URL — iMessage / Slack / Twitter reject relative image paths
// and skip the preview card entirely. Next.js needs an explicit
// metadataBase to convert relative paths to absolute at build time; we
// set both so the OG tags render as fully qualified URLs regardless of
// which layout is authoritative in the app tree.
const OG_IMAGE = `${SITE_URL}/partners-opportunity.png`;
const OG_ALT =
  "A local storefront with neighbors walking up from nearby buildings";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Leaf OS for local businesses — Your next regulars live around the corner",
  description:
    "Get your business in front of the residents who live minutes from your door — through their building's community calendar, or an event we fill for you. Post a deal or host an event.",
  openGraph: {
    title: "Leaf OS — Your next regulars live around the corner",
    description:
      "Reach nearby residents inside the community they trust. Post a deal or host an event — we bring the people.",
    type: "website",
    url: `${SITE_URL}/partners`,
    siteName: "Leaf OS",
    // width/height help iMessage + Twitter render the large card
    // without probing the image bytes first.
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: OG_ALT,
        type: "image/png",
      },
    ],
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
 * stays out of the rest of joinleaf.com.
 */
export default function PartnersLayout({ children }: { children: ReactNode }) {
  return <div className="partner-landing">{children}</div>;
}
