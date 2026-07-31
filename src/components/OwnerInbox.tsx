"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import Parse from "@/lib/parse-client";
import InboxThreadDrawer from "./InboxThreadDrawer";

interface InboxThread {
  threadKey: string;
  threadKind: "concierge" | "virtual_host" | "leaf_host" | string;
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

interface InboxPayload {
  threads: InboxThread[];
  totalUnread: number;
}

function formatRelative(iso: string | null): string {
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

// Persistent owner inbox — always present in the dashboard header, for every
// owner and co-host regardless of tier. Lists every conversation they're part
// of: concierge threads, per-plan virtual-host threads, and (later)
// owner↔owner threads, all from the single `getInbox` aggregator.
//
// Unlike the old ConciergeInbox this does NOT hide itself when empty. An inbox
// that disappears can't be learned — owners need a stable place that is always
// where messages live, even when there are none yet.
//
// Concierge threads still route to the rich ConciergeThread drawer on the
// dashboard (it carries menu carousels and proposal cards this generic drawer
// doesn't). Plan threads open InboxThreadDrawer inline.
export default function OwnerInbox({
  currentCalendarId,
}: {
  currentCalendarId?: string;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<InboxPayload | null>(null);
  const [open, setOpen] = useState(false);
  const [activeThread, setActiveThread] = useState<InboxThread | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const result = (await Parse.Cloud.run("getInbox")) as InboxPayload;
      setPayload(result);
    } catch {
      // Signed out or no calendars — leave the inbox empty rather than
      // spamming the console on every poll.
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        panelRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const totalUnread = payload?.totalUnread ?? 0;
  const threads = payload?.threads ?? [];

  const openThread = useCallback(
    (t: InboxThread) => {
      setOpen(false);
      if (t.threadKind === "concierge" && !t.planId) {
        // Rich concierge surface lives on its own calendar's dashboard.
        if (t.calendarId === currentCalendarId) {
          router.replace(`/dashboard/${t.calendarId}?conciergeChat=1`);
        } else {
          router.push(`/dashboard/${t.calendarId}?conciergeChat=1`);
        }
        return;
      }
      setActiveThread(t);
    },
    [router, currentCalendarId],
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Inbox${totalUnread > 0 ? ` (${totalUnread} unread)` : ""}`}
        className="relative p-2 rounded-full hover:bg-zinc-100 transition-colors"
      >
        <Inbox className="w-5 h-5 text-zinc-600" />
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-[360px] max-w-[95vw] bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Inbox
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
            </p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {threads.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-zinc-500">No messages yet</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Messages from your concierge and plan hosts land here.
                </p>
              </div>
            ) : (
              threads.map((t) => (
                <button
                  key={t.threadKey}
                  type="button"
                  onClick={() => openThread(t)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-b-0"
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
                    <div className="w-9 h-9 rounded-full bg-zinc-200 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {t.personaName || t.calendarName}
                      </p>
                      <span className="text-[11px] text-zinc-400 flex-shrink-0">
                        {formatRelative(t.lastMessageAt)}
                      </span>
                    </div>
                    {/* Plan threads need the plan name to be distinguishable —
                        an owner can have several running at once. */}
                    <p className="text-[11px] text-zinc-400 truncate">
                      {t.planTitle || t.calendarName}
                    </p>
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
              ))
            )}
          </div>
        </div>
      )}

      {activeThread && (
        <InboxThreadDrawer
          calendarId={activeThread.calendarId}
          planId={activeThread.planId}
          onClose={() => {
            setActiveThread(null);
            load();
          }}
          onRead={load}
        />
      )}
    </div>
  );
}
