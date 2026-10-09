import { CTA, Plaque, TrustStrip } from "./ui";
import Reveal from "./Reveal";

// Neighbors around the table — the same photo the merchant dashboard uses
// for a hosted night. object-position keeps the crop on the faces (and
// clear of the generator's corner mark) at both the wide and square crops.
function HeroMedia() {
  return (
    <div className="hero__media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hosted-night.jpg"
        alt="Neighbors laughing around a table at a local bar while the owner pours wine"
        className="hero__photo"
      />

      {/* What a Neighbor Hour looks like on the resident's calendar. */}
      <div className="float float--event" aria-hidden="true">
        <div className="float__meta">Thu &middot; 6:30 pm &middot; 3 min walk</div>
        <div className="float__title">Neighbor Hour at your place</div>
        <div className="float__row">
          <div className="float__going">
            <div className="avatars">
              <span style={{ background: "#6dbf7a" }}>J</span>
              <span style={{ background: "#2f6b3a" }}>P</span>
              <span style={{ background: "#c08a4a" }}>M</span>
              <span style={{ background: "#5c5c58" }}>+9</span>
            </div>
            12 going
          </div>
          <span className="float__badge">Neighbors</span>
        </div>
      </div>

      <div className="float float--stat">
        <div className="float__big">+67%</div>
        <p className="float__label">
          Repeat customers spend 67% more than first-timers. Yours live next door.
        </p>
        <Plaque>Bain &amp; Company</Plaque>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="hero">
      <div className="container">
        <Reveal>
          <span className="hero__pill">
            <span className="hero__pill-dot" aria-hidden="true" />
            Leaf Partners
          </span>
          <h1 className="h-display">
            Neighbors in your <br /><span className="accent">slowest hours.</span>
          </h1>
          <p className="lead">
            Tell us your slowest days and hours. We&rsquo;ll send the residents who live
            around the corner, from your neighborhood&rsquo;s Leaf calendar. Your first
            Neighbor Hour is free: no listing fee, no RSVP fees.
          </p>
          <div className="cta-row cta-row--center">
            <CTA to="join" variant="primary" arrow>
              Claim your free Neighbor Hour
            </CTA>
            <CTA to="login" variant="ghost">
              Partner sign in
            </CTA>
          </div>
          <TrustStrip center />
        </Reveal>

        <Reveal delay={120}>
          <HeroMedia />
        </Reveal>
      </div>
    </section>
  );
}
