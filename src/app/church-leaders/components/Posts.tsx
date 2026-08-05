import Reveal from "../../resident-managers/components/Reveal";
import PostCard from "./PostCard";
import { POSTS } from "./samplePosts";
import { Eyebrow } from "./ui";

/**
 * "What shows up" — shown, not told. A pastor needs to be able to
 * picture what actually lands on this calendar, and sample posts do
 * more work here than any adjective would.
 */
export default function Posts() {
  return (
    <section id="posts" className="band-mint section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>What shows up</Eyebrow>
          <h2 className="h-lg">Things your staff would never have scheduled.</h2>
        </Reveal>

        <div className="feed">
          {POSTS.map((p, i) => (
            <Reveal key={p.who} delay={(i % 3) * 80}>
              <PostCard post={p} />
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="under-line">
            None of this needed approval, a budget, or a volunteer coordinator. It just
            needed somewhere to be posted.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
