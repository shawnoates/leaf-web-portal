import { CTA, Eyebrow } from "./ui";
import Reveal from "./Reveal";

export default function Pay() {
  return (
    <section className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>What you get</Eyebrow>
          <h2 className="h-lg">Paid for the video, bonused for the reach.</h2>
        </Reveal>

        <div className="grid grid-2">
          <Reveal className="card">
            <div className="pay__fig stat-fig">
              $50<em>&ndash;</em>150
            </div>
            <p className="pay__cap">
              <strong>Per video</strong>, depending on scope.
            </p>
            <p className="pay__sub">Paid via Venmo or Zelle within 24 hours of posting.</p>
          </Reveal>

          <Reveal className="card" delay={100}>
            <div className="pay__fig stat-fig">
              <em>+</em>Bonus
            </div>
            <p className="pay__cap">
              <strong>Performance bonus</strong> when your video passes a view threshold.
            </p>
            <p className="pay__sub">Bonuses pay out within 30 days once the threshold is confirmed.</p>
          </Reveal>
        </div>

        <Reveal className="inline-cta">
          <CTA variant="primary" arrow>
            Partner with us
          </CTA>
        </Reveal>
      </div>
    </section>
  );
}
