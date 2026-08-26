import { ImageResponse } from "next/og";
import { SITE_HOST } from "@/lib/site";

// 1200x630 unfurl card for /score and /score/<sid>.
//
// Sibling of /api/og/default and /api/og/plan-fallback — same dark green
// ground and typography, so a Leaf link looks like a Leaf link wherever it
// lands. What it adds is the gauge, because the gauge is what the ad creative
// leads with and what a shared result is actually about.
//
// Params (all optional; with none it renders the generic pre-quiz card):
//   score  0–100
//   band   thriving | healthy | warming_up | fading
//   noun   the group type, mid-sentence: "run club"
//
// Everything here is inline SVG and system type. next/og rasterizes with
// Satori, which supports neither external stylesheets nor the app's Inter
// loader, so the font stack is deliberately system-ui.

// No `runtime = "edge"` — the sibling OG routes don't set it either, and the
// Node runtime is what this deployment actually runs.

const GREEN = "#34d399";
const AMBER = "#e8a33d";

const R = 84;
const CIRC = 2 * Math.PI * R;
const ARC = CIRC * 0.75; // 270° sweep

function clampScore(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, n));
}

function bandLabel(band: string | null): string {
  switch (band) {
    case "thriving":
      return "Thriving";
    case "healthy":
      return "Healthy";
    case "warming_up":
      return "Warming up";
    case "fading":
      return "Fading";
    default:
      return "";
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const score = clampScore(searchParams.get("score"));
  const band = searchParams.get("band");
  const noun = (searchParams.get("noun") || "").slice(0, 40);

  const label = bandLabel(band);
  const tone = band === "warming_up" || band === "fading" ? AMBER : GREEN;
  const shown = score ?? 78; // the creative's sample score
  const pct = shown / 100;

  const headline = score
    ? noun
      ? `This ${noun} scored ${score}.`
      : `They scored ${score}.`
    : "Your community has a score.";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "72px",
          padding: "0 90px",
          background:
            "linear-gradient(135deg, #14201b 0%, #0d1713 55%, #080d0b 100%)",
          color: "#f4f6f5",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{ display: "flex", position: "relative", flexShrink: 0 }}
        >
          <svg width="260" height="260" viewBox="0 0 200 200">
            <g transform="rotate(135 100 100)">
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke="#243029"
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${ARC} ${CIRC}`}
              />
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={tone}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${ARC} ${CIRC}`}
                strokeDashoffset={ARC * (1 - pct)}
              />
            </g>
            <text
              x="100"
              y="100"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#f4f6f5"
              fontSize="62"
              fontWeight="700"
              letterSpacing="-3"
            >
              {shown}
            </text>
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "20px",
              fontWeight: 600,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: tone,
            }}
          >
            {label || "Updating live"}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "62px",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-2.5px",
              maxWidth: "600px",
            }}
          >
            {headline}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "26px",
              lineHeight: 1.4,
              color: "#9aa5a0",
              maxWidth: "560px",
            }}
          >
            Participation. Retention. Who actually shows up.
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "14px",
              fontSize: "22px",
              fontWeight: 600,
              color: "#6f7c76",
            }}
          >
            {SITE_HOST}/score
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
