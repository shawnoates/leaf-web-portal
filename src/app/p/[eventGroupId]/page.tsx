import type { Metadata } from "next";
import { cookies } from "next/headers";
import Parse from "@/lib/parse";
import PlanShareRedirect from "./PlanShareRedirect";
import StandalonePlanCard from "./StandalonePlanCard";

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
  calendarIsPrivate: boolean;
  viewerIsFollower: boolean;
  calendarProfilePhoto: string | null;
  requireApproval: boolean;
};

async function fetchPlanShareInfo(
  eventGroupId: string,
  mode: ShareMode,
  phoneNumber: string | null
): Promise<PlanShareInfo | null> {
  try {
    const params: { eventGroupId: string; mode: ShareMode; phoneNumber?: string } = {
      eventGroupId,
      mode,
    };
    if (phoneNumber) params.phoneNumber = phoneNumber;
    const result = (await Parse.Cloud.run("getPlanShareInfo", params)) as PlanShareInfo;
    return result || null;
  } catch (err) {
    console.error("[/p] getPlanShareInfo failed:", err);
    return null;
  }
}

// Reads the visitor's verified phone from cookies. Prefers the persistent,
// calendar-independent `leaf_verified_user` cookie (set on every OTP success;
// see lib/verified-user.ts). Falls back to the calendar-scoped `leaf_follower`
// cookie so visitors who only have the legacy cookie still get recognized.
async function readViewerPhone(): Promise<string | null> {
  try {
    const store = await cookies();
    const verified = store.get("leaf_verified_user");
    if (verified?.value) {
      const parsed = JSON.parse(decodeURIComponent(verified.value)) as {
        phone?: string;
      };
      if (parsed.phone) return parsed.phone;
    }
    const follower = store.get("leaf_follower");
    if (follower?.value) {
      const parsed = JSON.parse(decodeURIComponent(follower.value)) as {
        phone?: string;
      };
      if (parsed.phone) return parsed.phone;
    }
    return null;
  } catch {
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
  // No phone in generateMetadata — OG tags should reflect the public preview,
  // not the personalized landing. The page handler does the follower check.
  const info = await fetchPlanShareInfo(eventGroupId, mode, null);

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
  const phoneNumber = await readViewerPhone();
  const info = await fetchPlanShareInfo(eventGroupId, mode, phoneNumber);

  // Resolution: how should this page present?
  //  - invite + public calendar OR known follower → redirect into
  //    /org/<shareId>?plan=<id> (auto-opens plan modal in calendar context)
  //  - invite + private calendar + viewer not following → request-to-follow
  //    scrim with blurred details
  //  - invite + no calendar      → standalone plan card with "Open in Leaf"
  //  - copy mode                 → recipe card with "Save this plan in Leaf"
  //  - missing info              → minimal fallback
  if (!info) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 py-16 text-center text-zinc-500 text-sm">
        This plan is no longer available.
      </div>
    );
  }

  const isPrivateForViewer =
    info.calendarIsPrivate && !info.viewerIsFollower;
  if (mode === "invite" && info.shareId && !isPrivateForViewer) {
    const destination = `/org/${info.shareId}?plan=${eventGroupId}`;
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
            {info.title || "the plan"}
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

  const variant: "standalone" | "copy" | "privateCalendar" =
    mode === "copy"
      ? "copy"
      : isPrivateForViewer && info.shareId
        ? "privateCalendar"
        : "standalone";

  return (
    <StandalonePlanCard
      variant={variant}
      eventGroupId={eventGroupId}
      title={info.title}
      description={info.description}
      image={info.image}
      expiryDate={info.expiryDate}
      location={info.location}
      hostName={info.host?.name ?? null}
      calendarName={info.calendarName}
      calendarProfilePhoto={info.calendarProfilePhoto}
      shareId={info.shareId}
      requireApproval={info.requireApproval}
    />
  );
}
