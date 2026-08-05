import type { Metadata } from "next";
import type { ReactNode } from "react";

const TITLE = "Grace Fellowship · Leaf";
const DESCRIPTION =
  "A church calendar the members fill in themselves — hikes, meal trains, coffee after service, and a few official things too.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1438032005730-c779502df39b?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://os.joinleaf.com/church",
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

export default function ChurchLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
