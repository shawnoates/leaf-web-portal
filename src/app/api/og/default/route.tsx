import { ImageResponse } from "next/og";
import { SITE_HOST } from "@/lib/site";

// 1200x630 branded card served as the site-wide default og:image.
//
// The root layout points every route that doesn't set its own
// `openGraph` at this URL — the bare domain (joinleaf.com → /personal),
// /about, /safety, /calendars, the legal pages, and anything added later.
// Without it those links unfurl as a bare blue URL in iMessage and as a
// title-only stub in Slack, because the root layout previously emitted no
// Open Graph tags at all.
//
// Sibling of /api/og/plan-fallback (the per-plan version). Same gradient
// and typography so a Leaf link looks like a Leaf link wherever it lands.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background:
            "linear-gradient(135deg, #253A33 0%, #1a2d27 60%, #0f1f1a 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          Leaf
        </div>
        <div
          style={{
            fontSize: 42,
            marginTop: 24,
            lineHeight: 1.25,
            fontWeight: 400,
            color: "#f7f5ef",
            opacity: 0.92,
          }}
        >
          Community calendars for the people around you
        </div>
        <div
          style={{
            fontSize: 28,
            marginTop: 40,
            fontWeight: 400,
            color: "#a7bfa9",
          }}
        >
          {SITE_HOST}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
