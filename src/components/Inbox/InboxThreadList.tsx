"use client";

export interface InboxThread {
  threadKey: string;
  threadKind: "concierge" | "leaf_host" | string;
  calendarId: string;
  calendarName: string;
  planId: string | null;
  planTitle: string | null;
  personaName: string | null;
  personaAvatarUrl: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastMessageAuthor: string | null;
  lastMessageIsMine: boolean;
  unreadCount: number;
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return "now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Left pane of the inbox — thread selection. Selection is highlighted rather
// than navigated away from, so the right pane can stay mounted alongside it.
export default function InboxThreadList({
  threads,
  selectedKey,
  onSelect,
}: {
  threads: InboxThread[];
  selectedKey: string | null;
  onSelect: (t: InboxThread) => void;
}) {
  if (threads.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm text-zinc-500">No messages yet</p>
        <p className="text-xs text-zinc-400 mt-1">
          Messages from your concierge and plan hosts land here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {threads.map((t) => {
        const selected = t.threadKey === selectedKey;
        const heading = t.personaName || t.calendarName;
        const context = t.planTitle || t.calendarName;
        const subtitle = context === heading ? null : context;
        return (
          <button
            key={t.threadKey}
            type="button"
            onClick={() => onSelect(t)}
            className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-zinc-50 last:border-b-0 ${
              selected ? "bg-zinc-100" : "hover:bg-zinc-50"
            }`}
          >
            {t.personaAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.personaAvatarUrl}
                alt=""
                aria-hidden="true"
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-zinc-200"
              />
            ) : (
              // Initial beats a blank disc when a thread has no persona
              // assigned yet — it still reads as "someone".
              <div className="w-9 h-9 rounded-full bg-zinc-200 flex-shrink-0 flex items-center justify-center text-zinc-500 text-xs font-bold">
                {heading.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-900 truncate">
                  {heading}
                </p>
                <span className="text-[11px] text-zinc-400 flex-shrink-0">
                  {formatRelative(t.lastMessageAt)}
                </span>
              </div>
              {/* Plan name disambiguates — an owner can have several plan
                  threads with the same host running at once. Suppressed when
                  it would just repeat the heading (calendar thread with no
                  persona resolved). */}
              {subtitle && (
                <p className="text-[11px] text-zinc-400 truncate">{subtitle}</p>
              )}
              <p
                className={`text-xs mt-0.5 truncate ${
                  t.unreadCount > 0
                    ? "text-zinc-900 font-medium"
                    : "text-zinc-500"
                }`}
              >
                {t.lastMessageIsMine
                  ? "You: "
                  : t.lastMessageAuthor
                    ? `${t.lastMessageAuthor}: `
                    : ""}
                {t.lastMessagePreview || "No messages yet"}
              </p>
            </div>
            {t.unreadCount > 0 && (
              <span className="mt-1 min-w-[18px] h-[18px] px-1 rounded-full bg-zinc-900 text-white text-[10px] font-bold leading-[18px] text-center flex-shrink-0">
                {t.unreadCount > 9 ? "9+" : t.unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
