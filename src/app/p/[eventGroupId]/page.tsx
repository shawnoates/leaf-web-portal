import type { Metadata } from "next";
import Parse from "@/lib/parse";
import PlanShareRedirect from "./PlanShareRedirect";

type PlanShareInfo = {
  objectId: string;
  title: string;
  description: string;
  image: string | null;
  expiryDate: string | null;
  location: { name: string; address: string } | null;
  host: { name: string } | null;
  shareId: string | null;
  calendarName: string | null;
};

async function fetchPlanShareInfo(
  eventGroupId: string
): Promise<PlanShareInfo | null> {
  try {
    const result = (await Parse.Cloud.run("getPlanShareInfo", {
      eventGroupId,
    })) as PlanShareInfo;
    return result || null;
  } catch (err) {
    console.error("[/p] getPlanShareInfo failed:", err);
    return null;
  }
}

type PageProps = {
  params: Promise<{ eventGroupId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { eventGroupId } = await params;
  const info = await fetchPlanShareInfo(eventGroupId);

  if (!info) {
    return {
      title: "Leaf — Join the plan",
      description: "Open this plan on Leaf.",
    };
  }

  const title = info.title;
  const descParts: string[] = [];
  if (info.host?.name) descParts.push(`Hosted by ${info.host.name}`);
  if (info.location?.name) descParts.push(info.location.name);
  if (info.calendarName) descParts.push(info.calendarName);
  const description =
    info.description ||
    descParts.join(" · ") ||
    "Open this plan on Leaf.";

  const ogImages = info.image ? [{ url: info.image }] : undefined;

  return {
    title: `${title} · Leaf`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://os.joinleaf.com/p/${eventGroupId}`,
      images: ogImages,
      siteName: "Leaf",
    },
    twitter: {
      card: info.image ? "summary_large_image" : "summary",
      title,
      description,
      images: info.image ? [info.image] : undefined,
    },
  };
}

export default async function PlanSharePage({ params }: PageProps) {
  const { eventGroupId } = await params;
  const info = await fetchPlanShareInfo(eventGroupId);

  // Destination: org page with the plan modal pre-opened.
  // If we couldn't resolve a shareId, fall back to home.
  const destination = info?.shareId
    ? `/org/${info.shareId}?plan=${eventGroupId}`
    : "/";

  // We render a 200 response (NOT a server redirect) so OG unfurlers like
  // iMessage / RCS read the plan-specific OG tags from generateMetadata.
  // The client component below redirects real browsers after hydration.
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        textAlign: "center",
        color: "#52525b",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <PlanShareRedirect destination={destination} />
      <p style={{ fontSize: 14 }}>
        Opening{" "}
        <a
          href={destination}
          style={{ color: "#18181b", textDecoration: "underline" }}
        >
          {info?.title || "the plan"}
        </a>
        …
      </p>
      <noscript>
        <p style={{ fontSize: 12, marginTop: 16 }}>
          <a href={destination} style={{ color: "#18181b" }}>
            Tap here if you are not redirected automatically.
          </a>
        </p>
      </noscript>
    </div>
  );
}
