import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import Parse from "@/lib/parse";

type OrgShareInfo = {
  name?: string;
  description?: string;
  profilePhoto?: string | null;
  bannerUrl?: string | null;
  orgType?: string | null;
  orgCity?: string | null;
  plans?: { image?: string }[];
  planIdeas?: { image?: string }[];
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

  // Prefer the banner image (wider, better for link previews), then profile
  // photo, then the first plan or idea image as fallback.
  const firstPlanImage = info.plans?.find((p) => p.image)?.image;
  const firstIdeaImage = info.planIdeas?.find((p) => p.image)?.image;
  const calendarImage = info.bannerUrl || info.profilePhoto || firstPlanImage || firstIdeaImage;
  // Metadata merging is shallow per-key, so exporting `openGraph` here replaces
  // the root layout's wholesale — including its default card. Without an
  // explicit fallback a calendar with no imagery of its own unfurls with no
  // og:image at all. Only declare dimensions for the generated card, since we
  // know those; a real photo's size is unknown and a wrong og:image:width makes
  // some unfurlers crop or reject it.
  const image = calendarImage
    ? { url: calendarImage }
    : { url: "/api/og/default", width: 1200, height: 630 };
  const imageUrl = image.url;

  const icons = info.profilePhoto
    ? {
        icon: info.profilePhoto,
        apple: info.profilePhoto,
      }
    : undefined;

  return {
    title: `${title} · Leaf`,
    description,
    icons,
    openGraph: {
      title,
      description,
      type: "website",
      // Must be the www host. The apex joinleaf.com 308s to www, and
      // unfurlers that re-resolve og:url take a second hop for nothing.
      url: `${SITE_URL}/org/${shareId}`,
      images: [image],
      siteName: "Leaf",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function OrgLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
