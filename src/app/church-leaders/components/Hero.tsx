import Reveal from "../../resident-managers/components/Reveal";
import PostCard from "./PostCard";
import { HERO_POSTS } from "./samplePosts";
import { CTA, Eyebrow, ExampleLink, TrustStrip } from "./ui";

/**
 * The hero visual is built, not photographed: a phone showing three
 * member posts. A stock photo of a congregation would show a pastor the
 * thing they already have — the whole pitch is in how obviously
 * unofficial these gatherings are, and only real card copy carries that.
 */
function HeroPhone() {
  return (
    <div
      className="phone"
      role="img"
      aria-label="A church community calendar on a phone, filled with gatherings members posted themselves"
    >
      <div className="phone__screen">
        <div className="phone__bar">
          <span className="phone__title">Grace Fellowship</span>
          <span className="phone__sub">This week</span>
        </div>
        <div className="phone__feed">
          {HERO_POSTS.map((p) => (
            <PostCard key={p.who} post={p} compact />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="hero band-paper section">
      <div className="container hero__grid">
        <Reveal>
          <Eyebrow>For pastors &amp; church leaders</Eyebrow>
          <h1 className="h-xl">
            The best things at your church never make it onto{" "}
            <span className="underline-amber">the calendar.</span>
          </h1>
          <p className="lead" style={{ marginTop: 22 }}>
            The Saturday hike. The moms at the park. The two people helping a family
            move. Leaf is a free calendar your members fill in themselves &mdash; so the
            life your church already has becomes something everyone can see and join.
            Nobody on your staff maintains it.
          </p>
          <div className="cta-stack cta-stack--start" style={{ marginTop: 28 }}>
            <CTA />
            <ExampleLink />
          </div>
          <TrustStrip />
        </Reveal>

        <Reveal delay={120} className="hero__visual">
          <HeroPhone />
        </Reveal>
      </div>
    </section>
  );
}
