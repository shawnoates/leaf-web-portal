import type { Metadata } from "next";
import Parse from "@/lib/parse";
import PlanShareRedirect from "./PlanShareRedirect";

type ShareMode = "invite" | "copy";

type PlanShareInfo = {
  mode: ShareMode;
  objectId: string;
  title: string;
  description: string;
  image: string | null;
  expiryDate: string | null;
  location: { name: string; address: string } | null;
  host: { name: string } | null;
  shareId: string | null;
  calendarName: string | null;
  calendarProfilePhoto: string | null;
};

async function fetchPlanShareInfo(
  eventGroupId: string,
  mode: ShareMode
): Promise<PlanShareInfo | null> {
  try {
    const result = (await Parse.Cloud.run("getPlanShareInfo", {
      eventGroupId,
      mode,
    })) as PlanShareInfo;
    return result || null;
  } catch (err) {
    console.error("[/p] getPlanShareInfo failed:", err);
    return null;
  }
}

type PageProps = {
  params: Promise<{ eventGroupId: string }>;
  searchParams: Promise<{ copy?: string }>;
};

function resolveMode(copyParam: string | undefined): ShareMode {
  return copyParam === "1" ? "copy" : "invite";
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { eventGroupId } = await params;
  const { copy } = await searchParams;
  const mode = resolveMode(copy);
  const info = await fetchPlanShareInfo(eventGroupId, mode);

  if (!info) {
    return {
      title: mode === "copy" ? "Leaf — Save this plan" : "Leaf — Join the plan",
      description: mode === "copy"
        ? "Save this plan to your calendar on Leaf."
        : "Open this plan on Leaf.",
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
    (mode === "copy"
      ? "Save this plan to your calendar on Leaf."
      : "Open this plan on Leaf.");

  const ogImages = info.image ? [{ url: info.image }] : undefined;

  const icons = info.calendarProfilePhoto
    ? {
        icon: info.calendarProfilePhoto,
        apple: info.calendarProfilePhoto,
      }
    : undefined;

  const canonicalUrl =
    mode === "copy"
      ? `https://os.joinleaf.com/p/${eventGroupId}?copy=1`
      : `https://os.joinleaf.com/p/${eventGroupId}`;

  return {
    title: `${title} · Leaf`,
    description,
    icons,
    openGraph: {
      title,
      description,
      type: "article",
      url: canonicalUrl,
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

export default async function PlanSharePage({ params, searchParams }: PageProps) {
  const { eventGroupId } = await params;
  const { copy } = await searchParams;
  const mode = resolveMode(copy);
  const info = await fetchPlanShareInfo(eventGroupId, mode);

  // Invite mode: redirect into the calendar context where the plan modal opens.
  // Copy mode: no calendar context — the recipient is forking a recipe, not
  // joining the host's instance. Stay on this page and surface an "Open in app"
  // affordance via the standalone copy view (still to be built; for now we
  // render the OG-tag landing only).
  const destination =
    mode === "invite" && info?.shareId
      ? `/org/${info.shareId}?plan=${eventGroupId}`
      : mode === "invite"
        ? "/"
        : null;

  // We render a 200 response (NOT a server redirect) so OG unfurlers like
  // iMessage / RCS read the plan-specific OG tags from generateMetadata.
  // The client component below redirects real browsers after hydration —
  // only in invite mode, since copy mode has no destination yet.
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
      {destination ? <PlanShareRedirect destination={destination} /> : null}
      {destination ? (
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
      ) : (
        <p style={{ fontSize: 14 }}>
          {info?.title ? <strong>{info.title}</strong> : "A plan on Leaf"}
          <br />
          Open Leaf to save this plan to your calendar.
        </p>
      )}
      {destination ? (
        <noscript>
          <p style={{ fontSize: 12, marginTop: 16 }}>
            <a href={destination} style={{ color: "#18181b" }}>
              Tap here if you are not redirected automatically.
            </a>
          </p>
        </noscript>
      ) : null}
    </div>
  );
}
