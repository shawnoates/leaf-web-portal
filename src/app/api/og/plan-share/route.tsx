import { ImageResponse } from "next/og";
import Parse from "@/lib/parse";
import { SITE_HOST } from "@/lib/site";

// The card a host posts to a story.
//
// Unlike its siblings in /api/og/*, this one is not an unfurl card — nothing
// scrapes it. A host opens it from their checklist, saves it, and posts it
// themselves, which is why it comes in a 9:16 story size as well as a square.
//
// Same dark-green ground and system type as the rest of /api/og/*. next/og
// rasterizes with Satori, which supports neither external stylesheets nor the
// app's font loader, and every multi-child element must be display:flex.
//
// Params:
//   planId  required, EventGroup objectId
//   format  story (1080x1920, default) | square (1080x1080)
//
// WHAT IS DELIBERATELY NOT ON THIS CARD: the venue. getPlanShareInfo gates the
// venue name and the street address together and gives an anonymous caller
// neither, because a name like "Home" or "My Apt" leaks the same residential
// signal the address does. We call it anonymously — no phoneNumber — so that
// redaction happens by construction rather than by remembering to strip fields
// here. A card destined for a public story is the most anonymous audience
// there is, and plenty of these plans are at somebody's flat. The link shows
// the spot to whoever qualifies to see it.
export const dynamic = "force-dynamic";

const SIZES = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;

type PlanShareInfo = {
  title: string;
  expiryDate: string | null;
  location: { timezone: string | null } | null;
  calendarName: string | null;
  calendarIsPrivate: boolean;
  rsvpCount: number;
  capacity: number | null;
};

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function titleFontSize(title: string, story: boolean): number {
  const base = story ? 1 : 0.82;
  if (title.length <= 28) return Math.round(112 * base);
  if (title.length <= 55) return Math.round(88 * base);
  if (title.length <= 90) return Math.round(68 * base);
  return Math.round(54 * base);
}

// "Thursday, Sep 18" + "7:00 PM", in the VENUE's timezone. A plan's wall clock
// belongs to where it happens, not to where this server runs.
function whenParts(iso: string | null, tz: string | null): { day: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const opts = tz ? { timeZone: tz } : {};
  try {
    return {
      day: new Intl.DateTimeFormat("en-US", {
        ...opts,
        weekday: "long",
        month: "short",
        day: "numeric",
      }).format(d),
      time: new Intl.DateTimeFormat("en-US", {
        ...opts,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(d),
    };
  } catch {
    return null;
  }
}

function goingLine(rsvpCount: number, capacity: number | null): string {
  if (rsvpCount <= 0) return "Be the first to say you're coming";
  const left = capacity && capacity > rsvpCount ? capacity - rsvpCount : null;
  const going = `${rsvpCount} ${rsvpCount === 1 ? "person is" : "people are"} coming`;
  return left ? `${going} · ${left} ${left === 1 ? "spot" : "spots"} left` : going;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId");
  const story = searchParams.get("format") !== "square";
  const size = story ? SIZES.story : SIZES.square;

  let plan: PlanShareInfo | null = null;
  if (planId) {
    try {
      // No phoneNumber, on purpose. See the note at the top of this file.
      plan = (await Parse.Cloud.run("getPlanShareInfo", {
        eventGroupId: planId,
        mode: "invite",
      })) as PlanShareInfo;
    } catch (err) {
      console.error("[/api/og/plan-share] getPlanShareInfo failed:", err);
    }
  }

  // A private calendar's plans are seen after you're let in. The checklist
  // already withholds the share pack for one, but this route is reachable by
  // plan id alone, so it refuses on its own account too.
  if (plan?.calendarIsPrivate) {
    return new Response("Not available", { status: 404 });
  }

  const title = clip(plan?.title || "A plan on Leaf", 110);
  const eyebrow = clip(plan?.calendarName || "Leaf", 38);
  const when = whenParts(plan?.expiryDate ?? null, plan?.location?.timezone ?? null);
  const going = plan ? goingLine(plan.rsvpCount, plan.capacity) : "";

  const pad = story ? "110px 84px" : "84px 76px";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: pad,
          background:
            "linear-gradient(150deg, #253A33 0%, #1a2d27 55%, #0f1f1a 100%)",
          color: "#f4f6f5",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              fontSize: story ? "30px" : "26px",
              fontWeight: 600,
              letterSpacing: "4px",
              textTransform: "uppercase",
              color: "#a7bfa9",
            }}
          >
            {eyebrow}
          </div>
          <div style={{ display: "flex", fontSize: story ? "34px" : "28px", color: "#cfe0d2" }}>
            You&apos;re invited
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: story ? "48px" : "36px" }}>
          <div
            style={{
              display: "flex",
              fontSize: `${titleFontSize(title, story)}px`,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-2px",
            }}
          >
            {title}
          </div>

          {when && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: story ? "46px" : "38px",
                  fontWeight: 600,
                  color: "#f4f6f5",
                }}
              >
                {when.day}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: story ? "42px" : "34px",
                  color: "#a7bfa9",
                }}
              >
                {when.time}
              </div>
            </div>
          )}

          {going && (
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                padding: story ? "18px 34px" : "14px 28px",
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.28)",
                fontSize: story ? "32px" : "27px",
                fontWeight: 500,
              }}
            >
              {going}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              display: "flex",
              fontSize: story ? "38px" : "31px",
              fontWeight: 600,
              color: "#f4f6f5",
            }}
          >
            Tap the link to join
          </div>
          <div
            style={{
              display: "flex",
              fontSize: story ? "32px" : "27px",
              fontWeight: 600,
              color: "#6f7c76",
            }}
          >
            {SITE_HOST}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
