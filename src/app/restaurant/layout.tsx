import type { Metadata } from "next";

const TITLE = "Landmark Cevicheria · Leaf";
const DESCRIPTION =
  "One venue, a whole calendar of nights. Mezcal flights, ceviche masterclasses, patio brunches, live Latin jazz, and chef's table dinners — a free calendar your regulars will actually follow.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://os.joinleaf.com/restaurant",
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

export default function RestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
