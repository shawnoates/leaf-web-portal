import Reveal from "../../resident-managers/components/Reveal";
import { Eyebrow } from "./ui";

/**
 * The page's center of gravity. The two columns are deliberately
 * asymmetric in tone: the left one is respectful and a little flat
 * (it's describing something that works and should be kept), the right
 * one is warm and specific. Don't "balance" them.
 */
export default function Difference() {
  return (
    <section id="difference" className="band-white section">
      <div className="container">
        <Reveal className="section-head">
          <Eyebrow>The difference</Eyebrow>
          <h2 className="h-lg">You already have a calendar. This is the other one.</h2>
        </Reveal>

        <div className="two-col">
          <Reveal className="col col--have">
            <h3 className="col__title">The calendar you have</h3>
            <p className="col__sub">Staff posts it. Everyone reads it.</p>
            <ul className="col__list">
              <li>Services and programming</li>
              <li>Youth night, small groups, the potluck</li>
              <li>Maintained by someone on payroll</li>
              <li>Grows only when you add something to run</li>
            </ul>
            <p className="col__foot">This is what Planning Center is for. Keep it.</p>
          </Reveal>

          <Reveal className="col col--dont" delay={100}>
            <h3 className="col__title">The calendar you don&rsquo;t</h3>
            <p className="col__sub">Members post it. Everyone joins it.</p>
            <ul className="col__list">
              <li>The hike someone&rsquo;s doing Saturday</li>
              <li>Coffee after service at the place down the block</li>
              <li>A meal train, a move, a run to the farmers market</li>
              <li>Grows on its own, with nobody running it</li>
            </ul>
            <p className="col__foot col__foot--leaf">This is Leaf.</p>
          </Reveal>
        </div>

        <Reveal>
          <p className="under-line">
            One is the church&rsquo;s program. The other is the church&rsquo;s life.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
