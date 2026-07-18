import { Eyebrow } from "./ui";
import Reveal from "./Reveal";

const items = [
  "You enjoy gathering people — a dinner crew, a run club, a book club, a couples’ circle, a “we’re doing something Saturday” energy",
  "1,000+ followers on TikTok or Instagram — engagement matters more than count",
  "Your content feels like real life, not ads",
];

export default function Looking() {
  return (
    <section className="band-white section">
      <div className="container">
        <div className="grid grid-2" style={{ gap: 24, alignItems: "center" }}>
          <Reveal className="section-head" style={{ marginBottom: 0 }}>
            <Eyebrow>Who we&rsquo;re looking for</Eyebrow>
            <h2 className="h-lg">The favorite thing you&rsquo;ve posted is your friends having a great time.</h2>
            <p className="lead" style={{ marginTop: 18 }}>
              If that&rsquo;s you, this is for you. We check your last five posts, not your
              follower count.
            </p>
          </Reveal>

          <Reveal className="card card--mint" delay={100} style={{ color: "var(--ink)" }}>
            <ul className="checklist">
              {items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
