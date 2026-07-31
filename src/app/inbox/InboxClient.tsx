"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Parse from "@/lib/parse-client";
import InboxThreadList, { type InboxThread } from "@/components/Inbox/InboxThreadList";
import InboxThreadView from "@/components/Inbox/InboxThreadView";
import ConciergeThread from "@/components/ConciergeThread";
import AppHeader from "@/components/AppHeader";

interface InboxPayload {
  threads: InboxThread[];
  totalUnread: number;
}

// Two-pane inbox: thread list on the left, the selected conversation on the
// right. Cross-calendar by design — the inbox is the owner's, not a
// calendar's, so a co-host on three calendars sees one list.
//
// Concierge threads render the existing ConciergeThread in the right pane
// rather than the generic view: it carries the menu carousel and proposal
// cards, which are the whole point of that conversation.
//
// Mobile collapses to one column — the list, or the thread with a back arrow.
export default function InboxClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<InboxPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<InboxThread | null>(null);

  const load = useCallback(async () => {
    try {
      const result = (await Parse.Cloud.run("getInbox")) as InboxPayload;
      setPayload(result);
      return result;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = Parse.User.current();
    if (!user) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    setAuthed(true);
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Zero the badge the moment a thread is opened rather than waiting for the
  // next 30s poll — a count that lingers after you've read the thread reads as
  // broken. Concierge threads need the explicit mark because ConciergeThread
  // only touches the legacy read booleans, not InboxThreadRead.
  const selectThread = useCallback((t: InboxThread) => {
    setSelected(t);
    setPayload((prev) => {
      if (!prev) return prev;
      const hit = prev.threads.find((x) => x.threadKey === t.threadKey);
      if (!hit || hit.unreadCount === 0) return prev;
      return {
        totalUnread: Math.max(0, prev.totalUnread - hit.unreadCount),
        threads: prev.threads.map((x) =>
          x.threadKey === t.threadKey ? { ...x, unreadCount: 0 } : x,
        ),
      };
    });
    Parse.Cloud.run("markInboxThreadRead", {
      calendarId: t.calendarId,
      planId: t.planId || undefined,
    }).catch(() => undefined);
  }, []);

  // Deep link: /inbox?calendarId=…&planId=… selects that thread once the list
  // has loaded. This is what the "Reply in your inbox" email button targets.
  const wantCalendarId = searchParams.get("calendarId");
  const wantPlanId = searchParams.get("planId");
  useEffect(() => {
    if (selected || !payload?.threads.length || !wantCalendarId) return;
    const match = payload.threads.find(
      (t) => t.calendarId === wantCalendarId && (t.planId || null) === (wantPlanId || null),
    );
    if (match) selectThread(match);
  }, [payload, selected, wantCalendarId, wantPlanId, selectThread]);

  const threads = payload?.threads ?? [];
  const totalUnread = payload?.totalUnread ?? 0;

  if (authed === false) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-zinc-50 p-6">
        <div className="text-center">
          <p className="text-sm text-zinc-600">Sign in to see your inbox.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-zinc-50">
      {/* Same top bar as the dashboard, so the inbox reads as part of the app
          rather than a place you navigated away to. */}
      <AppHeader
        title="Inbox"
        subtitle={totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
        showBack
        showInbox={false}
      />

      <div className="flex-1 min-h-0 flex">
        {/* Left: thread list. Hidden on mobile once a thread is open. */}
        <aside
          className={`${
            selected ? "hidden md:block" : "block"
          } w-full md:w-[360px] lg:w-[400px] shrink-0 bg-white border-r border-zinc-200 overflow-y-auto`}
        >
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
            </div>
          ) : (
            <InboxThreadList
              threads={threads}
              selectedKey={selected?.threadKey ?? null}
              onSelect={selectThread}
            />
          )}
        </aside>

        {/* Right: the conversation. */}
        <main
          className={`${
            selected ? "flex" : "hidden md:flex"
          } flex-1 min-w-0 min-h-0 flex-col`}
        >
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-zinc-400">
                Select a conversation to read it.
              </p>
            </div>
          ) : selected.threadKind === "concierge" && !selected.planId ? (
            /* ConciergeThread is `w-full h-full flex flex-col` with its
               composer as the last child — it needs a padded, definite-height
               box or the composer sits flush against the viewport edge and
               clips. */
            <div className="flex-1 min-h-0 bg-white px-4 md:px-6 py-4 flex flex-col">
              <ConciergeThread calendarId={selected.calendarId} />
            </div>
          ) : (
            <InboxThreadView
              key={selected.threadKey}
              calendarId={selected.calendarId}
              planId={selected.planId}
              onRead={load}
              onBack={() => setSelected(null)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
