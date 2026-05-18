import type { Metadata } from "next";

const TITLE = "Lincoln Place Residents · Leaf";
const DESCRIPTION =
  "Bring your apartment building to life. Bowling, pickup pickleball, basketball at the park, happy hours, and dinners — a free shared calendar your neighbors will actually use.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://os.joinleaf.com/apartment",
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

export default function ApartmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
