import { ImageResponse } from "next/og";
import Parse from "@/lib/parse";
import { SITE_HOST } from "@/lib/site";

// The card a host posts.
//
// Unlike its siblings in /api/og/*, nothing scrapes this one. A host opens it
// from their share kit, saves it, and posts it themselves — which is why it
// comes as a 4:5 feed post and a 9:16 story rather than a 1200x630 unfurl.
//
// Design: the plan's own photo, full bleed, under a dark gradient; a heavy
// grotesk headline with the neighborhood in a highlighter block; the plan
// title; the URL big enough to read off a screenshot. When the plan has no
// photo the same layout sits on the house green.
//
// Params:
//   planId  required, EventGroup objectId
//   format  post (1080x1350, default) | story (1080x1920) | square (1080x1080)
//   phase   before (default: "join me") | after ("we did it")
//
// WHAT IS DELIBERATELY NOT ON THIS CARD: the venue. getPlanShareInfo gates the
// venue name and the street address together and gives an anonymous caller
// neither, because a name like "Home" or "My Apt" leaks the same residential
// signal the address does. We call it anonymously — no phoneNumber — so that
// redaction happens by construction rather than by remembering to strip fields
// here. The NEIGHBORHOOD is the coarse "where" a stranger can safely have, and
// it is what the card leads with.
//
// Satori (what next/og rasterizes with) supports neither external stylesheets
// nor the app's font loader, and every multi-child element must be
// display:flex. The headline font is fetched once from this deployment's own
// /fonts/ and cached; if that fails the card falls back to system type rather
// than failing to render.
export const dynamic = "force-dynamic";

const SIZES = {
  post: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const;
type Format = keyof typeof SIZES;

const HIGHLIGHT = "#F5C518";
const INK = "#0f1f1a";

type PlanShareInfo = {
  title: string;
  image: string | null;
  expiryDate: string | null;
  location: { timezone: string | null } | null;
  calendarName: string | null;
  calendarIsPrivate: boolean;
  neighborhood?: string | null;
  rsvpCount: number;
  capacity: number | null;
};

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

let fontCache: Promise<ArrayBuffer | null> | null = null;
function loadHeadlineFont(origin: string): Promise<ArrayBuffer | null> {
  if (!fontCache) {
    fontCache = fetch(new URL("/fonts/Inter-ExtraBold.ttf", origin))
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null)
      .then((buf) => {
        // Don't pin a failure: the next request tries again.
        if (!buf) fontCache = null;
        return buf;
      });
  }
  return fontCache;
}

