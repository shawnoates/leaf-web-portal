import { Eyebrow, Plaque } from "./ui";
import Reveal from "./Reveal";

function RadiusArt() {
  return (
    <div
      className="radius"
      role="img"
      aria-label="Your store at the center of a 5-minute walk full of nearby residents"
    >
      <svg viewBox="0 0 420 340" width="100%" height="100%" aria-hidden="true">
        <circle
          cx="210"
          cy="180"
          r="150"
          fill="none"
          stroke="#40916c"
          strokeWidth="1.5"
          strokeDasharray="5 6"
          opacity="0.5"
        />
        <circle
          cx="210"
          cy="180"
          r="96"
          fill="none"
          stroke="#40916c"
          strokeWidth="1.5"
          strokeDasharray="5 6"
          opacity="0.6"
        />
        {[
          [120, 90],
          [300, 96],
          [80, 200],
          [330, 210],
          [150, 260],
          [270, 268],
          [210, 70],
          [110, 150],
          [315, 160],
          [210, 300],
        ].map((p, i) => (
          <g key={i}>
            <rect x={p[0] - 9} y={p[1] - 12} width="18" height="24" rx="3" fill="#2d6a4f" opacity="0.9" />
            <rect x={p[0] - 5} y={p[1] - 8} width="4" height="4" fill="#cdeede" />
            <rect x={p[0] + 1} y={p[1] - 8} width="4" height="4" fill="#cdeede" />
            <rect x={p[0] - 5} y={p[1] - 1} width="4" height="4" fill="#cdeede" />
            <rect x={p[0] + 1} y={p[1] - 1} width="4" height="4" fill="#cdeede" />
          </g>
        ))}
        <circle cx="210" cy="180" r="26" fill="#e8a33d" />
        <path d="M198 180 h24 M210 168 v24" stroke="#1c1304" strokeWidth="3" />
        <text x="210" y="224" textAnchor="middle" fontSize="12" fontFamily="system-ui" fill="#15241f" fontWeight="700">
          You
        </text>
        <text x="210" y="40" textAnchor="middle" fontSize="11" fontFamily="system-ui" fill="#647a70">
          ~5-minute walk
        </text>
      </svg>
    </div>
  );
}

const stats = [
  {
    fig: "70%",
    line: "shop local specifically to support their community.",
    src: "2025–26 consumer data",
  },
  {
    fig: "67%",
    line: "trust local businesses with real locations more than internet-only brands.",
    src: "Uberall",
  },
  {
    fig: "~$150/mo",
    line: "more that people say they’ll spend to keep their local shops alive.",
    src: "Faire",
  },
];

export default function Opportunity() {
  return (
    <section id="nearby" className="band-white section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>The opportunity</Eyebrow>
          <h2 className="h-lg">There&rsquo;s a customer base living right around you.</h2>
          <p className="lead">
            Hundreds of residents in the buildings nearby are looking for exactly what you
            offer &mdash; and they&rsquo;d rather it be local. You just need to reach them
            where they already plan their week.
          </p>
        </Reveal>

        <div className="hero__grid">
          <Reveal>
            <RadiusArt />
          </Reveal>
          <Reveal delay={100} className="grid" style={{ gap: 16 }}>
            {stats.map((s) => (
              <div
                className="card"
                key={s.fig}
                style={{ padding: 22, display: "flex", gap: 18, alignItems: "center" }}
              >
                <div
                  className="stat-amber stat-fig"
                  style={{ fontSize: "2.2rem", minWidth: 120 }}
                >
                  {s.fig}
                </div>
                <div>
                  <p style={{ marginBottom: 8 }}>{s.line}</p>
                  <Plaque>{s.src}</Plaque>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
