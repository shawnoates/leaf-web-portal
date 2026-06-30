import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = {
  title: "Leaf OS for local businesses — Your next regulars live around the corner",
  description:
    "Get your business in front of the residents who live minutes from your door — through their building's community calendar, or an event we fill for you. Post a deal, host an event, or sponsor one.",
  openGraph: {
    title: "Leaf OS — Your next regulars live around the corner",
    description:
      "Reach nearby residents inside the community they trust. Post a deal, host an event, or sponsor one — we bring the people.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
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
