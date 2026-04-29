import type { Metadata } from "next";

const TITLE = "Brooklyn Moms Club · Leaf";
const DESCRIPTION =
  "A neighborhood community for moms. Stroller walks, playground meetups, mom's night out, and the village every parent deserves.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1607081692251-3eef061ba2bb?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://os.joinleaf.com/moms-club",
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

export default function MomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
