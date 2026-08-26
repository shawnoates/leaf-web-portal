// /score — the paid-social destination.
//
// The whole page is one client component because it is really three states of
// the same screen (hero → quiz → reveal), and the quiz is a single-screen
// takeover rather than a section further down. Splitting it into server-rendered
// sections would buy nothing: there is no content above the fold that isn't
// already in the client bundle, and the hero's idle gauge needs the client
// anyway.
//
// Metadata and the scoped stylesheet live in ./layout.tsx.

import ScorecardClient from "./ScorecardClient";
import ScoreFooter from "./ScoreFooter";

export default function ScorePage() {
  return (
    <>
      <ScorecardClient />
      <ScoreFooter />
    </>
  );
}
