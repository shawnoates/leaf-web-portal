"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Parse from "@/lib/parse-client";
import { getChatDatabase, signInToChat } from "@/lib/firebase-client";
import {
  ref,
  onChildAdded,
  push as fbPush,
  set as fbSet,
  query,
  orderByChild,
  limitToLast,
} from "firebase/database";
import { Loader2, Send, ArrowLeft } from "lucide-react";
import MessageRow from "./MessageRow";
import type { FirMessage, UserLite } from "./types";

type AuthState = "checking" | "ready" | "denied" | "error";
const APP_STORE_URL = "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

export default function ChatShell({ eventGroupId }: { eventGroupId: string }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [calendarShareId, setCalendarShareId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FirMessage[]>([]);
  const [users, setUsers] = useState<Map<string, UserLite>>(new Map());
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef<string | null>(null);

  // Tell the server the user has caught up. Failures are silent — stale read
  // state just means an extra digest email, not a user-visible error.
  const markRead = useCallback(() => {
    Parse.Cloud.run("markChatRead", { eventGroupId }).catch(() => undefined);
  }, [eventGroupId]);

  // Auth + Firebase wiring. Runs once per eventGroupId.
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    async function init() {
      const user = Parse.User.current();
      if (!user) {
        setAuthState("denied");
        return;
      }
      currentUserIdRef.current = user.id;

      try {
        const tokenResult = (await Parse.Cloud.run("getChatToken", {
          eventGroupId,
        })) as {
          firebaseToken: string;
          planTitle?: string | null;
          calendarShareId?: string | null;
        };

        await signInToChat(tokenResult.firebaseToken);
        if (!mounted) return;
        if (tokenResult.planTitle) setPlanTitle(tokenResult.planTitle);
        if (tokenResult.calendarShareId) setCalendarShareId(tokenResult.calendarShareId);

        const db = getChatDatabase();
        const messagesRef = ref(db, `groups/${eventGroupId}/messages`);
        const recentMessages = query(
          messagesRef,
          orderByChild("timestamp"),
          limitToLast(100)
        );

        unsubscribe = onChildAdded(recentMessages, (snapshot) => {
          const msg = snapshot.val() as FirMessage;
          if (!msg) return;
          setMessages((prev) => {
            if (prev.some((m) => m.message_id === msg.message_id)) return prev;
            return [...prev, msg].sort(
              (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
            );
          });
        });

        setAuthState("ready");
        markRead();
      } catch (err) {
        if (!mounted) return;
        const code = (err as { code?: number })?.code;
        if (code === 141 /* OBJECT_NOT_FOUND from getChatToken */) {
          setAuthState("denied");
        } else {
          setAuthState("error");
          setErrorMsg(err instanceof Error ? err.message : "Could not load chat");
        }
      }
    }

    init();
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [eventGroupId, markRead]);

  // Mark chat as read when the tab regains focus.
  useEffect(() => {
    if (authState !== "ready") return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") markRead();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [authState, markRead]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Resolve sender names + avatars for any unseen users.
  useEffect(() => {
    const senderIds = new Set<string>();
    for (const m of messages) {
      if (m.from && m.from !== "leaf_ai" && !users.has(m.from)) {
        senderIds.add(m.from);
      }
    }
    if (senderIds.size === 0) return;

    const userQuery = new Parse.Query(Parse.User);
    userQuery.containedIn("objectId", Array.from(senderIds));
    userQuery
      .find()
      .then((found: Array<{ id: string; get: (k: string) => unknown }>) => {
        setUsers((prev) => {
          const next = new Map(prev);
          for (const u of found) {
            const pic = u.get("profilePicture") as
              | { url?: () => string }
              | string
              | undefined;
            const profilePicUrl =
              typeof pic === "string"
                ? pic
                : typeof pic?.url === "function"
                  ? pic.url()
                  : undefined;
            next.set(u.id, {
              objectId: u.id,
              name:
                (u.get("full_name") as string) ||
                (u.get("first_name") as string) ||
                "",
              profilePictureUrl: profilePicUrl,
            });
          }
          return next;
        });
      })
      .catch(() => undefined);
  }, [messages, users]);

  async function handleSend() {
    const text = composeText.trim();
    const userId = currentUserIdRef.current;
    if (!text || !userId || sending) return;
    setSending(true);
    setComposeText("");
    try {
      const db = getChatDatabase();
      const messagesRef = ref(db, `groups/${eventGroupId}/messages`);
      const newRef = fbPush(messagesRef);
      await fbSet(newRef, {
        message_id: newRef.key,
        text,
        from: userId,
        to: eventGroupId,
        timestamp: Date.now() / 1000,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
      setComposeText(text);
    } finally {
      setSending(false);
    }
  }

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="flex items-center gap-2 text-zinc-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading chat...
        </div>
      </div>
    );
  }

  if (authState === "denied") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-4">
          <h2 className="text-lg font-medium">You need to RSVP first</h2>
          <p className="text-sm text-zinc-500">
            This chat is for confirmed attendees. RSVP from the plan page to join.
          </p>
          <a
            href={APP_STORE_URL}
            className="inline-block bg-zinc-900 text-white px-6 py-3 text-xs uppercase tracking-[0.2em] font-bold rounded-lg"
          >
            Open in Leaf App
          </a>
        </div>
      </div>
    );
  }

  if (authState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-4">
          <h2 className="text-lg font-medium">Couldn&apos;t load the chat</h2>
          <p className="text-sm text-zinc-500">{errorMsg || "Please try again."}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-block bg-zinc-900 text-white px-6 py-3 text-xs uppercase tracking-[0.2em] font-bold rounded-lg"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-zinc-50 overflow-hidden">
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3 z-10 shrink-0">
        <button
          onClick={() => {
            // Always route back to the calendar's public page — that's the
            // canonical "parent" of any plan chat. Falls back to home for
            // chats whose calendar shareId we couldn't resolve.
            if (calendarShareId) {
              router.push(`/org/${calendarShareId}`);
            } else if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/");
            }
          }}
          aria-label="Back"
          className="p-1.5 -ml-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{planTitle || "Plan chat"}</h1>
          <p className="text-xs text-zinc-500">
            {messages.length} message{messages.length === 1 ? "" : "s"}
          </p>
        </div>
        <a
          href={APP_STORE_URL}
          className="text-xs text-zinc-500 hover:text-zinc-900 underline"
        >
          Open in app
        </a>
      </header>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="text-center text-sm text-zinc-400 py-12">
            No messages yet. Say hi!
          </div>
        ) : (
          messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const sameUser =
              prev &&
              prev.from === msg.from &&
              !prev.type &&
              !msg.type &&
              Math.abs((msg.timestamp || 0) - (prev.timestamp || 0)) < 60;
            return (
              <MessageRow
                key={msg.message_id || `${msg.timestamp}-${idx}`}
                message={msg}
                user={users.get(msg.from)}
                isFromCurrentUser={msg.from === currentUserIdRef.current}
                hideAvatar={Boolean(sameUser)}
              />
            );
          })
        )}
      </div>

      <div className="bg-white border-t border-zinc-200 px-4 py-3 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={composeText}
            onChange={(e) => setComposeText(e.target.value)}
            placeholder="Message"
            className="flex-1 border border-zinc-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-400"
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={!composeText.trim() || sending}
            className="bg-zinc-900 text-white p-2.5 rounded-lg disabled:opacity-40"
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
