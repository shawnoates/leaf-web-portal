import type { Metadata } from "next";

const TITLE = "Matt's Summer '26 · Leaf";
const DESCRIPTION =
  "Join me for a summer of New York social adventures. From rooftop cocktails and volleyball to comedy nights and beach days — create your own free summer calendar.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://os.joinleaf.com/summer",
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

export default function SummerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
