"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import Parse from "@/lib/parse-client";
import {
  formatRelative,
  type InboxThread,
} from "@/components/Inbox/InboxThreadList";

interface InboxPayload {
  threads: InboxThread[];
  totalUnread: number;
}

const PEEK_LIMIT = 5;
const OPEN_DELAY_MS = 120;
const CLOSE_DELAY_MS = 220;

// Header entry point to the inbox — icon + unread badge, links to /inbox.
//
// Hovering peeks at the most recent threads without leaving the page; the
// full conversation lives on /inbox (list left, thread right). The peek is
// read-only on purpose: it answers "anything waiting on me?" at a glance, and
// anything past that is a click away in a surface that won't close on you.
//
// Always rendered, for every owner and co-host regardless of tier. An inbox
// that disappears when empty can't be learned — it needs to be in the same
// place every time, even at zero.
export default function OwnerInbox() {
  const [payload, setPayload] = useState<InboxPayload | null>(null);
  const [peeking, setPeeking] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const result = (await Parse.Cloud.run("getInbox")) as InboxPayload;
      setPayload(result);
    } catch {
      // Signed out or no calendars — leave the badge at zero rather than
      // spamming the console on every poll.
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };
  useEffect(() => clearTimers, []);

  // Small delays both ways: opening on a pointer that's merely passing through
  // is noise, and closing the instant the pointer leaves the icon makes the
  // gap between icon and panel impossible to cross.
  const openPeek = () => {
    clearTimers();
    openTimer.current = setTimeout(() => setPeeking(true), OPEN_DELAY_MS);
  };
  const closePeek = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => setPeeking(false), CLOSE_DELAY_MS);
  };

  const totalUnread = payload?.totalUnread ?? 0;
  const threads = payload?.threads ?? [];
  const peekThreads = threads.slice(0, PEEK_LIMIT);

  const threadHref = (t: InboxThread) =>
    t.planId
      ? `/inbox?calendarId=${t.calendarId}&planId=${t.planId}`
      : `/inbox?calendarId=${t.calendarId}`;

  return (
    <div
      className="relative"
      onMouseEnter={openPeek}
      onMouseLeave={closePeek}
    >
      <Link
        href="/inbox"
        aria-label={`Inbox${totalUnread > 0 ? ` (${totalUnread} unread)` : ""}`}
        className="relative p-2 rounded-full hover:bg-zinc-100 transition-colors inline-flex"
        onFocus={openPeek}
        onBlur={closePeek}
      >
        <Inbox className="w-5 h-5 text-zinc-600" />
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </Link>

      {/* Peek panel. Hidden from touch devices, where there is no hover and
          the tap should just open the page. */}
      {peeking && payload && (
        <div className="hidden md:block absolute right-0 pt-2 z-50">
          <div className="w-[340px] max-w-[95vw] bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-100 flex items-baseline justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Inbox
              </p>
              <span className="text-[11px] text-zinc-400">
                {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
              </span>
            </div>

            {peekThreads.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-zinc-500">No messages yet</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Messages from your concierge and plan hosts land here.
                </p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto">
                {peekThreads.map((t) => (
                  <Link
                    key={t.threadKey}
                    href={threadHref(t)}
                    className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-b-0"
                  >
                    {t.personaAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.personaAvatarUrl}
                        alt=""
                        aria-hidden="true"
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-zinc-200"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-200 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs font-semibold text-zinc-900 truncate">
                          {t.personaName || t.calendarName}
                        </p>
                        <span className="text-[10px] text-zinc-400 flex-shrink-0">
                          {formatRelative(t.lastMessageAt)}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] mt-0.5 truncate ${
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
                      <span className="mt-1 w-2 h-2 rounded-full bg-zinc-900 flex-shrink-0" />
                    )}
                  </Link>
                ))}
              </div>
            )}

            {threads.length > PEEK_LIMIT && (
              <Link
                href="/inbox"
                className="block px-4 py-2.5 text-center text-[11px] font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 border-t border-zinc-100"
              >
                View all {threads.length} conversations
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
