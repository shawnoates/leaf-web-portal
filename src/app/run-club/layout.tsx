import type { Metadata } from "next";

const TITLE = "Atlanta Run Club · Leaf";
const DESCRIPTION =
  "Join Atlanta's friendliest run club. Sunday long runs, track workouts on the BeltLine, and post-run brunch — all skill levels welcome.";
const OG_IMAGE =
  "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200&q=80";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    url: "https://os.joinleaf.com/run-club",
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

export default function RunClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
