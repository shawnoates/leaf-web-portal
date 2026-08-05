import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// Shared landing design system. /church-leaders is a content variant of
// /resident-managers, not a new design system, so it imports that
// route's stylesheet rather than forking 300 lines of it. Every selector
// in there is rooted at `.rm-landing`, which is why the wrapper below
// carries that class. Church-only additions live in ./styles.css under
// `.ch-landing`.
import "../resident-managers/styles.css";
import "./styles.css";

// Absolute URL — iMessage / Slack / Twitter reject relative image paths.
const OG_IMAGE = "https://os.joinleaf.com/church-leaders-hero.png";
const OG_ALT =
  "A phone showing a church community calendar filled with member-posted gatherings";

const TITLE = "Leaf — The best things at your church never make the calendar.";

export const metadata: Metadata = {
  metadataBase: new URL("https://os.joinleaf.com"),
  title: TITLE,
  description:
    "A free community calendar your members fill in themselves. The hikes, the coffees, the game nights — the life of your church that nobody scheduled. Your staff doesn't maintain it. Nothing to download.",
  openGraph: {
    title: TITLE,
    description:
      "A free calendar your members fill in, not your staff. Live in minutes.",
    type: "website",
    url: "https://os.joinleaf.com/church-leaders",
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
    title: TITLE,
    description:
      "A free calendar your members fill in, not your staff. Live in minutes.",
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#1b4332",
};

export default function ChurchLeadersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="rm-landing ch-landing">{children}</div>;
}
