import { ImageResponse } from "next/og";
import { SITE_HOST } from "@/lib/site";
import { fetchPoll } from "./fetch-poll";

// 1200x630 unfurl card for a planning-chat poll link (iMessage, WhatsApp,
// Slack). Shows the question and the first few options so the recipient
// knows what they're being asked before they tap — the generic site card
// the root layout serves says nothing about the poll.
//
// Same dark-green ground and system type as /api/og/* so a Leaf link looks
// like a Leaf link wherever it lands. Satori (what next/og rasterizes with)
// supports neither external stylesheets nor the app's font loader, and every
// multi-child element must be display:flex.
//
// Vote counts change while the link is being passed around, so this is
// rendered per request rather than cached at first unfurl.
export const dynamic = "force-dynamic";

export const alt = "Vote on this poll on Leaf";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MAX_OPTIONS_SHOWN = 4;
const OPTION_TEXT_MAX = 28;

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function questionFontSize(question: string): number {
  if (question.length <= 40) return 68;
  if (question.length <= 80) return 56;
  return 44;
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string; pollId: string }>;
}) {
  const { id: sessionId, pollId } = await params;
  const poll = await fetchPoll(sessionId, pollId);

  const question = clip(poll?.question || "Vote on a poll", 120);
  const eyebrow = poll?.chatName || "Leaf · Poll";
  const options = poll?.options ?? [];
  const shown = options.slice(0, MAX_OPTIONS_SHOWN);
  const extra = options.length - shown.length;
  const totalVotes = options.reduce((sum, o) => sum + o.voteCount, 0);
  const footer = poll
    ? poll.expired
      ? "Voting has closed"
      : totalVotes === 0
        ? "Be the first to vote"
        : `${totalVotes} ${totalVotes === 1 ? "vote" : "votes"} so far · Tap to vote`
    : "Open this poll on Leaf";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 80px",
          background:
            "linear-gradient(135deg, #253A33 0%, #1a2d27 60%, #0f1f1a 100%)",
          color: "#f4f6f5",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "22px",
              fontWeight: 600,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "#a7bfa9",
            }}
          >
            {clip(eyebrow, 40)}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: `${questionFontSize(question)}px`,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-2px",
              maxWidth: "1040px",
            }}
          >
            {question}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
          {shown.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
              {shown.map((opt) => (
                <div
                  key={opt.id}
                  style={{
                    display: "flex",
                    padding: "12px 22px",
                    borderRadius: "999px",
                    border: "2px solid rgba(255,255,255,0.28)",
                    fontSize: "26px",
                    fontWeight: 500,
                    color: "#f4f6f5",
                  }}
                >
                  {clip(opt.text, OPTION_TEXT_MAX)}
                </div>
              ))}
              {extra > 0 && (
                <div
                  style={{
                    display: "flex",
                    padding: "12px 22px",
                    borderRadius: "999px",
                    fontSize: "26px",
                    fontWeight: 500,
                    color: "#a7bfa9",
                  }}
                >
                  +{extra} more
                </div>
              )}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "26px",
            }}
          >
            <div style={{ display: "flex", color: "#f4f6f5", fontWeight: 500 }}>
              {footer}
            </div>
            <div style={{ display: "flex", color: "#6f7c76", fontWeight: 600 }}>
              {SITE_HOST}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
