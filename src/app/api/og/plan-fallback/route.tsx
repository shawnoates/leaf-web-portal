import { ImageResponse } from "next/og";

// 1200x630 branded fallback served as the og:image for plan share pages
// whose plan doesn't have a cover photo. iMessage / Slack / etc. need a
// proper Open Graph image to render a rich preview at all — without one,
// iMessage shows an empty grey card (or worse, an unstable fallback to
// apple-touch-icon at the wrong dimensions, which is what was happening
// before this route existed).
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
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
            fontSize: 38,
            marginTop: 20,
            opacity: 0.85,
            fontWeight: 400,
          }}
        >
          You&apos;re invited
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
