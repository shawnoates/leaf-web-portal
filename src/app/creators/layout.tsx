import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import "./styles.css";

// Absolute URL — iMessage / Slack / Twitter reject relative image paths.
// Dedicated 1200x630 landscape crop (the tall creators-hero.jpg would be
// center-cropped awkwardly in link-preview cards).
const OG_IMAGE = `${SITE_URL}/creators-og.jpg`;
const OG_ALT = "Friends laughing over drinks at a bar";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Leaf — Get paid to document a good night.",
  description:
    "Leaf partners with hosts and creators who make real gatherings happen. Plan it through Leaf, film the night, post it in your voice — $50–150 per video, paid within 24 hours. 1k followers is plenty.",
  openGraph: {
    title: "Leaf — Get paid to document a good night.",
    description:
      "Plan a real gathering through Leaf, film what happens, post it in your voice. $50–150 per video, paid within 24h. Partner with us.",
    type: "website",
    url: `${SITE_URL}/creators`,
    siteName: "Leaf OS",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: OG_ALT,
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Leaf — Get paid to document a good night.",
    description:
      "Plan a real gathering through Leaf, film what happens, post it in your voice. $50–150 per video, paid within 24h.",
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#1b4332",
};

/**
 * Route-scoped layout. The single wrapper div carries the
 * `.creators-landing` class so the imported styles.css (which prefixes
 * every selector with that class) applies only here — leaves the rest of
 * joinleaf.com on Tailwind without collisions.
 */
export default function CreatorsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="creators-landing">{children}</div>;
}
