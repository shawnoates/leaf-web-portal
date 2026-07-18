import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import MeClient from "./MeClient";

// Leaf's dashboard vocabulary: Inter for body, Newsreader (serif) for the
// headings/dates/tiles that carry the brand.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-me-sans",
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
    <div className={`${inter.variable} ${newsreader.variable}`}>
      <MeClient />
    </div>
  );
}
