import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import MeClient from "./MeClient";

// The /me type ramp, per the dashboard handoff spec: IBM Plex Sans for body and
// UI, Newsreader (serif) for headings and plan titles, IBM Plex Mono for the
// small-caps section labels, calendar names, and month abbreviations.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-me-sans",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-me-mono",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400"],
  variable: "--font-me-serif",
});

export const metadata: Metadata = {
  title: "Your plans · Leaf",
  robots: { index: false, follow: false },
};

export default function MePage() {
  return (
    <div className={`${plexSans.variable} ${plexMono.variable} ${newsreader.variable}`}>
      <MeClient />
    </div>
  );
}
