import type { Metadata } from "next";

const TITLE = "Maple Heights Neighbors · Leaf";
const DESCRIPTION =
  "Bring your neighborhood together. Block parties, porch concerts, park potlucks, and cleanup days — a free shared calendar your neighbors will actually use.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "/neighborhood",
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

export default function NeighborhoodLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
