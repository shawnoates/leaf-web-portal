import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

export default function TwoWays() {
  return (
    <section className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>Get started</Eyebrow>
          <h2 className="h-lg">Pick a lane. Start small. Grow it.</h2>
          <p className="lead">
            Most partners start with a deal and add events once they see the neighbors coming
            in.
          </p>
        </Reveal>

        <div className="ways">
          <Reveal className="way">
            <h3 className="h-md" style={{ fontSize: "1.4rem" }}>
              Feature a deal
            </h3>
            <div className="way__price" style={{ color: "var(--forest)" }}>
              Always on
            </div>
            <p style={{ color: "var(--muted)" }}>
              An offer in the community calendars of the buildings around you. Zero effort
              &mdash; you give us the deal, we bring the foot traffic.
            </p>
            <ul>
              <li>Live in nearby buildings fast</li>
              <li>Pick your buildings or a radius</li>
              <li>Steady stream of new regulars</li>
            </ul>
            <CTA to="partner" variant="ghost">
              Get listed
            </CTA>
          </Reveal>

          <Reveal className="way way--reco" delay={100}>
            <span className="way__tag">Highest impact</span>
            <h3 className="h-md" style={{ fontSize: "1.4rem" }}>
              Host an event
            </h3>
            <div className="way__price" style={{ color: "var(--amber)" }}>
              Done-with-you
            </div>
            <p style={{ color: "var(--light)" }}>
              We fill a room with nearby residents at an event you host. Promotion, RSVPs,
              and turnout handled.
            </p>
            <ul>
              <li>A packed room of new neighbors</li>
              <li>We promote, you host</li>
              <li>Instant regulars &amp; goodwill</li>
            </ul>
            <CTA to="partner" variant="primary" arrow>
              Plan an event
            </CTA>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
