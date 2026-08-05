import Reveal from "../../resident-managers/components/Reveal";
import { CTA, Eyebrow } from "./ui";

const steps = [
  {
    n: "1",
    h: "Claim your church",
    b: "Name, neighborhood, a link. That's the setup.",
  },
  {
    n: "2",
    h: "Share it once",
    b: "Bulletin, email, the noticeboard. Members open it without downloading anything.",
  },
  {
    n: "3",
    h: "Let them fill it",
    b: "The first few posts get it going. After that you're a reader like everyone else.",
  },
];

export default function Start() {
  return (
    <section id="start" className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>Getting started</Eyebrow>
          <h2 className="h-lg">Four minutes, then it&rsquo;s not your job anymore.</h2>
        </Reveal>

        <div className="steps steps--light">
          {steps.map((s, i) => (
            <Reveal className="step" key={s.n} delay={i * 90}>
              <div className="step__n">{s.n}</div>
              <h3>{s.h}</h3>
              <p>{s.b}</p>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="under-line">
            There&rsquo;s nothing to configure and nobody to onboard.
          </p>
          <div className="inline-cta">
            <CTA />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
