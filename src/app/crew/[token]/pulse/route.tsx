import { ImageResponse } from "next/og";
import Parse from "@/lib/parse";
import type { CrewPage } from "@/lib/crew";
import { pulseRingRows, ringGeometry, trendLine } from "@/lib/crew-pulse";
import { friendModeFonts } from "@/lib/og-fonts";
import { SITE_HOST } from "@/lib/site";

// The Crew Pulse card's Share image: 1080×1350 (an Instagram feed post), for
// the member whose crew link this is. Same story as the crew page card, sized
// to be posted: the rings and score, the numbers, and the shout-outs.
//
// Satori: no stylesheets, every multi-child element display:flex. The rings
// are an inline <svg> (rendered by resvg), rotated with an SVG transform.
export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;
const CANVAS = "#101a16";
const SURFACE = "#1b2b25";
const LINE_DIM = "#2e4038";
const LINE = "#3b5449";
const INK = "#f2f1ec";
const INK_2 = "#c9d1cb";
const MUTED = "#a3aca6";
const ACCENT = "#c8f25a";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let page: CrewPage | null = null;
  if (token === "sample" && process.env.NODE_ENV !== "production") {
    // Local dev only: /crew/sample/pulse renders the landing page's sample crew.
    const { SAMPLE_PULSE } = await import("@/lib/crew-pulse");
    page = { crew: { name: "Thursday dinners" }, pulse: SAMPLE_PULSE } as unknown as CrewPage;
  } else {
    try {
      page = (await Parse.Cloud.run("getCrewForMember", { token })) as CrewPage;
    } catch {
      page = null;
    }
  }
  const pulse = page?.pulse;
  if (!page || !pulse || pulse.score == null) return new Response("Not found", { status: 404 });

  const { fonts, hasSerif, hasSans } = await friendModeFonts();
  const serif = hasSerif ? "Instrument Serif" : "Georgia, serif";
  const rows = pulseRingRows(pulse);
  const size = 400;
  const stroke = 32;
  const geo = ringGeometry(size, stroke, 9, rows.length);
  const trend = trendLine(pulse.trend);
  const name = page.crew.name.length > 34 ? page.crew.name.slice(0, 33).trimEnd() + "…" : page.crew.name;
  const stats = [
    { n: pulse.stats.nights, label: "nights together" },
    { n: pulse.stats.places, label: "places tried" },
    { n: pulse.stats.streak, label: "in a row" },
    { n: pulse.stats.mostAtOnce, label: "most at once" },
  ];
  const chip = ["#C8F25A", "#FFB27A", "#6FE3D3"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "80px 80px 64px", background: CANVAS, color: INK, fontFamily: hasSans ? "Manrope" : "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", width: "14px", height: "14px", borderRadius: "7px", background: ACCENT }} />
            <div style={{ display: "flex", fontSize: "22px", fontWeight: 600, letterSpacing: "3px", color: ACCENT }}>FRIEND MODE · CREW PULSE</div>
          </div>
          <div style={{ display: "flex", fontSize: "24px", color: MUTED }}>Last {pulse.windowDays} days</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", fontFamily: serif, fontSize: "96px", lineHeight: 1, color: INK }}>{name}</div>
          <div style={{ display: "flex", fontFamily: serif, fontSize: "56px", fontStyle: "italic", color: ACCENT }}>
            {pulse.bandLabel}{trend ? ` · ${trend.toLowerCase()}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "56px" }}>
          <div style={{ display: "flex", position: "relative", width: `${size}px`, height: `${size}px` }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                {rows.map((r, i) => (
                  <circle key={`t${r.key}`} cx={size / 2} cy={size / 2} r={geo[i].r} fill="none" stroke={r.color} strokeOpacity={0.16} strokeWidth={stroke} />
                ))}
                {rows.map((r, i) => (r.value > 0 ? (
                  <circle
                    key={r.key} cx={size / 2} cy={size / 2} r={geo[i].r} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={`${geo[i].c * Math.min(r.value, 1)} ${geo[i].c}`}
                  />
                ) : null))}
              </g>
            </svg>
            <div style={{ position: "absolute", top: 0, left: 0, width: `${size}px`, height: `${size}px`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", fontFamily: serif, fontSize: "112px", lineHeight: 1 }}>{pulse.score}</div>
              <div style={{ display: "flex", fontSize: "20px", letterSpacing: "3px", color: ACCENT, marginTop: "6px" }}>OF 100</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "28px", flexGrow: 1 }}>
            {rows.map((r) => (
              <div key={r.key} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ display: "flex", width: "14px", height: "14px", borderRadius: "7px", background: r.color }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div style={{ display: "flex", fontSize: "30px", fontWeight: 600 }}>{r.label}</div>
                  <div style={{ display: "flex", fontSize: "21px", color: MUTED }}>{r.sub}</div>
                </div>
                <div style={{ display: "flex", marginLeft: "auto", fontFamily: serif, fontSize: "54px", color: r.color }}>{r.display}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px" }}>
          {stats.map((s) => (
            <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, padding: "22px 24px", borderRadius: "28px", background: SURFACE, border: `2px solid ${LINE_DIM}` }}>
              <div style={{ display: "flex", fontFamily: serif, fontSize: "64px", lineHeight: 1 }}>{s.n}</div>
              <div style={{ display: "flex", fontSize: "22px", color: INK_2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {pulse.shoutOuts.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
            {pulse.shoutOuts.slice(0, 2).map((s, i) => (
              <div key={s.kind} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "10px 26px 10px 10px", borderRadius: "999px", border: `2px solid ${LINE}` }}>
                <div style={{ display: "flex", width: "48px", height: "48px", borderRadius: "24px", background: chip[i % 3], color: CANVAS, alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 600 }}>
                  {s.name.trim().charAt(0).toUpperCase()}
                </div>
                <div style={{ display: "flex", fontSize: "26px", color: INK_2 }}>{`${s.label}: ${s.name.split(/\s+/)[0]}`}</div>
              </div>
            ))}
          </div>
        ) : <div style={{ display: "flex" }} />}

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", paddingTop: "26px", borderTop: `2px solid ${LINE_DIM}` }}>
          <div style={{ display: "flex", fontSize: "26px", lineHeight: 1.35, color: INK_2, maxWidth: "600px" }}>Leaf picks the nights around everyone&apos;s calendars. You just show up.</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
            <div style={{ display: "flex", fontFamily: serif, fontSize: "40px" }}>Friend Mode on Leaf</div>
            <div style={{ display: "flex", fontSize: "22px", color: ACCENT }}>{SITE_HOST}</div>
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, ...(fonts.length ? { fonts } : {}), headers: { "Cache-Control": "private, no-store" } },
  );
}
