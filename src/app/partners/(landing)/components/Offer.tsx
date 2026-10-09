import { CTA, SectionHead } from "./ui";
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
    <section id="offer" className="section">
      <div className="container">
        <Reveal>
          <SectionHead
            center
            eyebrow="What it costs"
            title={<>You only pay for neighbors who said they&rsquo;re coming.</>}
            lead="No contract and no setup fee. Try one, see who walks in, and book more when it works."
          />
        </Reveal>

        <div className="offer-grid">
          <Reveal className="offer offer--dark on-dark">
            <span className="offer__tag">Free</span>
            <div className="offer__kind">Your first Neighbor Hour</div>
            <div className="offer__price">
              <span className="offer__amount">$0</span>
              <span className="offer__per">on us</span>
            </div>
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
            <div className="offer__kind">Every one after</div>
            <div className="offer__price">
              <span className="offer__amount">$6</span>
              <span className="offer__per">per RSVP</span>
            </div>
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

        <Reveal className="offer-notes">
          <p>
            Partners can also post deals on their neighborhood&rsquo;s calendar from their
            dashboard: $20 a month, charged once it&rsquo;s approved.
          </p>
          <p>
            Want something custom, or several locations?{" "}
            <strong>Talk to a partner manager.</strong>
          </p>
          <div className="inline-cta" style={{ marginTop: 20 }}>
            <CTA to="manager" variant="ghost" arrow>
              Talk to a partner manager
            </CTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
