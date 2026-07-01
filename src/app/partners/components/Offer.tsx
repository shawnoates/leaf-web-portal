import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

/**
 * Two offerings framed as a free on-ramp + one paid event path.
 *
 *   Post a deal     — FREE   self-serve, on-ramp
 *   Host an event   — paid   business runs it; we promote + RSVP
 *
 * Sponsorship is handled in the sales conversation, not on this page.
 * The card copy for "Sponsor an event" is parked in git history if we
 * ever reintroduce it under a different frame.
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

        {/* On-ramp band — FREE self-serve. Visually lightest so it
            reads as "the easy first step," not a premium product. */}
        <Reveal className="offer-free">
          <div className="offer-free__body">
            <span className="offer-free__badge">Free &middot; on-ramp</span>
            <h3>Post a deal</h3>
            <p className="offer-free__desc">
              Add your offer to the neighborhood deals feed. Free, instant, and the easiest
              way to start &mdash; the merchant equivalent of switching on a free calendar.
            </p>
          </div>
          <CTA to="deal" variant="primary" arrow>
            Start free
          </CTA>
        </Reveal>

        {/* Or get on the calendar — the one paid path */}
        <Reveal style={{ marginTop: 48, marginBottom: 18 }}>
          <p className="offer-section-banner">Or get on the calendar</p>
        </Reveal>

        <div className="offer-grid offer-grid--single">
          <Reveal className="offer offer--reco">
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
            <div className="offer__out">
              <span>→</span>
              <span>
                A packed room of <b>future regulars.</b>
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal style={{ marginTop: 20, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            Not sure where to start?{" "}
            <strong style={{ color: "var(--forest)" }}>Start free with a deal.</strong> Step
            up to hosting an event when you&rsquo;re ready.
          </p>
          <div className="inline-cta" style={{ display: "inline-block" }}>
            <CTA to="partner" variant="primary" arrow>
              Talk to a partner manager
            </CTA>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
