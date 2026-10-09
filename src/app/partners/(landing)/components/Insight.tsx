import { CTA, Eyebrow, Plaque } from "./ui";
import Reveal from "./Reveal";

/**
 * Proportional ring used in the "small slice → big slice" comparison
 * inside the Insight card. The visible arc is sized to the percentage
 * passed in, so the 21% ring and 44% ring have visibly different fills
 * — much clearer than two bars on the same scale where neither passes
 * the halfway mark.
 */
function ShareRing({
  pct,
  color,
  label,
}: {
  pct: number;
  color: string;
  label: string;
}) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const filled = (pct / 100) * circumference;
  return (
    <div className="share-ring">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="13"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeWidth="13"
          fill="none"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--serif)"
          fontSize="26"
          fill="#fff"
        >
          {pct}%
        </text>
      </svg>
      <div className="share-ring__label">{label}</div>
    </div>
  );
}

export default function Insight() {
  return (
    <section className="section band-forest">
      <div className="container insight">
        <Reveal>
          <Eyebrow>Why it pays</Eyebrow>
          <h2 className="h-section" style={{ color: "#fff" }}>
            An ad gets you a click. <span className="accent">A neighbor gets you a regular.</span>
          </h2>
          <p className="lead" style={{ marginTop: 16 }}>
            The money isn&rsquo;t in one-time foot traffic. It&rsquo;s in repeat
            visits. And the closer someone lives, the more often they come back.
          </p>

          <div style={{ marginTop: "clamp(32px, 4vw, 52px)" }}>
            <div className="insight__big">
              25&ndash;<em>95%</em>
            </div>
            <p className="insight__cap">
              more profit from just a 5% increase in repeat customers.
            </p>
            <Plaque>Bain &amp; Company &middot; HBR</Plaque>
          </div>

          <div className="inline-cta">
            <CTA to="join" variant="primary" arrow>
              Claim your free Neighbor Hour
            </CTA>
          </div>
        </Reveal>

        <Reveal className="insight__card" delay={100}>
          <h3 className="insight__card-title">
            A small slice of customers drives a big slice of revenue
          </h3>
          <p className="insight__card-sub">
            Share of a typical business&rsquo;s customers vs. share of revenue.
          </p>

          <div className="ratio-pair">
            <ShareRing pct={21} color="rgba(255,255,255,0.55)" label="of customers" />
            <div className="ratio-pair__arrow" aria-hidden="true">
              drives
            </div>
            <ShareRing pct={44} color="var(--green-light)" label="of revenue" />
          </div>
          <p className="ratio-pair__caption">
            Repeat customers are about <b>21%</b> of the base, and they generate{" "}
            <b>~44%</b> of all revenue. More than 2&times; their share.
          </p>

          <p className="insight__kicker">
            The residents next door are the most likely people to become those regulars.
          </p>
          <div style={{ marginTop: 10 }}>
            <Plaque>Gorgias &middot; repeat-customer data</Plaque>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
