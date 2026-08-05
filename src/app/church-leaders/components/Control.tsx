import Reveal from "../../resident-managers/components/Reveal";
import { Eyebrow } from "./ui";

/**
 * Lifted out of the FAQ on purpose. Every church leader thinks "so
 * anyone can post anything?" within five seconds of hearing
 * "member-led," and an unanswered version of that question is what
 * kills the signup.
 *
 * These three claims are only honest if the approval queue, one-tap
 * removal, and member attribution actually ship in the free tier. If
 * any of them isn't real yet, fix the product — don't soften the copy.
 */
const cards = [
  {
    h: "You approve what's public",
    b: "Posts visible to the neighborhood need your okay. Anything members-only goes up on its own.",
  },
  {
    h: "You can remove anything, instantly",
    b: "One tap. No support ticket, no waiting.",
  },
  {
    h: "Posts are clearly members', not yours",
    b: "A member's gathering shows their name, not the church's. Nobody mistakes a board game night for an official church event.",
  },
];

export default function Control() {
  return (
    <section className="band-forest section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>You&rsquo;re wondering</Eyebrow>
          <h2 className="h-lg">&ldquo;So anyone can post anything?&rdquo;</h2>
          <p className="lead">
            No. Member-led doesn&rsquo;t mean unmoderated. You stay in control of what
            carries your church&rsquo;s name.
          </p>
        </Reveal>

        <div className="grid grid-3">
          {cards.map((c, i) => (
            <Reveal className="card" key={c.h} delay={i * 90}>
              <h3 className="card__h">{c.h}</h3>
              <p className="card__b">{c.b}</p>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="under-line under-line--light">
            You&rsquo;re not signing up to police a feed. You&rsquo;re signing up to see
            what your people are already doing.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
