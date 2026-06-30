import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

/**
 * Three-product surface, framed as one free on-ramp + two event paths
 * under a shared "Get on the calendar" banner.
 *
 *   Post a deal      — FREE   self-serve, on-ramp
 *   Host an event    — paid   business runs it; we promote + RSVP
 *   Sponsor an event — paid   business backs someone else's event,
 *                              concierge-matched (NOT a marketplace)
 */
export default function Offer() {
  return (
    <section id="offer" className="band-white section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>What we offer</Eyebrow>
          <h2 className="h-lg">Three ways to reach your neighbors.</h2>
          <p className="lead">
            Post a deal for free, host your own event, or sponsor one that&rsquo;s already
            happening. Start wherever fits.
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

        {/* Get on the calendar — host vs sponsor fork inside one banner */}
        <Reveal style={{ marginTop: 48, marginBottom: 18 }}>
          <p className="offer-section-banner">Or get on the calendar</p>
        </Reveal>

        <div className="offer-grid">
          <Reveal className="offer">
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

          <Reveal className="offer offer--reco" delay={100}>
            <span className="offer__tag">Highest impact</span>
            <div className="offer__kind">Concierge-matched &middot; zero planning</div>
            <h3>Sponsor an event</h3>
            <p className="offer__desc">
              Get in front of a room you didn&rsquo;t have to plan. Back an event that&rsquo;s
              already happening near you and meet the neighbors who show up. Tell us your
              budget and vibe &mdash; we match you to the right one.
            </p>
            <ul className="offer__list">
              <li>We match you to the right event</li>
              <li>Fund or supply &mdash; no logistics on you</li>
              <li>Show up, meet the room, become memorable</li>
            </ul>
            <div className="offer__out">
              <span>→</span>
              <span>
                High-impact exposure, <b>zero planning.</b>
              </span>
            </div>
          </Reveal>
        </div>

        <Reveal style={{ marginTop: 20, textAlign: "center" }}>
          <p style={{ color: "var(--muted)" }}>
            Not sure where to start?{" "}
            <strong style={{ color: "var(--forest)" }}>Start free with a deal.</strong> Step
            up to hosting or sponsoring an event when you&rsquo;re ready.
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
