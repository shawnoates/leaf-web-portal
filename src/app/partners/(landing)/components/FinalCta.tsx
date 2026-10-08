import { CTA, TrustStrip } from "./ui";
import Reveal from "./Reveal";

export function FinalCta() {
  return (
    <section className="band-forest section">
      <div className="container" style={{ textAlign: "center", maxWidth: 760 }}>
        <Reveal>
          <h2 className="h-xl" style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)" }}>
            Fill your slowest night with neighbors.
          </h2>
          <p className="lead" style={{ margin: "20px auto 0" }}>
            Your first night is free: no listing fee, no RSVP fees. Claim it in two minutes,
            and nothing is charged today.
          </p>
          <div
            className="cta-row"
            style={{ marginTop: 30, marginInline: "auto" }}
          >
            <CTA to="join" variant="primary" arrow>
              Claim your free night
            </CTA>
            <CTA to="login" variant="ghost">
              Partner sign in
            </CTA>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <TrustStrip />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__in">
        <a className="brand brand--light" href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/leaf-logo-white.svg" alt="Leaf" className="brand__logo" />
          <span className="brand__os brand__os--light">OS</span>
        </a>
        <nav className="footer__links">
          <a href="#nearby">The opportunity</a>
          <a href="#offer">What it costs</a>
          <a href="#how">How it works</a>
          <a href="/partners/login">Partner sign in</a>
        </nav>
        <p className="footer__copy">
          Leaf OS connects local businesses with the neighbors next door. &copy;{" "}
          {new Date().getFullYear()} Leaf by One Common LLC.
        </p>
      </div>
    </footer>
  );
}
