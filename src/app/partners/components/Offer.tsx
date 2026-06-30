import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

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
            <div className="offer__kind">Always-on &middot; hands-off</div>
            <h3>Feature a deal</h3>
            <p className="offer__desc">
              Put an offer in the community calendars of the buildings around you. Residents
              see it where they already make plans &mdash; and walk in. You give us the offer;
              we handle placement.
            </p>
            <ul className="offer__list">
              <li>Choose your buildings, or a neighborhood radius</li>
              <li>Any offer &mdash; % off, a freebie, a first-timer deal</li>
              <li>Always on, zero effort from you</li>
            </ul>
            <div className="offer__out">
              <span>→</span>
              <span>
                A steady stream of <b>new local regulars.</b>
              </span>
            </div>
          </Reveal>

          <Reveal className="offer offer--reco" delay={100}>
            <span className="offer__tag">Highest impact</span>
            <div className="offer__kind">Done-with-you &middot; high-impact</div>
            <h3>Host an event</h3>
            <p className="offer__desc">
              We bring a room full of nearby residents to an event you host or sponsor
              &mdash; a tasting, class, or happy hour. We promote it, manage RSVPs, and fill
              the room.
            </p>
            <ul className="offer__list">
              <li>We handle promotion &amp; turnout</li>
              <li>You provide the space or the experience</li>
              <li>Meet dozens of new neighbors at once</li>
            </ul>
            <div className="offer__out">
              <span>→</span>
              <span>
                A packed event of <b>future regulars</b> &mdash; plus instant goodwill.
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal style={{ marginTop: 20, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            Not sure which?{" "}
            <strong style={{ color: "var(--forest)" }}>Start with a deal</strong> &mdash; add
            an event when you&rsquo;re ready.
          </p>
          <div className="inline-cta" style={{ display: "inline-block" }}>
            <CTA to="partner" variant="primary" arrow>
              Become a partner
            </CTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
