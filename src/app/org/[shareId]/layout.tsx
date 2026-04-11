import type { Metadata } from "next";
import Parse from "@/lib/parse";

type OrgShareInfo = {
  name?: string;
  description?: string;
  profilePhoto?: string | null;
  bannerUrl?: string | null;
  orgType?: string | null;
  orgCity?: string | null;
};

async function fetchOrgShareInfo(shareId: string): Promise<OrgShareInfo | null> {
  try {
    const result = (await Parse.Cloud.run("getOrgCalendarPage", {
      shareId,
    })) as OrgShareInfo;
    return result || null;
  } catch (err) {
    console.error("[/org] getOrgCalendarPage failed:", err);
    return null;
  }
}

type LayoutProps = {
  params: Promise<{ shareId: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { shareId } = await params;
  const info = await fetchOrgShareInfo(shareId);

  if (!info) {
    return {
      title: "Leaf — Community Calendar",
      description: "Open this community calendar on Leaf.",
    };
  }

  const title = info.name || "Community Calendar";
  const descParts: string[] = [];
  if (info.orgType) descParts.push(info.orgType);
  if (info.orgCity) descParts.push(info.orgCity);
  const description =
    info.description ||
    (descParts.length > 0
      ? descParts.join(" · ")
      : `Follow ${title} on Leaf to see upcoming plans and RSVP.`);

  // Prefer the banner image (wider, better for link previews) with the
  // profile photo as fallback.
  const imageUrl = info.bannerUrl || info.profilePhoto || null;
  const ogImages = imageUrl ? [{ url: imageUrl }] : undefined;

  return {
    title: `${title} · Leaf`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://os.joinleaf.com/org/${shareId}`,
      images: ogImages,
      siteName: "Leaf",
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export default function OrgLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
