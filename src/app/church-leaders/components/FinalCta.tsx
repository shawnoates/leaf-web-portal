import Reveal from "../../resident-managers/components/Reveal";
import { CTA, ExampleLink, TrustStrip } from "./ui";

export function FinalCta() {
  return (
    <section className="band-forest section">
      <div className="container final" style={{ maxWidth: 760 }}>
        <Reveal>
          <h2 className="h-xl" style={{ fontSize: "clamp(2.1rem, 5vw, 3.3rem)" }}>
            Your church is already doing more than the calendar says.
          </h2>
          <p className="lead" style={{ margin: "20px auto 0" }}>
            Free, nothing to download, and your staff doesn&rsquo;t run it.
          </p>
          <div className="cta-stack" style={{ marginTop: 30 }}>
            <CTA />
            <ExampleLink />
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <TrustStrip items={["Free", "No card", "No app"]} />
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
          <a href="#difference">The difference</a>
          <a href="#posts">What shows up</a>
          <a href="#start">Getting started</a>
        </nav>
        <p className="footer__copy">
          Leaf OS builds the social side of neighborhoods. &copy;{" "}
          {new Date().getFullYear()} Leaf by One Common LLC.
        </p>
      </div>
    </footer>
  );
}
