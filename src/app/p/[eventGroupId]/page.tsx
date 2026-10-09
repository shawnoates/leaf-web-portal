import type { Metadata } from "next";
import { cookies } from "next/headers";
import Parse from "@/lib/parse";
import { APP_LINK_URL, SITE_URL } from "@/lib/site";
import PlanShareRedirect from "./PlanShareRedirect";
import ArrivalTracker from "./ArrivalTracker";
import StandalonePlanCard from "./StandalonePlanCard";
import { planLifecycle } from "@/lib/wall-clock";

type ShareMode = "invite" | "copy";

type PlanShareInfo = {
  mode: ShareMode;
  objectId: string;
  title: string;
  description: string;
  image: string | null;
  // What the Home plan card shows: video frame → event image → venue photo.
  // Preferred over `image`, which for imported plans is a thumbnail with a
  // play button burned in. Optional until the server ships it.
  heroImage?: string | null;
  /** A night a business made for Leaf. */
  onlyOnLeaf?: { with: string | null } | null;
  /** Booked on the business's own site (a placard idea on one of its classes). */
  bookingUrl?: string | null;
  // The invitation video's HLS stream, when the plan has one.
  videoUrl?: string | null;
  expiryDate: string | null;
  // Both `name` and `address` are null when the viewer hasn't proven
  // they belong on the guest list — `getPlanShareInfo` redacts the whole
  // pair for anonymous and pending-approval viewers (a venue name like
  // "Home" leaks the same signal the street address does). Only
  // attendees (Accepted/Owned) and approved followers/owners see them
  // inline.
  location: { name: string | null; address: string | null; timezone: string | null } | null;
  // The host's exact meeting spot, gated with the address (null before RSVP).
  meetingSpot?: string | null;
  host: {
    name: string;
    // The plan's own host's photo and hello (intro-video.js); absent from
    // servers that predate them.
    photoUrl?: string | null;
    introVideo?: { url: string; posterUrl: string | null; aspectRatio?: string | null } | null;
  } | null;
  // The assigned roster host — the person who will physically be there, as
  // distinct from `host` (whose plan it is). Null when none is assigned.
  rosterHost: {
    name: string;
    photoUrl: string | null;
    bio: string;
    introVideo?: { url: string; posterUrl: string | null; aspectRatio?: string | null } | null;
  } | null;
  shareId: string | null;
  calendarName: string | null;
  calendarIsPrivate: boolean;
  viewerIsFollower: boolean;
  viewerIsAttendee: boolean;
  calendarProfilePhoto: string | null;
  requireApproval: boolean;
  rsvpCount: number;
  capacity: number | null;
  /** Host collects peer to peer (Venmo/Cash App/PayPal/Zelle): price per spot. */
  p2pAmountCents?: number | null;
  p2pSplit?: import("@/lib/p2p").P2pSplitSummary | null;
  // Cross-promotion (only when the link carried a valid ?via=): the shared-
  // with calendar to bounce into, and its id for RSVP attribution.
  viaShareId?: string | null;
  viaCalendarId?: string | null;
  viaCalendarName?: string | null;
};

