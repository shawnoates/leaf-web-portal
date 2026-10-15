import { CTA, KindTabs, Plaque, TrustStrip } from "./ui";
import Reveal from "./Reveal";
import { COPY, type Kind } from "./copy";

// Neighbors around the table — the same photo the merchant dashboard uses
// for a hosted night. object-position keeps the crop on the faces (and
// clear of the generator's corner mark) at both the wide and square crops.
function HeroMedia({ kind }: { kind: Kind }) {
  const c = COPY[kind];
  return (
    <div className="hero__media">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hosted-night.jpg"
        alt={c.photoAlt}
        className="hero__photo"
      />

      {/* What a Neighbor Hour looks like on the resident's calendar. */}
      <div className="float float--event" aria-hidden="true">
        <div className="float__meta">Thu &middot; 6:30 pm &middot; 3 min walk</div>
        <div className="float__title">{c.floatTitle}</div>
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
          <span className="float__badge">{c.floatBadge}</span>
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

export default function Hero({ kind }: { kind: Kind }) {
  const c = COPY[kind];
  return (
    <section id="top" className="hero">
      <div className="container">
        <Reveal>
          <KindTabs kind={kind} />
          <h1 className="h-display">
            {c.heroTitle[0]} <br /><span className="accent">{c.heroTitle[1]}</span>
          </h1>
          <p className="lead">{c.heroLead}</p>
          <div className="cta-row cta-row--center">
            <CTA to="join" variant="primary" arrow>
              {c.cta}
            </CTA>
            <CTA to="login" variant="ghost">
              Partner sign in
            </CTA>
          </div>
          <TrustStrip center kind={kind} />
        </Reveal>

        <Reveal delay={120}>
          <HeroMedia kind={kind} />
        </Reveal>
      </div>
    </section>
  );
}
