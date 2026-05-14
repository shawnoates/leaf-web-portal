import type { Metadata } from "next";

const TITLE = "Atlanta Rec League · Leaf";
const DESCRIPTION =
  "Everything around the games — post-game happy hours, pre-season runs, watch parties, captains brunches. The social glue that keeps the league together.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1514820720301-4c4790309f46?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://os.joinleaf.com/rec-league",
    images: [{ url: OG_IMAGE }],
    siteName: "Leaf",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function RecLeagueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
