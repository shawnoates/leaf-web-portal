import type { Metadata } from "next";
import Parse from "@/lib/parse";
import PollVoteClient from "./PollVoteClient";

type PollOption = { date: string; time: string | null; count: number };

type PollInfo = {
  eventGroupId: string;
  title: string;
  description: string;
  image: string | null;
  calendar: {
    id: string;
    name: string;
    profilePhoto: string | null;
    brandColor: string | null;
  } | null;
  host: { name: string } | null;
  poll: {
    postId: string;
    options: PollOption[];
    totalVotes: number;
    expiresAt: string | null;
    isExpired: boolean;
  };
  guestVotedKeys: string[];
};

async function fetchPoll(eventGroupId: string): Promise<PollInfo | null> {
  try {
    const result = (await Parse.Cloud.run("getCalendarDatePollForGuest", {
      eventGroupId,
    })) as PollInfo;
    return result || null;
  } catch (err) {
    console.error("[/poll] getCalendarDatePollForGuest failed:", err);
    return null;
  }
}

type PageProps = {
  params: Promise<{ eventGroupId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { eventGroupId } = await params;
  const info = await fetchPoll(eventGroupId);

  if (!info) {
    return {
      title: "Leaf — Vote on a date",
      description: "Open this poll on Leaf.",
    };
  }

  const title = `${info.title} · Vote`;
  const descParts: string[] = [];
  if (info.calendar?.name) descParts.push(info.calendar.name);
  descParts.push(`${info.poll.options.length} date options`);
  const description = info.description || descParts.join(" · ");
  const ogImages = info.image ? [{ url: info.image }] : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://os.joinleaf.com/poll/${eventGroupId}`,
      images: ogImages,
      siteName: "Leaf",
    },
    twitter: {
      card: info.image ? "summary_large_image" : "summary",
      title,
      description,
      images: info.image ? [info.image] : undefined,
    },
  };
}

export default async function PollVotePage({ params }: PageProps) {
  const { eventGroupId } = await params;
  const initial = await fetchPoll(eventGroupId);
  return (
    <PollVoteClient eventGroupId={eventGroupId} initial={initial} />
  );
}
