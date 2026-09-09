import Parse from "@/lib/parse";
import type { ChatPollInfo } from "./ChatPollVoteClient";

// Server-side read of a planning-chat poll, shared by the page (SSR +
// metadata) and the opengraph-image route. No guestId: the caller is a
// crawler or the first paint, neither of which has a guest identity yet.
export async function fetchPoll(
  sessionId: string,
  pollId: string,
): Promise<ChatPollInfo | null> {
  try {
    const result = (await Parse.Cloud.run("getPollForGuest", {
      sessionId,
      pollId,
    })) as ChatPollInfo;
    return result || null;
  } catch (err) {
    console.error("[/poll/:sid/:pid] getPollForGuest failed:", err);
    return null;
  }
}
