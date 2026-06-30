import { Eyebrow, Plaque } from "./ui";
import Reveal from "./Reveal";
import Calculator from "./Calculator";

const cost = [
  { label: "Lost rent", pct: 50, color: "#1b4332" },
  { label: "Make-ready", pct: 30, color: "#2d6a4f" },
  { label: "Marketing", pct: 12, color: "#40916c" },
  { label: "Staff time", pct: 8, color: "#74b894" },
];

export default function Stakes() {
  return (
    <section id="cost" className="band-white section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>The stakes</Eyebrow>
          <h2 className="h-lg">Every move-out is a hole in your NOI.</h2>
          <p className="lead">
            Turnover is one of the largest costs an operator carries &mdash; and most of it is
            invisible until the unit sits empty. Keeping a resident is the cheapest money
            you&rsquo;ll make all year.
          </p>
        </Reveal>

        <div className="grid grid-2">
          <Reveal className="card">
            <div className="stat-amber" style={{ fontSize: "3.2rem" }}>
              ≈ <span className="stat-fig">$4,000</span>
            </div>
            <p style={{ margin: "6px 0 18px", color: "var(--muted)" }}>
              the cost of a single move-out &mdash; lost rent, make-ready, marketing, and staff
              time.
            </p>
            <div className="costbar" aria-hidden="true">
              {cost.map((c) => (
                <div key={c.label} style={{ width: `${c.pct}%`, background: c.color }}>
                  {c.pct >= 12 ? `${c.pct}%` : ""}
                </div>
              ))}
            </div>
            <div className="legend">
              {cost.map((c) => (
                <span key={c.label}>
                  <i style={{ background: c.color }} />
                  {c.label}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Plaque>Zego &middot; Harvard JCHS benchmarks</Plaque>
            </div>
          </Reveal>

          <Reveal className="card" delay={100}>
            <div className="stat-amber" style={{ fontSize: "3.2rem" }}>
              ~<span className="stat-fig">45%</span>
            </div>
            <p style={{ margin: "6px 0 18px", color: "var(--muted)" }}>
              of units turn over every year. More than half your rent roll can cycle through
              make-ready annually.
            </p>
            <div className="gauge-track" aria-hidden="true">
              <div className="gauge-fill" style={{ width: "45%" }} />
            </div>
            <p style={{ marginTop: 18, fontWeight: 600 }}>
              Properties are valued on income. More turnover &rarr; more vacancy loss and
              expense &rarr; lower NOI at the same cap rate.
            </p>
            <div style={{ marginTop: 16 }}>
              <Plaque>Harvard JCHS &middot; RealPage</Plaque>
            </div>
          </Reveal>
        </div>

        <Reveal style={{ marginTop: 26 }}>
          <h3 className="h-md" style={{ marginBottom: 16 }}>
            What is turnover costing you?
          </h3>
          <Calculator />
        </Reveal>
      </div>
    </section>
  );
}
