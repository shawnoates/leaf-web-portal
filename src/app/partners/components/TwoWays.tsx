import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

/**
 * Two-up "pick a lane" cards.
 *
 *  1. Post a deal    — FREE on-ramp; visually lightest
 *  2. Host an event  — recommended / highest impact
 *
 * NOTE FOR REVIEW: with sponsor removed, this section now overlaps
 * heavily with "What we offer" above. Consider collapsing this to a
 * short CTA band ("Start free with a deal, or book a call to plan an
 * event") if it stops earning its place as the bottom-of-page CTA.
 */
export default function TwoWays() {
  return (
    <section className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>Get started</Eyebrow>
          <h2 className="h-lg">Pick a lane. Start small. Grow it.</h2>
          <p className="lead">
            Most partners start with a free deal and add a hosted event once they see the
            neighbors coming in.
          </p>
        </Reveal>

        <div className="ways">
          <Reveal className="way way--free">
            <span className="way__tag way__tag--quiet">Free</span>
            <h3 className="h-md" style={{ fontSize: "1.3rem" }}>
              Post a deal
            </h3>
            <div className="way__price" style={{ color: "var(--forest)" }}>
              $0
            </div>
            <p style={{ color: "var(--muted)" }}>
              An offer in the community calendars of the buildings around you. Self-serve,
              instant, the easiest way to start.
            </p>
            <ul>
              <li>Live in nearby buildings fast</li>
              <li>Pick your buildings or a radius</li>
              <li>Zero effort &mdash; you give us the offer</li>
            </ul>
            <CTA to="claim" variant="ghost">
              Claim your business &mdash; FREE
            </CTA>
          </Reveal>

          <Reveal className="way way--reco" delay={100}>
            <span className="way__tag">Highest impact</span>
            <h3 className="h-md" style={{ fontSize: "1.3rem" }}>
              Host an event
            </h3>
            <div className="way__price" style={{ color: "var(--amber)" }}>
              You run it
            </div>
            <p style={{ color: "var(--light)" }}>
              Your own event on the building calendars &mdash; tasting, class, happy hour.
              We promote it and fill the room.
            </p>
            <ul>
              <li>We promote, you host</li>
              <li>Promotion &amp; RSVPs handled</li>
              <li>A captive room of new regulars</li>
            </ul>
            <CTA to="demo" variant="primary" arrow>
              Book a demo
            </CTA>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
