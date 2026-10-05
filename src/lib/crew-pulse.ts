import type { CrewPulse } from "@/lib/crew";

/** Ring colors: lime is Friend Mode's accent; aqua and peach sit at a like lightness. */
export const PULSE_COLORS = { showUp: "#C8F25A", keepItGoing: "#6FE3D3", shareLoad: "#FFB27A" } as const;

export type PulseRingKey = keyof typeof PULSE_COLORS;

export type PulseRingRow = { key: PulseRingKey; label: string; value: number; display: string; sub: string; color: string };

/** The rings that apply to this crew, outermost first, with their plain-English read-outs. */
export function pulseRingRows(p: CrewPulse): PulseRingRow[] {
  const rows: PulseRingRow[] = [];
  const d = p.ringDetail;
  if (p.rings.showUp != null) {
    rows.push({ key: "showUp", label: "Show up", value: p.rings.showUp, display: `${Math.round(p.rings.showUp * 100)}%`, sub: "Of the crew, per night", color: PULSE_COLORS.showUp });
  }
  if (p.rings.keepItGoing != null && d.expectedNights) {
    rows.push({ key: "keepItGoing", label: "Keep it going", value: p.rings.keepItGoing, display: `${d.nightsInWindow} / ${d.expectedNights}`, sub: "Nights on rhythm", color: PULSE_COLORS.keepItGoing });
  }
  if (p.rings.shareLoad != null) {
    rows.push({ key: "shareLoad", label: "Share the load", value: p.rings.shareLoad, display: `${Math.min(d.contributors, d.members)} / ${d.members}`, sub: "Hosted, added a place or voted", color: PULSE_COLORS.shareLoad });
  }
  return rows;
}

/** Ring geometry for an SVG of `size` px: one circle per row, outermost first. */
export function ringGeometry(size: number, stroke: number, gap: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const r = size / 2 - stroke / 2 - i * (stroke + gap);
    return { r, c: 2 * Math.PI * r };
  });
}

/** "+7 since last month", "Same as last month", or null. */
export function trendLine(trend: number | null): string | null {
  if (trend == null) return null;
  if (trend === 0) return "Same as last month";
  return `${trend > 0 ? "Up" : "Down"} ${Math.abs(trend)} since last month`;
}

/** A made-up crew, so the page can show what the card looks like. */
export const SAMPLE_PULSE: CrewPulse = {
  windowDays: 90,
  score: 86,
  band: "on-fire",
  bandLabel: "On fire",
  trend: 7,
  rings: { showUp: 0.82, keepItGoing: 0.92, shareLoad: 0.83 },
  ringDetail: { nightsInWindow: 11, expectedNights: 12, contributors: 5, members: 6 },
  stats: { nights: 11, places: 9, streak: 6, mostAtOnce: 6 },
  shoutOuts: [
    { kind: "never-missed", label: "Never missed one", userId: "s1", name: "Dev" },
    { kind: "most-spots", label: "Found the most spots", userId: "s2", name: "Maya" },
    { kind: "fastest-vote", label: "Fastest to vote", userId: "s3", name: "Ana" },
  ],
  nudge: null,
};
