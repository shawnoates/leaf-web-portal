import type { Metadata } from "next";

const TITLE = "Sunset Yoga Co. · Leaf";
const DESCRIPTION =
  "A boutique yoga community. Vinyasa flows, sound baths, outdoor classes, and the people who show up for them.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://os.joinleaf.com/yoga-studio",
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

export default function YogaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
