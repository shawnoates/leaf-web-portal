import { CTA, Plaque, SectionHead } from "./ui";
import Reveal from "./Reveal";

const steps = [
  {
    n: "01",
    h: "Tell us your slowest hours",
    b: "Pick the days and hours you’d most like to fill, and book a quick call. We’ll set up your free Neighbor Hour.",
  },
  {
    n: "02",
    h: "We bring the neighbors",
    b: "Your Neighbor Hour goes on your neighborhood’s Leaf calendar. Residents a short walk away RSVP. A typical one draws 8 to 15.",
  },
  {
    n: "03",
    h: "They come back",
    b: "They order their own, meet each other, and find their new spot. Book more when it works.",
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="section band-alt">
      <div className="container">
        <Reveal>
          <SectionHead
            eyebrow="How it works"
            title={<>It&rsquo;s a recommendation, not an ad.</>}
            lead={
              <>
                Residents see you inside their building&rsquo;s community, a place they
                trust, alongside their neighbors. Not as one more ad they scroll past.
                That&rsquo;s a fundamentally warmer way to be found.
              </>
            }
          />
        </Reveal>

        <div className="steps">
          {steps.map((s, i) => (
            <Reveal className="step" key={s.n} delay={i * 90}>
              <div className="step__n">{s.n}</div>
              <h3 className="step__title">{s.h}</h3>
              <p className="step__body">{s.b}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="trust-note">
          <span className="trust-note__mark" aria-hidden="true">
            &ldquo;
          </span>
          <div>
            <p>
              Personal, local recommendations are still the most trusted way people choose
              where to go, far more than ads or even online reviews. Leaf OS puts you
              on the right side of that: discovered by neighbors, in the community they trust.
            </p>
            <Plaque>Local consumer trust research</Plaque>
            <div className="inline-cta" style={{ marginTop: 28 }}>
              <CTA to="join" variant="primary" arrow>
                Claim your free Neighbor Hour
              </CTA>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
