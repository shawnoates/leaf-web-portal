import { Eyebrow } from "./ui";
import Reveal from "./Reveal";

export default function Register() {
  return (
    <section className="band-forest section">
      <div className="container">
        <Reveal className="register">
          <Eyebrow>The register</Eyebrow>
          <p className="register__quote">
            We&rsquo;re not looking for testimonials. The best Leaf videos are{" "}
            <em>documentation of a good night</em> &mdash; one typed sentence at the start,
            your people in the middle, the RSVPs saying yes at the end.
          </p>
          <div className="register__beats">
            <span className="register__beat">Poetic</span>
            <span className="register__beat">Real</span>
            <span className="register__beat">Genuine</span>
            <span className="register__beat register__beat--ghost">Never salesy</span>
          </div>
          <p
            className="lead"
            style={{ margin: "26px auto 0", maxWidth: "48ch", textAlign: "center" }}
          >
            The script&rsquo;s a starting point &mdash; the delivery is all yours. If the
            favorite thing you&rsquo;ve ever posted is just your friends having a great time
            &mdash; this is for you.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
