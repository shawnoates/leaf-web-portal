import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./styles.css";

// Absolute URL — iMessage / Slack / Twitter reject relative image paths.
// Reuses the resident-managers gathering photo until a creators-specific
// OG asset is added.
const OG_IMAGE = "https://os.joinleaf.com/resident-managers-hero.png";
const OG_ALT = "People gathered around a table at a real dinner party";

export const metadata: Metadata = {
  metadataBase: new URL("https://os.joinleaf.com"),
  title: "Leaf — Get paid to create content about nights that actually happen.",
  description:
    "Leaf partners with hosts and creators who make real gatherings happen. Plan it through Leaf, film the night, post it in your voice — $50–150 per video, paid within 24 hours. 1k followers is plenty.",
  openGraph: {
    title: "Leaf — Get paid to document a good night.",
    description:
      "Plan a real gathering through Leaf, film what happens, post it in your voice. $50–150 per video, paid within 24h. Partner with us.",
    type: "website",
    url: "https://os.joinleaf.com/creators",
    siteName: "Leaf OS",
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
 * os.joinleaf.com on Tailwind without collisions.
 */
export default function CreatorsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="creators-landing">{children}</div>;
}
