// Deliberately minimal: logo, sign in, privacy, terms. No nav, no pricing
// link, no blog.
//
// Pricing in particular is absent by design — it lives on the homepage, and
// this page never names a dollar figure. A visitor who came for a score and
// found a price list has been asked a different question than the one the ad
// promised. Nothing here should offer an exit that is not the CTA.

import Link from "next/link";

export default function ScoreFooter() {
  return (
    <footer>
      <nav aria-label="Legal and account">
        <Link href="/dashboard">Sign in</Link>
        <Link href="/privacy-policy">Privacy</Link>
        <Link href="/terms-conditions">Terms</Link>
      </nav>
      <p className="mark">Leaf OS</p>
    </footer>
  );
}
