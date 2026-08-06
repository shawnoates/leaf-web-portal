import Reveal from "../../resident-managers/components/Reveal";
import { CTA, Eyebrow, ExampleLink, TrustStrip } from "./ui";

/**
 * The hero deliberately does NOT show the calendar. "What shows up"
 * further down is the section that renders member posts, and putting a
 * phone full of the same cards up here made the two read as reruns of
 * each other. A photograph of people mid-gathering carries the warmth
 * the cards can't, and leaves the cards to do their job once.
 *
 * Per the brief: no worship service and no staff-planned event in this
 * image — that would show a pastor the calendar they already have.
 * Also keep it alcohol-free. The first pick here was a long table with
 * beer and wine on it, which is a bad look in front of this audience
 * for the same reason the brief wants alcohol-forward deals suppressed.
 */
function HeroArt() {
  return (
    <div
      className="hero__art"
      role="img"
      aria-label="A group of people standing arm in arm, looking out over a view together"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1000&q=80"
        alt=""
        className="hero__photo"
      />
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
            The best things at your church never make{" "}
            <span className="underline-amber">the calendar.</span>
          </h1>
          <p className="lead" style={{ marginTop: 20 }}>
            The Saturday hike. The moms at the park. The two people helping a family
            move.
          </p>
          <p className="lead" style={{ marginTop: 14 }}>
            Leaf is a free calendar your members fill in themselves. The gatherings that
            already happen become easy for everyone to find and join &mdash; and nobody
            on your staff maintains it.
          </p>
          <div className="cta-stack cta-stack--start" style={{ marginTop: 26 }}>
            <CTA />
            <ExampleLink />
          </div>
          <TrustStrip />
        </Reveal>

        <Reveal delay={120} className="hero__visual">
          <HeroArt />
        </Reveal>
      </div>
    </section>
  );
}
