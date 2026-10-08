import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

/**
 * "What it costs" — the per-RSVP deal, side by side:
 *
 *   Your first Neighbor Hour  — free: no listing fee, no RSVP fees; a card claims it
 *   Every night after — $6 per RSVP, nothing under 5 RSVPs
 *
 * The Leaf host is an optional add-on on any night. Anything custom goes to
 * a partner manager.
 */
export default function Offer() {
  return (
    <section id="offer" className="band-white section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>What it costs</Eyebrow>
          <h2 className="h-lg">You only pay for neighbors who said they&rsquo;re coming.</h2>
          <p className="lead">
            No contract and no setup fee. Try one, see who walks in, and book more when
            it works.
          </p>
        </Reveal>

        <div className="offer-grid">
          <Reveal className="offer offer--reco">
            <span className="offer__tag">Free</span>
            <div className="offer__kind">Your first Neighbor Hour</div>
            <h3>On us</h3>
            <p className="offer__desc">
              No listing fee and no RSVP fees. Add a card to claim it. The free Neighbor Hour is
              held for 7 days after you first open your link.
            </p>
            <ul className="offer__list">
              <li>Pick your slowest day and time</li>
              <li>We invite the residents around you</li>
              <li>You just have room for the group</li>
            </ul>
            <div className="offer__cta">
              <CTA to="join" variant="primary" arrow>
                Claim your free Neighbor Hour
              </CTA>
            </div>
          </Reveal>

          <Reveal className="offer" delay={100}>
            <span className="offer__tag offer__tag--quiet">$6 per RSVP</span>
            <div className="offer__kind">Every one after</div>
            <h3>Pay per person</h3>
            <p className="offer__desc">
              Pick your slow days and a weekly limit, and switch it on or off anytime, like
              an ad campaign. $6 for each neighbor who RSVPs, counted 2 hours before and
              charged to your card after it happens. That rate never goes up.
            </p>
            <ul className="offer__list">
              <li>Under 5 RSVPs costs nothing, and we set up another one</li>
              <li>Set a weekly limit: your RSVP charges never go over it</li>
              <li>A one-time $100 setup, added to your first paid Neighbor Hour, after it happens</li>
              <li>Optional Leaf host, $99, for any Neighbor Hour you&rsquo;d like us to run</li>
            </ul>
          </Reveal>
        </div>

        <Reveal style={{ marginTop: 28, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            Partners can also post deals on their neighborhood&rsquo;s calendar from their
            dashboard: $20 a month, charged once it&rsquo;s approved.
          </p>
          <p style={{ color: "var(--muted)", marginTop: 12 }}>
            Want something custom, or several locations?{" "}
            <strong style={{ color: "var(--forest)" }}>Talk to a partner manager.</strong>
          </p>
          <div className="inline-cta" style={{ display: "inline-block" }}>
            <CTA to="manager" variant="ghost" arrow>
              Talk to a partner manager
            </CTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
