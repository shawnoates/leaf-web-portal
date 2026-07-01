import { CTA, Eyebrow, Plaque, TrustStrip } from "./ui";
import Reveal from "./Reveal";

function StorefrontArt() {
  return (
    <div
      className="hero__art"
      role="img"
      aria-label="A local storefront with neighbors walking up from nearby buildings"
    >
      <svg
        className="hero__people"
        viewBox="0 0 400 440"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="p-glow" cx="50%" cy="22%" r="70%">
            <stop offset="0%" stopColor="#cdeede" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#cdeede" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="440" fill="url(#p-glow)" />
        {[
          { x: 26, h: 150 },
          { x: 300, h: 180 },
        ].map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={120 + (180 - b.h)} width="74" height={b.h} rx="6" fill="#173d2c" />
            {Array.from({ length: 12 }).map((_, k) => (
              <rect
                key={k}
                x={b.x + 10 + (k % 3) * 20}
                y={130 + Math.floor(k / 3) * 26 + (180 - b.h)}
                width="12"
                height="14"
                rx="2"
                fill="#74b894"
                opacity="0.85"
              />
            ))}
          </g>
        ))}
        <g>
          <rect x="120" y="196" width="160" height="150" rx="8" fill="#fbfcfb" />
          <rect x="120" y="196" width="160" height="34" rx="8" fill="#e8a33d" />
          {Array.from({ length: 7 }).map((_, k) => (
            <rect
              key={k}
              x={120 + k * 23}
              y="230"
              width="11.5"
              height="18"
              fill={k % 2 ? "#e8a33d" : "#fff"}
              opacity="0.95"
            />
          ))}
          <rect x="138" y="262" width="56" height="84" rx="4" fill="#cdeede" />
          <rect x="206" y="262" width="56" height="50" rx="4" fill="#cdeede" />
          <rect x="206" y="318" width="56" height="28" rx="4" fill="#2d6a4f" />
          <circle cx="200" cy="214" r="6" fill="#173d2c" />
        </g>
        {[
          [70, 400],
          [110, 388],
          [150, 372],
          [190, 360],
        ].map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="5" fill="#2d6a4f" opacity={0.4 + i * 0.15} />
        ))}
        {[
          [330, 400],
          [290, 388],
          [250, 374],
          [212, 362],
        ].map((p, i) => (
          <circle
            key={"r" + i}
            cx={p[0]}
            cy={p[1]}
            r="5"
            fill="#2d6a4f"
            opacity={0.4 + i * 0.15}
          />
        ))}
      </svg>
      <span className="hero__art-note">Swap in a photo of your storefront</span>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="hero band-paper section">
      <div className="container hero__grid">
        <Reveal>
          <Eyebrow>For local businesses</Eyebrow>
          <h1 className="h-xl">
            Your next regulars live{" "}
            <span className="underline-amber">around the corner.</span>
          </h1>
          <p className="lead" style={{ marginTop: 22 }}>
            Leaf OS puts your business in front of the residents who live minutes from your
            door &mdash; inside the community calendar they actually trust. Post a deal or
            host an event.
          </p>
          <div className="cta-row" style={{ marginTop: 28 }}>
            <CTA to="partner" variant="primary" arrow>
              Become a partner
            </CTA>
            <CTA to="claim" variant="ghost">
              Claim your business for free
            </CTA>
          </div>
          <TrustStrip />
        </Reveal>

        <Reveal delay={120}>
          <div style={{ position: "relative" }}>
            <StorefrontArt />
            <div className="chip">
              <div className="chip__big">+67% spend</div>
              <div className="chip__label">
                Repeat customers spend 67% more than first-timers &mdash; and yours live next
                door.
              </div>
              <div style={{ marginTop: 10 }}>
                <Plaque>Bain &amp; Company</Plaque>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
