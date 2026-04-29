import type { Metadata } from "next";

const TITLE = "Gateway Community Church · Leaf";
const DESCRIPTION =
  "A warm community of faith. Sunday services, midweek bible study, small groups, and serving our neighbors together.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://os.joinleaf.com/bible-study",
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

export default function BibleStudyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
