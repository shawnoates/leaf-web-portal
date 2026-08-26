// /score/<sid> — a shared reveal.
//
// People share results. That is the point of a scorecard, and every share is a
// warm click that cost nothing to buy. So the reveal has its own URL with its
// own unfurl showing the actual gauge and number, rather than the generic
// hero card.
//
// Server-rendered rather than client: the whole value here is the OG image and
// the number being in the HTML for the unfurler. Nothing on this page is
// interactive except the CTA, which is a link.
//
// This route is public and unauthenticated. The payload behind a sid is six
// self-reported ratings and a group type — no identity, nothing about the
// sharer's calendar or their people. An expired or bogus sid renders the
// take-it-yourself page instead of an error, because a dead link that still
// converts is worth more than a 404.

import type { Metadata } from "next";
import Link from "next/link";
import Parse from "@/lib/parse";
import { SITE_URL } from "@/lib/site";
import {
  WEAK_LINK_COPY,
  groupTypeFor,
  isValidSid,
  scorecardBandLabel,
  type ScorecardSession,
} from "@/lib/scorecard";
import ScoreCard from "../ScoreCard";
import ScoreFooter from "../ScoreFooter";

type PageProps = { params: Promise<{ sid: string }> };

async function fetchSession(sid: string): Promise<ScorecardSession | null> {
  if (!isValidSid(sid)) return null;
  try {
    const result = (await Parse.Cloud.run("getScorecardSession", {
      sid,
    })) as ScorecardSession | null;
    return result || null;
  } catch (err) {
    console.error("[/score/sid] getScorecardSession failed:", err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { sid } = await params;
  const session = await fetchSession(sid);

  if (!session) {
    return {
      title: "Your community has a score",
      description:
        "Six questions, about 30 seconds, and you'll see where your community stands.",
    };
  }

  const group = groupTypeFor(session.groupType);
  const title = `This ${group.noun} scored ${session.estimatedScore}.`;
  const description = `${scorecardBandLabel(session.band)} — measured on participation, retention, breadth, activity, member-led planning, and follow-through. See where yours lands.`;
  const image = `${SITE_URL}/api/og/scorecard?score=${session.estimatedScore}&band=${session.band}&noun=${encodeURIComponent(group.noun)}`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: `${SITE_URL}/score/${sid}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_URL}/score/${sid}`,
      siteName: "Leaf OS",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `A community scorecard showing ${session.estimatedScore} out of 100.`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharedRevealPage({ params }: PageProps) {
  const { sid } = await params;
  const session = await fetchSession(sid);

  // Expired, unknown, or malformed sid. Send them to take it themselves
  // rather than showing an error for something that isn't their fault.
  if (!session) {
    return (
      <>
        <main>
          <section className="hero wrap">
            <span className="eyebrow">
              <span className="dot" aria-hidden="true" />
              Updating live
            </span>
            <h1>That score has expired.</h1>
            <p className="sub">
              Results are kept for 30 days. You can find out where your own
              community stands in about 30 seconds.
            </p>
            <div className="hero-cta">
              <Link href="/score" className="btn">
                Get your score
              </Link>
              <p className="fineprint">Six questions. No account needed.</p>
            </div>
          </section>
        </main>
        <ScoreFooter />
      </>
    );
  }

  const group = groupTypeFor(session.groupType);
  const weak = WEAK_LINK_COPY[session.weakMetric];

  return (
    <>
      <main>
        <section className="reveal wrap">
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            A shared result
          </span>

          <ScoreCard
            score={session.estimatedScore}
            band={session.band}
            pillarScores={session.pillarScores}
            weakMetric={session.weakMetric}
            benchmark={session.benchmark}
            groupNoun={group.noun}
          />

          <div className="callout">
            <p>
              <span className="callout-label">Their weak link</span>
              {weak.callout}
            </p>
          </div>

          <div className="cta-block">
            <h2>Where does your community land?</h2>
            <p>
              Six questions about participation, retention, and who actually
              shows up. It takes about 30 seconds and needs no account.
            </p>
            <Link
              href="/score"
              className="btn"
              data-cta="score_shared_take_quiz"
            >
              Get your score
            </Link>
          </div>
        </section>
      </main>
      <ScoreFooter />
    </>
  );
}
