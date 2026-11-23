// Emoji reactions on chat messages. Stored on the message as
// `reactions/{userId}: emoji`, so each person holds at most one per message.
// Mirrors leaf-appcode/Leaflet/Firebase/ChatReaction.swift.

export const DOUBLE_CLICK_REACTION = "❤️";
export const QUICK_REACTIONS = [DOUBLE_CLICK_REACTION, "👍", "😂", "😮", "😢", "🔥"];

export type Reactions = Record<string, string>;

export function reactionAfterPicking(emoji: string, current: string | undefined): string | null {
  return current === emoji ? null : emoji;
}

export function parseReactions(node: unknown): Reactions {
  if (!node || typeof node !== "object") return {};
  return Object.fromEntries(
    Object.entries(node).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""
    )
  );
}

export function reactionCounts(reactions: Reactions): Array<{ emoji: string; count: number }> {
  const counts = new Map<string, number>();
  for (const emoji of Object.values(reactions)) {
    counts.set(emoji, (counts.get(emoji) || 0) + 1);
  }
  return [...counts]
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count || (a.emoji < b.emoji ? -1 : 1));
}
