import { ImageResponse } from "next/og";
import qrcode from "qrcode-generator";
import Parse from "@/lib/parse";
import { SITE_HOST, SITE_URL } from "@/lib/site";

// The card a host posts.
//
// Unlike its siblings in /api/og/*, nothing scrapes this one. A host opens it
// from their share kit, saves it, and posts it themselves — which is why it
// comes as a 4:5 feed post and a 9:16 story rather than a 1200x630 unfurl.
//
// Design: the plan's own photo, full bleed, under a dark gradient; a heavy
// grotesk headline with the neighborhood in a highlighter block; the plan
// title; the URL big enough to read off a screenshot; a QR code for everyone
// who won't type it. When the plan has no photo the same layout sits on the
// house green.
//
// The QR is the only link a feed post has: Instagram doesn't linkify captions
// and only stories take a link sticker. Before the night it encodes the
// measured plan share URL with its own src, so scans and sticker taps are
// separate lines in plan_share_arrival. After the night it encodes the
// calendar page instead — the plan is over, and "join" would be a lie.
//
// Params:
//   planId  required, EventGroup objectId
//   format  post (1080x1350, default) | story (1080x1920) | square (1080x1080)
//   phase   before (default: "join me") | after ("we did it")
//   photo   optional, an image URL to sit behind the type instead of the
//           plan's own — the share kit passes a photo from the night here so
//           a recap post still carries the headline, the link and the QR.
//           Host-allowlisted: this route fetches whatever it's handed, and an
//           open fetcher on our origin is an SSRF, so only our own file hosts
//           are honoured. Anything else falls back to the plan's photo.
//   bg      photo (default) | none — `none` renders the type, the scrim and
//           the QR on a TRANSPARENT background, for the kit to composite a
//           camera-roll photo under in the browser. That photo is never
//           uploaded, which is the whole reason the compositing happens
//           there and not here.
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
  /** The Home plan card's image: video frame → event image → venue photo. */
  heroImage?: string | null;
  expiryDate: string | null;
  location: { timezone: string | null } | null;
  calendarName: string | null;
  calendarIsPrivate: boolean;
  /** The calendar's public id, for /org/<shareId>. Null off-calendar. */
  shareId?: string | null;
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
// failing the whole render. Capped so a giant original can't stall the route —
// generously, because a `photo` handed in by the kit is a phone photo straight
// off a camera roll and dropping it would silently show the green card instead.
const PHOTO_MAX_BYTES = 12 * 1024 * 1024;

// Where a `photo` may come from. Parse files live in our S3 bucket
// (directAccess), so that host plus the Parse mount covers every photo the
// share pack hands out; Mux is here because a plan's hero can be a video
// frame. Nothing else is fetched, whoever asks.
const PHOTO_HOSTS = ["leaf-storage.s3.us-west-2.amazonaws.com", "image.mux.com"];

function allowedPhoto(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (PHOTO_HOSTS.includes(u.hostname)) return u.toString();
    // A Parse file served by the API itself rather than straight from S3.
    const parse = new URL(process.env.NEXT_PUBLIC_PARSE_SERVER_URL || "https://api.getleaflets.co/parse");
    if (u.hostname === parse.hostname && u.pathname.includes("/files/")) return u.toString();
    return null;
  } catch {
    return null;
  }
}

// A Mux frame arrives sized for the app's 16:9 card. The story is 9:16 and
// the post 4:5, so ask Mux for the card's own size rather than upscaling a
// 720-tall frame to 1920. Same frame, cropped by Mux's smartcrop.
function sizedForCard(url: string, size: { width: number; height: number }): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "image.mux.com") return url;
    u.searchParams.set("width", String(size.width));
    u.searchParams.set("height", String(size.height));
    u.searchParams.set("fit_mode", "smartcrop");
    return u.toString();
  } catch {
    return url;
  }
}

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

