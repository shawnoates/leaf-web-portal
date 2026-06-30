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
          stroke="var(--mint-deep)"
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
          fontFamily="var(--display)"
          fontSize="22"
          fontWeight="700"
          fill="var(--forest)"
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
    <section className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>Why it pays</Eyebrow>
          <h2 className="h-lg">An ad gets you a click. A neighbor gets you a regular.</h2>
          <p className="lead">
            The money isn&rsquo;t in one-time foot traffic &mdash; it&rsquo;s in repeat
            visits. And the closer someone lives, the more often they come back.
          </p>
        </Reveal>

        <div className="grid grid-2" style={{ alignItems: "stretch" }}>
          <Reveal
            className="card"
            style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}
          >
            <div className="bigstat" style={{ padding: 0 }}>
              <div
                className="bigstat__num"
                style={{ fontSize: "clamp(3.6rem, 11vw, 6.4rem)" }}
              >
                25&ndash;<em>95%</em>
              </div>
              <p className="bigstat__cap">
                more profit from just a <strong>5% increase in repeat customers.</strong>
              </p>
              <div style={{ marginTop: 18 }}>
                <Plaque>Bain &amp; Company &middot; HBR</Plaque>
              </div>
            </div>
          </Reveal>

          <Reveal className="card" delay={100}>
            <h3 className="h-md" style={{ marginBottom: 6, fontSize: "1.3rem" }}>
              A small slice of customers drives a big slice of revenue
            </h3>
            <p style={{ color: "var(--muted)", margin: "0 0 22px", fontSize: "0.92rem" }}>
              Share of a typical business&rsquo;s customers vs. share of revenue.
            </p>

            <div className="ratio-pair">
              <ShareRing pct={21} color="var(--mid)" label="of customers" />
              <div className="ratio-pair__arrow" aria-hidden="true">
                drives
              </div>
              <ShareRing pct={44} color="var(--amber)" label="of revenue" />
            </div>
            <p className="ratio-pair__caption">
              Repeat customers are about <b>21%</b> of the base — and they generate{" "}
              <b>~44%</b> of all revenue. More than 2&times; their share.
            </p>

            <p style={{ marginTop: 22, fontWeight: 700, color: "var(--forest)" }}>
              The residents next door are the most likely people to become those regulars.
            </p>
            <div style={{ marginTop: 10 }}>
              <Plaque>Gorgias &middot; repeat-customer data</Plaque>
            </div>
          </Reveal>
        </div>

        <Reveal className="inline-cta">
          <CTA to="partner" variant="primary" arrow>
            Turn neighbors into regulars
          </CTA>
        </Reveal>
      </div>
    </section>
  );
}
