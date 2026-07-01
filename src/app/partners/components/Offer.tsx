import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

/**
 * "What we offer" — two side-by-side offer cards:
 *
 *   Post a deal    — FREE  self-serve, on-ramp
 *   Host an event  — paid  business runs it; we promote + RSVP
 *
 * Sponsorship is handled in the sales conversation, not on this page.
 */
export default function Offer() {
  return (
    <section id="offer" className="band-white section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>What we offer</Eyebrow>
          <h2 className="h-lg">Two simple ways to reach your neighbors.</h2>
          <p className="lead">
            Be on the calendar, or be the event. Start with one &mdash; add the other when
            you&rsquo;re ready.
          </p>
        </Reveal>

        <div className="offer-grid">
          <Reveal className="offer">
            <span className="offer__tag offer__tag--quiet">Free</span>
            <div className="offer__kind">Always-on &middot; hands-off</div>
            <h3>Post a deal</h3>
            <p className="offer__desc">
              Put an offer in the community calendars of the buildings around you. Residents
              see it where they already make plans &mdash; and walk in. You give us the
              offer; we handle placement.
            </p>
            <ul className="offer__list">
              <li>Choose your buildings, or a neighborhood radius</li>
              <li>Any offer &mdash; % off, a freebie, a first-timer deal</li>
              <li>Always on, zero effort from you</li>
            </ul>
            <div className="offer__cta">
              <CTA to="claim" variant="ghost">
                Claim your business &mdash; FREE
              </CTA>
            </div>
          </Reveal>

          <Reveal className="offer offer--reco" delay={100}>
            <span className="offer__tag">Highest impact</span>
            <div className="offer__kind">Done-with-you &middot; you run it</div>
            <h3>Host an event</h3>
            <p className="offer__desc">
              Run your own event on the building calendars &mdash; a tasting, class, or happy
              hour. Residents RSVP; we promote it and fill the room. You host.
            </p>
            <ul className="offer__list">
              <li>We handle promotion &amp; RSVPs</li>
              <li>You provide the experience or the space</li>
              <li>A captive room of nearby neighbors</li>
            </ul>
            <div className="offer__cta">
              <CTA to="demo" variant="primary" arrow>
                Book a demo
              </CTA>
            </div>
          </Reveal>
        </div>

        <Reveal style={{ marginTop: 28, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            Not sure where to start?{" "}
            <strong style={{ color: "var(--forest)" }}>
              Claim your business for free.
            </strong>{" "}
            Add a hosted event when you&rsquo;re ready.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
