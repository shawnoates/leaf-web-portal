import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site";
import ChatPollVoteClient from "./ChatPollVoteClient";
import { fetchPoll } from "./fetch-poll";

// og:image / twitter:image come from the colocated opengraph-image.tsx —
// file-based metadata merges over this object, so no `images` here.
type PageProps = {
  params: Promise<{ id: string; pollId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id: sessionId, pollId } = await params;
  const info = await fetchPoll(sessionId, pollId);

  if (!info) {
    return {
      title: "Leaf — Vote on a poll",
      description: "Cast your vote on a poll from the Leaf app.",
    };
  }

  const title = `${info.question} · Vote`;
  const description = info.chatName
    ? `Vote on a poll from ${info.chatName} on Leaf.`
    : "Cast your vote on a poll from the Leaf app.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${SITE_URL}/poll/${sessionId}/${pollId}`,
      siteName: "Leaf",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ChatPollVotePage({ params }: PageProps) {
  const { id: sessionId, pollId } = await params;
  const initial = await fetchPoll(sessionId, pollId);
  return (
    <ChatPollVoteClient
      sessionId={sessionId}
      pollId={pollId}
      initial={initial}
    />
  );
}
