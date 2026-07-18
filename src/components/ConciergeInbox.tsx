"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import Parse from "@/lib/parse-client";

interface InboxThread {
  calendarId: string;
  calendarName: string;
  personaName: string;
  personaAvatarUrl: string | null;
  lastMessageBody: string | null;
  lastMessageAt: string | null;
  lastSenderRole: "owner" | "concierge" | null;
  unreadCount: number;
}

interface InboxPayload {
  threads: InboxThread[];
  totalUnread: number;
}

// Rough relative-time formatter — chat inboxes read better with
// "3h" than an ISO string. Not a full-featured lib because we only
// need the top-of-list glance.
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

// Owner-facing global concierge inbox — bell icon + dropdown. Hides
// itself entirely when the caller doesn't own any Concierge-tier
// calendars (server returns empty threads array).
//
// Poll cadence: 30s while mounted. Cheap enough for a shared query
// and matches the concierge admin surface's own polling interval.
//
// Click a thread → navigate to the calendar's dashboard with
// ?conciergeChat=1. The dashboard page reads that param and opens the
// existing concierge drawer.
export default function ConciergeInbox() {
  const router = useRouter();
  const [payload, setPayload] = useState<InboxPayload | null>(null);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const result = (await Parse.Cloud.run("getMyConciergeInbox")) as InboxPayload;
      setPayload(result);
    } catch {
      // Non-fatal — a signed-out user or one without a Concierge tier
      // just gets no inbox. Silently drop the error so a stray auth
      // failure doesn't spam the console on every page.
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click / Escape. Standard dropdown UX.
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
    (calendarId: string) => {
      setOpen(false);
      router.push(`/dashboard/${calendarId}?conciergeChat=1`);
    },
    [router],
  );

  // Hide entirely when the caller has no threads. Zero-state on the
  // inbox is noisy — nothing to click, no reason to show a bell.
  const shouldRender = useMemo(() => threads.length > 0, [threads.length]);
  if (!shouldRender) return null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Concierge inbox${totalUnread > 0 ? ` (${totalUnread} unread)` : ""}`}
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
          className="absolute right-0 mt-2 w-[340px] max-w-[95vw] bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-zinc-100">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Concierge inbox
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {totalUnread > 0
                ? `${totalUnread} unread`
                : "All caught up"}
            </p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {threads.map((t) => (
              <button
                key={t.calendarId}
                type="button"
                onClick={() => openThread(t.calendarId)}
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
                      {t.calendarName}
                    </p>
                    <span className="text-[11px] text-zinc-400 flex-shrink-0">
                      {formatRelative(t.lastMessageAt)}
                    </span>
                  </div>
                  <p
                    className={`text-xs mt-0.5 truncate ${t.unreadCount > 0 ? "text-zinc-900 font-medium" : "text-zinc-500"}`}
                  >
                    {t.lastSenderRole === "concierge"
                      ? `${t.personaName}: `
                      : t.lastSenderRole === "owner"
                        ? "You: "
                        : ""}
                    {t.lastMessageBody || "No messages yet"}
                  </p>
                </div>
                {t.unreadCount > 0 && (
                  <span className="mt-1 min-w-[18px] h-[18px] px-1 rounded-full bg-zinc-900 text-white text-[10px] font-bold leading-[18px] text-center flex-shrink-0">
                    {t.unreadCount > 9 ? "9+" : t.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
