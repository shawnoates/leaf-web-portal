import { Eyebrow } from "./ui";
import Reveal from "./Reveal";

export default function Human() {
  return (
    <section className="band-white section">
      <div className="container">
        <div className="hero__grid">
          <Reveal>
            <Eyebrow>The human part</Eyebrow>
            <h2 className="h-lg">A hallway hello is worth more than a rent concession.</h2>
            <p className="lead" style={{ marginTop: 20 }}>
              People are more mobile and more isolated than they&rsquo;ve ever been. The
              building that feels like a community is the one they stay in &mdash; not because
              of a discount, but because they&rsquo;d be leaving people behind.
            </p>
            <p className="lead" style={{ marginTop: 16 }}>
              Leaf creates the small, real moments &mdash; a rooftop happy hour, a coffee
              morning, a tasting from the spot down the block &mdash; where neighbors actually
              become neighbors.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <figure style={{ margin: 0 }}>
              <blockquote
                style={{
                  fontFamily: "var(--display)",
                  fontSize: "clamp(1.5rem, 3vw, 2rem)",
                  lineHeight: 1.25,
                  color: "var(--forest)",
                  background: "var(--mint)",
                  borderRadius: "var(--radius)",
                  padding: "34px 32px",
                  margin: 0,
                  borderLeft: "4px solid var(--amber)",
                }}
              >
                &ldquo;The buildings with the best retention aren&rsquo;t the ones with the
                nicest lobbies. They&rsquo;re the ones where residents know each other&rsquo;s
                names.&rdquo;
              </blockquote>
              <figcaption
                style={{ marginTop: 14, color: "var(--muted)", fontSize: "0.9rem" }}
              >
                The pattern behind a decade of resident-retention research.
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
