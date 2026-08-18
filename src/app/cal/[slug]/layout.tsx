import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import Parse from "@/lib/parse";
import { findSeed } from "@/lib/aiCalendarSeed";

// /cal/<slug> is a client component (owner editing, adopt flow), so it can't
// export metadata itself. This layout does the server-side lookup and emits
// the Open Graph tags — these links get shared straight out of the /personal
// hero and the /calendars gallery, and without this they unfurled with the
// generic site-wide card.

type AICalendarMeta = {
  title?: string;
  prompt?: string;
  area?: string | null;
  theme?: string | null;
  visibility?: string;
  coverImageUrl?: string | null;
};

async function fetchCalendar(slug: string): Promise<AICalendarMeta | null> {
  // Seed pool first — same resolution order the page uses, and it costs no
  // round trip for the curated gallery slugs.
  const seed = findSeed(slug);
  if (seed) {
    return {
      title: seed.title,
      prompt: seed.prompt,
      area: seed.area,
      theme: seed.theme,
      visibility: "public",
    };
  }
  try {
    return (await Parse.Cloud.run("getAICalendar", { slug })) as AICalendarMeta;
  } catch (err) {
    // Unknown slug throws OBJECT_NOT_FOUND — expected, not worth a stack.
    console.error("[/cal] getAICalendar failed:", err);
    return null;
  }
}

const FALLBACK: Metadata = {
  title: "Leaf — Community Calendar",
  description: "Open this calendar on Leaf.",
};

type LayoutProps = {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({
  params,
}: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const cal = await fetchCalendar(slug);

  // Adopted copies can be private. Don't leak a private calendar's title
  // into an unfurl — anyone who has the link still sees the page itself,
  // but a preview renders wherever the link is pasted.
  if (!cal || !cal.title || (cal.visibility && cal.visibility !== "public")) {
    return FALLBACK;
  }

  const title = cal.title;
  const description =
    cal.prompt ||
    [cal.theme, cal.area].filter(Boolean).join(" · ") ||
    "A calendar of things to do, built on Leaf.";
  // Only declare dimensions for the generated card — we know those. A
  // cover photo's real size is unknown, and a wrong og:image:width makes
  // some unfurlers crop or reject it.
  const image = cal.coverImageUrl
    ? { url: cal.coverImageUrl }
    : { url: "/api/og/default", width: 1200, height: 630 };
  const imageUrl = image.url;

  return {
    title: `${title} · Leaf`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_URL}/cal/${slug}`,
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

export default function CalLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
