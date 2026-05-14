import type { Metadata } from "next";

const TITLE = "Atlanta Rec League · Leaf";
const DESCRIPTION =
  "Kickball, softball, volleyball, and flag football across Atlanta. Game nights, tournaments, and bar socials — all skill levels welcome.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1200&q=80";

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
