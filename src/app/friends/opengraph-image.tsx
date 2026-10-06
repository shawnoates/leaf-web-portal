import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { friendModeFonts } from "@/lib/og-fonts";
import { SITE_HOST } from "@/lib/site";

// The /friends link preview (iMessage, WhatsApp, Slack, X): Friend Mode's dark
// look, the page's headline, and a crew photo with Leaf's text thread on it,
// so the unfurl says what the page does instead of the site's generic card.
// Satori: no stylesheets; every multi-child element is display:flex.
export const alt = "Friend Mode on Leaf: your friends, actually seeing each other";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CANVAS = "#101a16";
const CARD = "#253a33";
const INK = "#f2f1ec";
const INK_2 = "#c9d1cb";
const ACCENT = "#c8f25a";

async function photo(): Promise<string | null> {
  try {
    const buf = await readFile(join(process.cwd(), "public/photo-row/restaurant-dinner.jpg"));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image() {
  const [{ fonts, hasSerif, hasSans }, img] = await Promise.all([friendModeFonts(), photo()]);
  const serif = hasSerif ? "Instrument Serif" : "Georgia, serif";
  const bubble = (text: string, mine = false) => (
    <div
      style={{
        display: "flex",
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "330px",
        padding: "12px 18px",
        borderRadius: "22px",
        borderBottomLeftRadius: mine ? "22px" : "6px",
        borderBottomRightRadius: mine ? "6px" : "22px",
        background: mine ? ACCENT : CARD,
        color: mine ? CANVAS : INK,
        fontSize: "21px",
        fontWeight: mine ? 600 : 400,
        lineHeight: 1.3,
      }}
    >
      {text}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: CANVAS, color: INK, fontFamily: hasSans ? "Manrope" : "system-ui, sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "620px", padding: "60px 0 56px 68px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", width: "12px", height: "12px", borderRadius: "6px", background: ACCENT }} />
            <div style={{ display: "flex", fontSize: "20px", fontWeight: 600, letterSpacing: "4px", color: ACCENT }}>FRIEND MODE ON LEAF</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: serif, fontSize: "78px", lineHeight: 0.98, letterSpacing: "-1px" }}>
              <div style={{ display: "flex" }}>Your friends,</div>
              <div style={{ display: "flex" }}><span style={{ color: ACCENT }}>actually</span>&nbsp;seeing</div>
              <div style={{ display: "flex" }}>each other.</div>
            </div>
            <div style={{ display: "flex", fontSize: "25px", lineHeight: 1.4, color: INK_2, maxWidth: "500px" }}>
              Leaf picks the night around everyone&apos;s calendars, and keeps doing it. No app needed.
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", padding: "12px 26px", borderRadius: "999px", background: ACCENT, color: CANVAS, fontSize: "22px", fontWeight: 600 }}>Start a crew · free</div>
            <div style={{ display: "flex", fontSize: "22px", color: INK_2 }}>{SITE_HOST}/friends</div>
          </div>
        </div>

        <div style={{ display: "flex", position: "relative", width: "580px", height: "630px", padding: "36px 36px 36px 0" }}>
          <div style={{ display: "flex", position: "relative", width: "544px", height: "558px", borderRadius: "36px", overflow: "hidden", background: CARD }}>
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" width={544} height={558} style={{ width: "544px", height: "558px", objectFit: "cover", borderRadius: "36px" }} />
            )}
            <div style={{ display: "flex", position: "absolute", left: 0, right: 0, bottom: 0, height: "330px", background: "linear-gradient(to top, rgba(16,26,22,0.95), rgba(16,26,22,0))" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", position: "absolute", left: "28px", right: "28px", bottom: "28px" }}>
              {bubble("Thursday dinners: Sal's. Which work? 1) Thu 10/9  2) Sat 10/11")}
              {bubble("1 2", true)}
              {bubble("Locked: Thu 10/9, 7pm. 5 of you are in.")}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) },
  );
}
