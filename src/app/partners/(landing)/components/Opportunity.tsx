import { Eyebrow, Plaque } from "./ui";
import Reveal from "./Reveal";

function RadiusArt() {
  return (
    <div
      className="radius"
      role="img"
      aria-label="Your store at the center of a 5-minute walk full of nearby residents"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/partners-opportunity.png"
        alt=""
        className="radius__photo"
      />
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
                className="card opportunity-stat"
                key={s.fig}
              >
                <div className="opportunity-stat__fig stat-amber stat-fig">
                  {s.fig}
                </div>
                <div className="opportunity-stat__body">
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
