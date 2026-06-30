import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

/**
 * Three-up "pick a lane" cards.
 *
 *  1. Post a deal       — FREE on-ramp; visually lightest
 *  2. Host an event     — middle weight
 *  3. Sponsor an event  — recommended / highest impact
 *
 * Sponsor is concierge-first (booking link, not a browseable marketplace);
 * deal is self-serve (DEAL_URL, currently routes to the demo calendar
 * with a TODO until the self-serve flow ships).
 */
export default function TwoWays() {
  return (
    <section className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>Get started</Eyebrow>
          <h2 className="h-lg">Pick a lane. Start small. Grow it.</h2>
          <p className="lead">
            Most partners start with a free deal and add an event &mdash; theirs or someone
            else&rsquo;s &mdash; once they see the neighbors coming in.
          </p>
        </Reveal>

        <div className="ways ways--3up">
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
            <CTA to="deal" variant="ghost">
              Start free
            </CTA>
          </Reveal>

          <Reveal className="way" delay={100}>
            <h3 className="h-md" style={{ fontSize: "1.3rem" }}>
              Host an event
            </h3>
            <div className="way__price" style={{ color: "var(--forest)" }}>
              You run it
            </div>
            <p style={{ color: "var(--muted)" }}>
              Your own event on the building calendars &mdash; tasting, class, happy hour.
              We promote it and fill the room.
            </p>
            <ul>
              <li>We promote, you host</li>
              <li>Promotion &amp; RSVPs handled</li>
              <li>A captive room of new regulars</li>
            </ul>
            <CTA to="partner" variant="ghost">
              Plan an event
            </CTA>
          </Reveal>

          <Reveal className="way way--reco" delay={200}>
            <span className="way__tag">Highest impact</span>
            <h3 className="h-md" style={{ fontSize: "1.3rem" }}>
              Sponsor an event
            </h3>
            <div className="way__price" style={{ color: "var(--amber)" }}>
              We match you
            </div>
            <p style={{ color: "var(--light)" }}>
              Back an event that&rsquo;s already happening near you. Tell us your budget and
              vibe &mdash; we match you to the right room.
            </p>
            <ul>
              <li>Concierge-matched, not browse-and-apply</li>
              <li>Fund or supply &mdash; no logistics</li>
              <li>Instant goodwill &amp; future regulars</li>
            </ul>
            <CTA to="partner" variant="primary" arrow>
              Find an event to sponsor
            </CTA>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
