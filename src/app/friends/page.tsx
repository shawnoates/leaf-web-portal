import type { Metadata } from "next";
import FriendsClient from "./FriendsClient";

const DESCRIPTION =
  "Start a crew in a minute. Leaf finds a night that works around everyone's calendars, picks the place, asks who's in, and keeps the group seeing each other. No app needed.";

export const metadata: Metadata = {
  title: "Friend Mode · Leaf",
  description: DESCRIPTION,
  // Its own unfurl, not the site's "Community Calendars" card. The image is
  // ./opengraph-image.tsx.
  openGraph: {
    title: "Friend Mode on Leaf: your friends, actually seeing each other",
    description: DESCRIPTION,
    url: "/friends",
    siteName: "Leaf",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Friend Mode on Leaf: your friends, actually seeing each other",
    description: DESCRIPTION,
  },
};

/** /friends: Friend Mode's landing page, where anyone can start a crew. */
export default function FriendsPage() {
  return <FriendsClient />;
}
