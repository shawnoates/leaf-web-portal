import { ImageResponse } from "next/og";
import { SITE_HOST } from "@/lib/site";
import { friendModeFonts } from "@/lib/og-fonts";
import { fetchCrewInvite, firstName, paceLabel } from "./fetch-invite";

// 1200x630 unfurl card for a crew's invite link (iMessage, WhatsApp, Slack).
// Friend Mode's dark palette and lime accent, so the preview looks like the
// page it opens: the crew's name, who invited you, how often it meets, and
// the two choices waiting on the other side. The root layout's generic
// "Leaf OS — Community Calendars" card said none of that.
//
// Satori (what next/og rasterizes with) takes no stylesheets or app fonts,
// and every multi-child element must be display:flex.
export const dynamic = "force-dynamic";

export const alt = "An invite to a crew on Leaf";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CANVAS = "#101a16";
const CARD = "#1b2b25";
const LINE = "#3b5449";
const INK = "#f2f1ec";
const INK_2 = "#c9d1cb";
const MUTED = "#a3aca6";
const ACCENT = "#c8f25a";

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function nameSize(name: string): number {
  if (name.length <= 16) return 128;
  if (name.length <= 26) return 100;
  return 76;
}

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [invite, { fonts, hasSerif: serif, hasSans: sans }] = await Promise.all([fetchCrewInvite(code), friendModeFonts()]);

  const name = clip(invite?.name || "A crew on Leaf", 40);
  const who = invite ? `${firstName(invite.ownerName)} invited you` : "You're invited";
  const chips = invite
    ? [paceLabel(invite), `${invite.joined} ${invite.joined === 1 ? "person" : "people"} in`]
    : ["Friend Mode"];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          background: `radial-gradient(circle at 85% 0%, #253a33 0%, ${CANVAS} 55%)`,
          color: INK,
          fontFamily: sans ? "Manrope" : "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{ display: "flex", width: "14px", height: "14px", borderRadius: "7px", background: ACCENT }} />
          <div style={{ display: "flex", fontSize: "24px", fontWeight: 600, letterSpacing: "4px", color: ACCENT }}>
            FRIEND MODE · INVITE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", fontSize: "32px", color: INK_2 }}>{who}</div>
          <div
            style={{
              display: "flex",
              fontSize: `${nameSize(name)}px`,
              lineHeight: 1.02,
              fontFamily: serif ? "Instrument Serif" : sans ? "Manrope" : "system-ui, sans-serif",
              letterSpacing: serif ? "0px" : "-1px",
            }}
          >
            {name}
          </div>
          <div style={{ display: "flex", gap: "14px", marginTop: "10px" }}>
            {chips.map((c) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  fontSize: "26px",
                  padding: "10px 22px",
                  borderRadius: "999px",
                  border: `2px solid ${LINE}`,
                  background: CARD,
                  color: INK,
                }}
              >
                {c}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: "26px", color: MUTED }}>
            Leaf finds a night that works and plans it.
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                fontWeight: 600,
                padding: "14px 30px",
                borderRadius: "999px",
                background: ACCENT,
                color: CANVAS,
              }}
            >
              Join
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                padding: "12px 26px",
                borderRadius: "999px",
                border: `2px solid ${LINE}`,
                color: INK_2,
              }}
            >
              No thanks
            </div>
          </div>
        </div>
        <div style={{ display: "flex", position: "absolute", right: "80px", top: "64px", fontSize: "24px", color: MUTED }}>
          {SITE_HOST}
        </div>
      </div>
    ),
    {
      ...size,
      ...(fonts.length ? { fonts } : {}),
    },
  );
}
