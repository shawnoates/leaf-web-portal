import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import "./styles.css";

// Reuses the existing OG asset until the ad creative's own gauge frame is
// exported. Swap this for a still of the score card before spend starts — the
// unfurl is the first impression on every shared reveal.
const OG_IMAGE = `${SITE_URL}/og-default.png`;

const TITLE = "Your community has a score";
const DESCRIPTION =
  "Participation, retention, and who actually shows up. Six questions, about 30 seconds, and you'll see where your community stands.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/score` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: `${SITE_URL}/score`,
    siteName: "Leaf OS",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "A community scorecard showing a 0–100 score and six pillar bars.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// Matches the page's black ground, so the iOS status bar and Android chrome
// don't sit in a white band above a dark hero.
export const viewport: Viewport = { themeColor: "#0a0e0c" };

export default function ScoreLayout({ children }: { children: ReactNode }) {
  return <div className="score-landing">{children}</div>;
}
