"use client";

interface Trend {
  text: string;
  tone?: "positive" | "negative" | "neutral";
  /** Δ shown beside the band pill on the health box (points vs 30 days ago). */
  deltaPoints?: number | null;
}

interface GaugeStatProps {
  label: string;
  value: number;
  reference: number;
  fillColor: "green" | "blue" | "violet" | "neutral";
  subLabel: string;
  trend: Trend;
  /** Health box only: renders the trend text as a colored band pill and puts a
   *  thin accent bar on the card, marking it as the one true 0–100 score. */
  bandPill?: boolean;
  state?: "normal" | "empty" | "warming-up";
  band?: string;
}

export default function GaugeStat({
  label,
  value,
  reference,
  fillColor,
  subLabel,
  trend,
  bandPill,
  state = "normal",
  band,
}: GaugeStatProps) {
  const fillPercentage = reference > 0 ? (value / reference) * 100 : 0;

  // Clamp percentage to avoid overflow
  const displayPercentage = Math.min(fillPercentage, 100);

  const colorMap = {
    green: "#16a34a",
    blue: "#2563eb",
    violet: "#a855f7",
    neutral: "#71717a",
  };

  const bandColorMap: Record<string, string> = {
    "band-thriving": "#16a34a",
    "band-healthy": "#16a34a",
    "band-attention": "#eab308",
    "band-at-risk": "#dc2626",
    "band-warming-up": "#d4d4d8",
  };

  const bgColorMap: Record<string, string> = {
    "band-thriving": "#dcfce7",
    "band-healthy": "#dcfce7",
    "band-attention": "#fef3c7",
    "band-at-risk": "#fee2e2",
    "band-warming-up": "#f4f4f5",
  };

  const bandColor = band ? bandColorMap[band] : colorMap[fillColor];

  // SVG gauge geometry. The viewBox is cropped to just the half-circle plus
  // its stroke — a full `size`-tall box would leave the bottom half empty and
  // the card would carry that dead space at every width.
  const size = 120;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const centerX = size / 2;
  const centerY = radius + strokeWidth / 2 + 4; // 4px of top breathing room
  const viewBoxHeight = centerY + 6;

  // Half-circle: πr is the full length of the drawn arc.
  const arcLength = Math.PI * radius;
  const filledArcLength = (displayPercentage / 100) * arcLength;

  // Warming-up state: show faint arc only
  const isWarmingUp = state === "warming-up";
  const arcOpacity = isWarmingUp ? 0.3 : 1;
  const valueOpacity = isWarmingUp ? 0.5 : 1;

  return (
    <div className="relative border border-zinc-200 rounded-xl px-3 py-3 sm:px-4 flex flex-col items-center overflow-hidden">
      {bandPill && (
        <span
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ backgroundColor: bandColor }}
        />
      )}
      <p className="text-[11px] font-medium text-zinc-600 mb-2 text-center leading-tight min-h-[28px] sm:min-h-[16px] flex items-center">
        {label}
      </p>

      {/* Explicit sizing, not just width/height attributes — a bare <svg> will
          stretch to its flex container and scale its height with it. */}
      <svg
        viewBox={`0 0 ${size} ${viewBoxHeight}`}
        className="w-full max-w-[120px] h-auto"
        role="img"
        aria-label={`${label}: ${isWarmingUp ? "warming up" : `${value} ${subLabel}`}`}
      >
        {/* Background arc (half circle) */}
        <path
          d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
          stroke="#e4e4e7"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />

        {/* Filled arc. Skipped entirely at zero — a round linecap on a
            zero-length dash still paints a dot, which reads as a stray mark
            rather than an honest empty state. */}
        {filledArcLength > 0 && (
          <path
            d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
            stroke={bandColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${filledArcLength} ${arcLength}`}
            opacity={arcOpacity}
          />
        )}

        {/* Value + sub-label nested INSIDE the arc, both above the baseline.
            SVG text paints with `fill`, so these can't use Tailwind text
            color classes. */}
        <text
          x={centerX}
          y={centerY - 18}
          textAnchor="middle"
          fill="#18181b"
          fontSize="26"
          fontWeight="600"
          opacity={valueOpacity}
        >
          {isWarmingUp ? "—" : value}
        </text>

        <text
          x={centerX}
          y={centerY - 5}
          textAnchor="middle"
          fill="#71717a"
          fontSize="9"
          opacity={valueOpacity}
        >
          {isWarmingUp ? "Warming up" : subLabel}
        </text>
      </svg>

      {/* Trend line */}
      {bandPill ? (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
            style={{
              backgroundColor: bgColorMap[band || "band-warming-up"],
              color: bandColorMap[band || "band-warming-up"],
            }}
          >
            {trend.text}
          </span>
          {trend.deltaPoints != null && trend.deltaPoints !== 0 && (
            <span
              className={`text-[11px] font-medium whitespace-nowrap ${
                trend.deltaPoints > 0 ? "text-green-700" : "text-zinc-400"
              }`}
            >
              {trend.deltaPoints > 0 ? "↗" : "↘"} {Math.abs(trend.deltaPoints)}
            </span>
          )}
        </div>
      ) : (
        /* Regular trend for other stats */
        <div className="mt-2 text-center">
          <p
            className={`text-[11px] font-medium leading-tight ${
              trend.tone === "positive"
                ? "text-green-700"
                : trend.tone === "negative"
                  ? "text-zinc-400"
                  : "text-zinc-600"
            }`}
          >
            {trend.text}
          </p>
        </div>
      )}
    </div>
  );
}
