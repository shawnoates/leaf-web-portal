import { Plaque, SectionHead } from "./ui";
import Reveal from "./Reveal";

function RadiusArt() {
  return (
    <div
      className="map"
      role="img"
      aria-label="Your store at the center of a 5-minute walk full of nearby residents"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/partners-opportunity.png" alt="" />
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
    <section id="nearby" className="section band-rule">
      <div className="container">
        <Reveal>
          <SectionHead
            eyebrow="The opportunity"
            title={<>There&rsquo;s a customer base living right around you.</>}
            lead={
              <>
                Hundreds of residents in the buildings nearby are looking for exactly what
                you offer, and they&rsquo;d rather it be local. You just need to reach
                them where they already plan their week.
              </>
            }
          />
        </Reveal>

        <div className="split">
          <Reveal>
            <RadiusArt />
          </Reveal>
          <Reveal delay={100}>
            <ul className="statlist">
              {stats.map((s) => (
                <li key={s.fig}>
                  <div className="statlist__fig">{s.fig}</div>
                  <div>
                    <p className="statlist__line">{s.line}</p>
                    <Plaque>{s.src}</Plaque>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