async function fetchPlanShareInfo(
  eventGroupId: string,
  mode: ShareMode,
  phoneNumber: string | null,
  via?: string | null,
): Promise<PlanShareInfo | null> {
  try {
    const params: { eventGroupId: string; mode: ShareMode; phoneNumber?: string; via?: string } = {
      eventGroupId,
      mode,
    };
    if (phoneNumber) params.phoneNumber = phoneNumber;
    if (via) params.via = via;
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
  // `src` is share attribution (e.g. host_share from the host share kit). It
  // is recorded as a web event and otherwise ignored.
  // `via` is cross-promotion: the calendar whose page the link was copied
  // from. When an accepted promotion backs it, the redirect lands there.
  // `i` is a personal invite code (cloud/plan-invites.js): a friend texted
  // this link. It rides through the redirects so the RSVP is credited and a
  // held seat is claimed, and it names the friend in the unfurl.
  searchParams: Promise<{ copy?: string; rsvp?: string; src?: string; via?: string; i?: string }>;
};

const INVITE_CODE = /^[A-Za-z0-9]{4,16}$/;

/** "&i=CODE" for a well-formed invite code, else "". */
function inviteSuffix(i: string | undefined): string {
  return i && INVITE_CODE.test(i) ? `&i=${encodeURIComponent(i)}` : "";
}

/** Who sent a personal invite link, for the unfurl title. Never throws. */
async function fetchInviteHeadline(eventGroupId: string, i: string | undefined): Promise<string | null> {
  if (!i || !INVITE_CODE.test(i)) return null;
  try {
    const r = (await Parse.Cloud.run("getPlanInvite", { code: i, eventGroupId })) as {
      found?: boolean;
      inviterFirstName?: string;
      holdsSeat?: boolean;
      status?: string;
    } | null;
    if (!r?.found || !r.inviterFirstName) return null;
    return r.holdsSeat ? `${r.inviterFirstName} saved you a spot` : `${r.inviterFirstName} invited you`;
  } catch {
    return null;
  }
}

function resolveMode(copyParam: string | undefined): ShareMode {
  return copyParam === "1" ? "copy" : "invite";
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { eventGroupId } = await params;
  const { copy, i } = await searchParams;
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

  // A personal invite leads with the sender: in an iMessage bubble the title
  // is the one line people read, and a friend's name is what gets the tap.
  const inviteHeadline = mode === "invite" ? await fetchInviteHeadline(eventGroupId, i) : null;
  const title = inviteHeadline ? `${inviteHeadline}: ${info.title}` : info.title;
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

  // Always emit an og:image at the 1200x630 size iMessage / Slack expect.
  // When the plan has no cover photo, fall back to /api/og/plan-fallback,
  // which renders a Leaf-branded card. Without an explicit og:image,
  // iMessage falls through to apple-touch-icon at the wrong dimensions and
  // renders a giant empty grey preview bubble.
  const ogImageUrl = unfurlSized(info.heroImage ?? info.image) ?? `${SITE_URL}/api/og/plan-fallback`;

  // APP_LINK_URL, not SITE_URL: this is the one route shipped iOS builds
  // intercept as a Universal Link, and they only claim os.joinleaf.com. An
  // unfurler that re-resolves og:url would otherwise hand recipients a host
  // the installed app ignores.
  const canonicalUrl =
    mode === "copy"
      ? `${APP_LINK_URL}/p/${eventGroupId}?copy=1`
      : `${APP_LINK_URL}/p/${eventGroupId}${inviteHeadline && i ? `?i=${encodeURIComponent(i)}` : ""}`;

  return {
    title: `${title} · Leaf`,
    description,
    // Conditionally spread — Next.js metadata merging is shallow, so
    // including `icons: undefined` would clobber the root layout's
    // /favicon.png and leave the tab iconless. Only override when the
    // calendar has its own profile photo to use as the favicon.
    ...(info.calendarProfilePhoto && {
      icons: {
        icon: info.calendarProfilePhoto,
        apple: info.calendarProfilePhoto,
      },
    }),
    openGraph: {
      title,
      description,
      type: "article",
      url: canonicalUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      siteName: "Leaf",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

// A Mux frame comes sized for the app's card; ask for the 1200x630 the
// unfurlers expect instead of letting them squash a 16:9 frame. Other hosts
// are passed through as they are.
function unfurlSized(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname !== "image.mux.com") return url;
    u.searchParams.set("width", "1200");
    u.searchParams.set("height", "630");
    u.searchParams.set("fit_mode", "smartcrop");
    return u.toString();
  } catch {
    return url;
  }
}

export default async function PlanSharePage({ params, searchParams }: PageProps) {
  const { eventGroupId } = await params;
  const { copy, rsvp, src, via, i } = await searchParams;
  const mode = resolveMode(copy);
  const autoOpenRsvp = rsvp === "1";
  const phoneNumber = await readViewerPhone();
  const info = await fetchPlanShareInfo(eventGroupId, mode, phoneNumber, via ?? null);

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
  // Cross-promotion: the viewer found this plan on another calendar's page;
  // send them back there. Only public calendars can receive shares, so the
  // private-calendar scrim never applies on this branch.
  if (mode === "invite" && info.viaShareId) {
    const destination = `/org/${info.viaShareId}?plan=${eventGroupId}${inviteSuffix(i)}`;
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
        <ArrivalTracker src={src ?? `via:${info.viaCalendarId ?? ""}`} planId={eventGroupId} />
        <PlanShareRedirect destination={destination} />
        <p style={{ fontSize: 14 }}>
          Opening{" "}
          <a href={destination} style={{ color: "#18181b", textDecoration: "underline" }}>
            {info.title || "the plan"}
          </a>
          …
        </p>
      </div>
    );
  }
  if (mode === "invite" && info.shareId && !isPrivateForViewer) {
    const destination = `/org/${info.shareId}?plan=${eventGroupId}${inviteSuffix(i)}`;
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
        {/* Before the redirect in tree order so its effect fires first. */}
        <ArrivalTracker src={src} planId={eventGroupId} />
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

  // Evaluated per request (cookies() makes this page dynamic), so the
  // client never has to compare wall clocks and risk a hydration mismatch.
  const rsvpClosed = planLifecycle(info.expiryDate) !== "upcoming";

  const variant: "standalone" | "copy" | "privateCalendar" =
    mode === "copy"
      ? "copy"
      : isPrivateForViewer && info.shareId
        ? "privateCalendar"
        : "standalone";

  return (
    <>
    <ArrivalTracker src={src} planId={eventGroupId} />
    <StandalonePlanCard
      variant={variant}
      eventGroupId={eventGroupId}
      title={info.title}
      description={info.description}
      image={info.heroImage ?? info.image}
      videoUrl={info.videoUrl ?? null}
      expiryDate={info.expiryDate}
      location={info.location}
      meetingSpot={info.meetingSpot ?? null}
      hostName={info.host?.name ?? null}
      hostIntro={info.host ? { photoUrl: info.host.photoUrl ?? null, introVideo: info.host.introVideo ?? null } : null}
      rosterHost={info.rosterHost ?? null}
      calendarName={info.calendarName}
      calendarProfilePhoto={info.calendarProfilePhoto}
      onlyOnLeaf={info.onlyOnLeaf ?? null}
      shareId={info.shareId}
      requireApproval={info.requireApproval}
      rsvpCount={info.rsvpCount ?? 0}
      capacity={info.capacity ?? null}
      p2pAmountCents={info.p2pAmountCents ?? null}
      p2pSplit={info.p2pSplit ?? null}
      rsvpClosed={rsvpClosed}
      autoOpenRsvp={autoOpenRsvp && !rsvpClosed}
    />
    </>
  );
}