// The "before" card carries no body line: headline, title, when, URL. The
// going count and the "no pressure" reassurance read as filler under the
// headline, and the caption already says both. The "after" card carries no
// headcount either: rsvpCount is who said yes, not who came, and a number
// the host didn't write is a claim they'd have to stand behind.
function bodyLine(phase: "before" | "after"): string | null {
  if (phase !== "after") return null;
  return "The next one's already on the calendar.";
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

  // What sits behind the type. A `photo` from the kit wins — the host picked
  // it. Otherwise the Home card's image, so the post looks like the plan the
  // host knows (`image` alone is the fallback for a server that predates
  // `heroImage`). `bg=none` fetches nothing: the browser supplies the photo.
  const transparent = url.searchParams.get("bg") === "none";
  const hero = allowedPhoto(url.searchParams.get("photo")) ?? plan?.heroImage ?? plan?.image ?? null;
  const [font, photo] = await Promise.all([
    loadHeadlineFont(url.origin),
    transparent ? null : loadPhoto(hero ? sizedForCard(hero, size) : null),
  ]);
  // A transparent card is about to have a photo drawn under it, so it takes
  // the scrim that keeps white type legible on one.
  const overPhoto = Boolean(photo) || transparent;

  const hood = plan?.neighborhood ? clip(plan.neighborhood, 26) : null;
  const words = headline(phase, hood);
  const title = clip(plan?.title || "A plan on Leaf", 70);
  const when = phase === "before" ? whenLabel(plan?.expiryDate ?? null, plan?.location?.timezone ?? null) : null;
  const body = bodyLine(phase);

  // Where the card sends people. Before the night, the plan. After it, the
  // CALENDAR: the plan has ended, so a link that lands on it offers a join
  // for something nobody can join, and what the post is actually saying is
  // "there's a next one". A plan with no calendar keeps the plan link.
  const after = phase === "after";
  const calendarPath = after && plan?.shareId ? `/org/${encodeURIComponent(plan.shareId)}` : null;
  const shownUrl = calendarPath
    ? `${SITE_HOST}${calendarPath}`
    : planId
      ? `${SITE_HOST}/p/${planId}`
      : SITE_HOST;

  // Type scale per format. Story has the height to go bigger.
  const s = story ? 1.18 : 1;
  // The text column shares the bottom row with the QR tile, and a highlighted
  // word can't wrap, so a long neighborhood drops the headline a step.
  const longestWord = Math.max(...words.map((w) => w.text.length));
  const headSize = Math.round(
    (longestWord > 9 ? 72 : words.map((w) => w.text).join(" ").length > 18 ? 84 : 100) * s,
  );

  // Not qrcode.react: Satori can't run a component with hooks, and Next
  // refuses react-dom/server in a route handler, so the code comes from a
  // plain encoder as an SVG string and goes in as an image. /share/p keeps a
  // scan in Safari the way a sticker tap is, and forwards src.
  const qrUrl = calendarPath
    ? `${SITE_URL}${calendarPath}?src=host_share_qr`
    : planId
      ? `${SITE_URL}/share/p/${planId}?src=host_share_qr`
      : SITE_URL;
  const qrLabel = after ? "Scan for what's next" : "Scan to join";
  const qrSize = Math.round(190 * s);
  const qr = qrcode(0, "M");
  qr.addData(qrUrl);
  qr.make();
  const qrSvg = qr.createSvgTag({ cellSize: 4, margin: 0 });
  const qrSrc = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;
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
          background: transparent
            ? "transparent"
            : "linear-gradient(150deg, #253A33 0%, #1a2d27 55%, #0f1f1a 100%)",
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
            background: overPhoto
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

        {/* Bottom row: the text column, then the QR tile. */}
        <div
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            bottom: pad,
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            gap: Math.round(36 * s),
          }}
        >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: Math.round(22 * s),
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
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
                  padding: w.hi ? "0 18px" : "0 22px 0 0",
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

          {body && (
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
          )}

          <div
            style={{
              display: "flex",
              marginTop: Math.round(10 * s),
              fontSize: urlSize,
              fontWeight: 800,
              color: HIGHLIGHT,
            }}
          >
            {shownUrl}
          </div>
        </div>

        {/* QR tile. White quiet zone around the code so it scans off a photo
            background; the label says what scanning does. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: Math.round(10 * s),
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: Math.round(14 * s),
              backgroundColor: "#ffffff",
              borderRadius: Math.round(16 * s),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="" width={qrSize} height={qrSize} />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: Math.round(20 * s),
              fontWeight: 800,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {qrLabel}
          </div>
        </div>
        </div>
      </div>
    ),
    {
      ...size,
      // ~4s to rasterize. The share kit fetches it once and holds the file, but
      // a tab switch and back, or a reload, shouldn't pay again; the copy on
      // the card (going count) can be ten minutes stale without harm.
      headers: { "Cache-Control": "private, max-age=600" },
      ...(font
        ? { fonts: [{ name: "Inter", data: font, weight: 800 as const, style: "normal" as const }] }
        : {}),
    },
  );
}
