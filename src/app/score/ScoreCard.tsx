// The white score card from the ad creative: gauge, band, benchmark delta,
// six-bar breakdown.
//
// No hooks and no "use client" on purpose — it renders identically inside the
// interactive reveal and inside the server-rendered /score/<sid> share page,
// and it must not drag a client boundary into the second one.

import {
  METRIC_LABELS,
  SCORECARD_QUESTIONS,
  bandTone,
  scorecardBandLabel,
  type ScorecardBand,
  type ScorecardMetric,
} from "@/lib/scorecard";

// Geometry for a 270° gauge: start at 7:30, sweep clockwise to 4:30.
const R = 52;
const CIRCUMFERENCE = 2 * Math.PI * R;
const SWEEP = 0.75; // 270 of 360 degrees
const ARC = CIRCUMFERENCE * SWEEP;

export function Gauge({
  score,
  band,
  /** The idle hero loop passes false so the number reads as a live meter
   *  rather than a result. */
  labelled = true,
}: {
  score: number;
  band: ScorecardBand;
  labelled?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const tone = bandTone(band);

  return (
    <svg
      className="gauge"
      data-tone={tone}
      viewBox="0 0 120 120"
      role="img"
      // The text equivalent for the gauge. Without this the whole card is a
      // number floating in an unlabelled arc for anyone not looking at it.
      aria-label={
        labelled
          ? `Community score ${score} out of 100. Band: ${scorecardBandLabel(band)}.`
          : `Sample community score, currently ${score} out of 100.`
      }
    >
      <g transform="rotate(135 60 60)">
        <circle
          className="gauge-track"
          cx="60"
          cy="60"
          r={R}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
        />
        <circle
          className="gauge-fill"
          cx="60"
          cy="60"
          r={R}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${ARC} ${CIRCUMFERENCE}`}
          strokeDashoffset={ARC * (1 - pct)}
        />
      </g>
      <text
        className="gauge-num"
        x="60"
        y="60"
        textAnchor="middle"
        dominantBaseline="central"
        aria-hidden="true"
      >
        {score}
      </text>
    </svg>
  );
}

export function Bars({
  pillarScores,
  weakMetric,
  /** Reveal animates the fills in from zero; the share page paints them
   *  already filled. */
  filled = true,
}: {
  pillarScores: Record<ScorecardMetric, number>;
  weakMetric: ScorecardMetric | null;
  filled?: boolean;
}) {
  return (
    <div className="bars">
      {SCORECARD_QUESTIONS.map((q) => {
        const value = pillarScores[q.metric] ?? 0;
        const isWeak = q.metric === weakMetric;
        return (
          <div className="bar" key={q.metric} data-weak={isWeak}>
            {/* The label is a real word, always present. Nothing about which
                bar is which depends on reading a colour. */}
            <span className="bar-label">{METRIC_LABELS[q.metric]}</span>
            <span
              className="bar-track"
              role="img"
              aria-label={`${METRIC_LABELS[q.metric]}: ${value} out of 100${
                isWeak ? ". Your lowest." : ""
              }`}
            >
              <span
                className="bar-fill"
                style={{ width: filled ? `${value}%` : "0%" }}
              />
            </span>
            <span className="bar-val" aria-hidden="true">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ScoreCard({
  score,
  band,
  pillarScores,
  weakMetric,
  benchmark,
  groupNoun,
  filled = true,
}: {
  score: number;
  band: ScorecardBand;
  pillarScores: Record<ScorecardMetric, number>;
  weakMetric: ScorecardMetric | null;
  benchmark: number;
  groupNoun: string;
  filled?: boolean;
}) {
  const delta = score - benchmark;
  // Where the ad creative shows a trend arrow, the page shows this — a
  // visitor's number means little on its own, and "+4 vs. a typical run club"
  // is what lets them locate themselves.
  const deltaText =
    delta === 0
      ? `Right at the typical ${groupNoun}`
      : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} vs. a typical ${groupNoun}`;

  return (
    <div className="card">
      <span className="eyebrow">
        <span className="dot" aria-hidden="true" />
        Updating live
      </span>

      <div className="card-top">
        <Gauge score={score} band={band} />
        <div>
          <p className="band" data-tone={bandTone(band)}>
            {scorecardBandLabel(band)}
          </p>
          <p className="delta">{deltaText}</p>
        </div>
      </div>

      <Bars
        pillarScores={pillarScores}
        weakMetric={weakMetric}
        filled={filled}
      />

      <p className="honesty">
        This is an estimate from what you told us. Once your calendar is live,
        Leaf measures the real number from what actually happens, and updates it
        every week.
      </p>
    </div>
  );
}