// The photo is fetched here rather than handed to Satori as a URL, so a dead
// link (Google Places photo URLs perish) degrades to the plain card instead of
// failing the whole render. Capped so a giant original can't stall the route.
const PHOTO_MAX_BYTES = 6 * 1024 * 1024;
async function loadPhoto(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > PHOTO_MAX_BYTES) return null;
    return `data:${type};base64,${Buffer.from(buf).toString("base64")}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

// "Sun, Sep 20 · 2:30 PM", in the VENUE's timezone.
function whenLabel(iso: string | null, tz: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const opts = tz ? { timeZone: tz } : {};
  try {
    const day = new Intl.DateTimeFormat("en-US", {
      ...opts,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(d);
    const time = new Intl.DateTimeFormat("en-US", {
      ...opts,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
    return `${day} · ${time}`;
  } catch {
    return null;
  }
}

// The headline as a list of words, some highlighted. Satori has no inline
// background on a text run, so each word is its own flex box.
type Word = { text: string; hi: boolean };
function headline(phase: "before" | "after", hood: string | null): Word[] {
  const plain = (s: string) => s.split(" ").map((text) => ({ text, hi: false }));
  const hi = (s: string) => s.split(" ").map((text) => ({ text, hi: true }));
  if (phase === "after") {
    return hood ? [...hi(hood), ...plain("came out.")] : [...hi("We did it.")];
  }
  return hood ? [...plain("Join me in"), ...hi(hood)] : [...hi("Join me.")];
}

function bodyLine(phase: "before" | "after", going: number): string {
  if (phase === "after") {
    return going >= 2
      ? `${going} of us made it. The next one's on the calendar.`
      : "The next one's already on the calendar.";
  }
  if (going >= 2) return `${going} people are in already. Small thing, no pressure.`;
  return "Small thing, no pressure, just turn up.";
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const url = new URL(request.url);
  const planId = url.searchParams.get("planId");
  const formatParam = url.searchParams.get("format");
  const format: Format = formatParam && formatParam in SIZES ? (formatParam as Format) : "post";
  const phase: "before" | "after" = url.searchParams.get("phase") === "after" ? "after" : "before";
  const size = SIZES[format];
  const story = format === "story";

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

  // A private calendar's plans are seen after you're let in. The share kit
  // already refuses for one, but this route is reachable by plan id alone, so
  // it refuses on its own account too.
  if (plan?.calendarIsPrivate) {
    return new Response("Not available", { status: 404 });
  }

  const [font, photo] = await Promise.all([
    loadHeadlineFont(url.origin),
    loadPhoto(plan?.image ?? null),
  ]);

  const hood = plan?.neighborhood ? clip(plan.neighborhood, 26) : null;
  const words = headline(phase, hood);
  const title = clip(plan?.title || "A plan on Leaf", 70);
  const when = phase === "before" ? whenLabel(plan?.expiryDate ?? null, plan?.location?.timezone ?? null) : null;
  const body = bodyLine(phase, plan?.rsvpCount ?? 0);
  const shownUrl = planId ? `${SITE_HOST}/p/${planId}` : SITE_HOST;

  // Type scale per format. Story has the height to go bigger.
  const s = story ? 1.18 : 1;
  const headSize = Math.round((words.map((w) => w.text).join(" ").length > 18 ? 84 : 100) * s);
  const titleSize = Math.round(46 * s);
  const bodySize = Math.round(32 * s);
  const urlSize = Math.round(34 * s);
  const pad = story ? 84 : 72;

  const fontFamily = font ? "Inter, system-ui, sans-serif" : "system-ui, -apple-system, sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: "linear-gradient(150deg, #253A33 0%, #1a2d27 55%, #0f1f1a 100%)",
          color: "#ffffff",
          fontFamily,
        }}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            width={size.width}
            height={size.height}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        {/* The gradient that makes white type legible on any photo. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            background: photo
              ? "linear-gradient(to bottom, rgba(15,31,26,0.10) 0%, rgba(15,31,26,0.35) 40%, rgba(15,31,26,0.92) 68%, rgba(15,31,26,0.98) 100%)"
              : "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 100%)",
          }}
        />

        {/* Top row: calendar name and the wordmark. */}
        <div
          style={{
            position: "absolute",
            top: pad,
            left: pad,
            right: pad,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: Math.round(26 * s),
              fontWeight: 800,
              letterSpacing: "4px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {clip(plan?.calendarName || "Leaf", 34)}
          </div>
          <div style={{ display: "flex", fontSize: Math.round(40 * s), fontWeight: 800, letterSpacing: "-1px" }}>
            <span>leaf</span>
            <span style={{ color: HIGHLIGHT }}>.</span>
          </div>
        </div>

        {/* Bottom block: headline, title, when, body, url. */}
        <div
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            bottom: pad,
            display: "flex",
            flexDirection: "column",
            gap: Math.round(22 * s),
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              rowGap: 6,
              fontSize: headSize,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-3px",
            }}
          >
            {words.map((w, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  padding: w.hi ? "0 18px" : "0 8px 0 0",
                  marginRight: w.hi ? 10 : 0,
                  backgroundColor: w.hi ? HIGHLIGHT : "transparent",
                  color: w.hi ? INK : "#ffffff",
                }}
              >
                {w.text}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: "-1px",
              color: "#ffffff",
            }}
          >
            {title}
          </div>

          {when && (
            <div
              style={{
                display: "flex",
                fontSize: Math.round(34 * s),
                fontWeight: 800,
                color: HIGHLIGHT,
              }}
            >
              {when}
            </div>
          )}

          <div
            style={{
              display: "flex",
              fontSize: bodySize,
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.86)",
            }}
          >
            {body}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 14,
              marginTop: Math.round(10 * s),
              fontSize: urlSize,
              fontWeight: 800,
            }}
          >
            <div style={{ display: "flex", color: HIGHLIGHT }}>{shownUrl}</div>
            <div style={{ display: "flex", color: "rgba(255,255,255,0.6)", fontSize: Math.round(24 * s) }}>
              ·
            </div>
            <div style={{ display: "flex", color: "rgba(255,255,255,0.9)", fontSize: Math.round(26 * s) }}>
              Link in bio
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(font
        ? { fonts: [{ name: "Inter", data: font, weight: 800 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
