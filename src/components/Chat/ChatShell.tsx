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
import { Loader2, Send, ArrowLeft, Calendar, MapPin, Users, X, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import MessageRow from "./MessageRow";
import type { FirMessage, UserLite } from "./types";

type AuthState = "checking" | "ready" | "denied" | "error";
type DeviceType = "ios" | "android" | "desktop";
const APP_STORE_URL = "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

function detectDevice(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export default function ChatShell({ eventGroupId }: { eventGroupId: string }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [calendarShareId, setCalendarShareId] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState<string | null>(null);
  const [planTimeString, setPlanTimeString] = useState<string | null>(null);
  const [planDescription, setPlanDescription] = useState<string | null>(null);
  const [planLocationName, setPlanLocationName] = useState<string | null>(null);
  const [attendeeCount, setAttendeeCount] = useState<number | null>(null);
  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceType>("desktop");
  const [showQrModal, setShowQrModal] = useState(false);
  const [messages, setMessages] = useState<FirMessage[]>([]);
  const [users, setUsers] = useState<Map<string, UserLite>>(new Map());
  const [composeText, setComposeText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setDevice(detectDevice());
  }, []);
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
          planDate?: string | null;
          planTimeString?: string | null;
          planDescription?: string | null;
          planLocationName?: string | null;
          attendeeCount?: number | null;
          notificationId?: string | null;
        };

        await signInToChat(tokenResult.firebaseToken);
        if (!mounted) return;
        if (tokenResult.planTitle) setPlanTitle(tokenResult.planTitle);
        if (tokenResult.calendarShareId) setCalendarShareId(tokenResult.calendarShareId);
        if (tokenResult.planDate) setPlanDate(tokenResult.planDate);
        if (tokenResult.planTimeString) setPlanTimeString(tokenResult.planTimeString);
        if (tokenResult.planDescription) setPlanDescription(tokenResult.planDescription);
        if (tokenResult.planLocationName) setPlanLocationName(tokenResult.planLocationName);
        if (typeof tokenResult.attendeeCount === "number") setAttendeeCount(tokenResult.attendeeCount);
        if (tokenResult.notificationId) setNotificationId(tokenResult.notificationId);

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
      // Fire-and-forget: notify other attendees via push (and one-time SMS
      // nudge for web RSVPers without the app). Same cloud function the iOS
      // app calls when it sends a chat message — keeps notification parity.
      Parse.Cloud.run("sendPushNotificationsToAttendeesOfGroup", {
        groupId: eventGroupId,
        message: text,
      }).catch((err: unknown) => {
        console.warn("[chat] push notification failed:", err);
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

  const handleBack = () => {
    if (calendarShareId) {
      router.push(`/org/${calendarShareId}`);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const formattedDate = planDate
    ? new Date(planDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : null;

  // Universal Link to /c/{notificationId} — same handler as the iOS deep
  // link entry route. Encodes the user's specific RSVP so the iOS app opens
  // the right plan chat. QR code on desktop renders this so a phone scan
  // routes through the app's own /c/ handling.
  const appLinkUrl = notificationId ? `https://os.joinleaf.com/c/${notificationId}` : null;
  const iosDeepLink = notificationId ? `leaf://planChat?planId=${notificationId}` : null;

  const handleOpenInApp = () => {
    if (!iosDeepLink) return;
    window.location.href = iosDeepLink;
    // Fall back to App Store if the app isn't installed.
    setTimeout(() => {
      window.location.href = APP_STORE_URL;
    }, 1500);
  };

  return (
    <div className="h-dvh flex flex-col md:flex-row bg-zinc-50 overflow-hidden">
      {/* Mobile-only top header (no sidebar shown). On desktop the sidebar carries the same nav. */}
      <header className="md:hidden bg-white border-b border-zinc-200 px-4 py-3 flex items-center gap-3 z-10 shrink-0">
        <button
          onClick={handleBack}
          aria-label="Back"
          className="p-1.5 -ml-1.5 text-zinc-500 hover:text-zinc-900 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{planTitle || "Plan chat"}</h1>
          <p className="text-xs text-zinc-500">
            {attendeeCount != null ? `${attendeeCount} attendee${attendeeCount === 1 ? "" : "s"}` : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {device === "ios" && iosDeepLink && (
          <button
            onClick={handleOpenInApp}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline"
          >
            Open in app
          </button>
        )}
      </header>

      {/* Desktop sidebar with plan details */}
      <aside className="hidden md:flex md:flex-col md:w-80 lg:w-96 bg-white border-r border-zinc-200 overflow-y-auto shrink-0">
        <div className="p-6 space-y-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to calendar
          </button>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-400 mb-2">
              Plan
            </p>
            <h1 className="text-2xl font-light tracking-tight text-zinc-900 leading-tight">
              {planTitle || "Plan chat"}
            </h1>
          </div>

          <div className="space-y-3 text-sm">
            {(formattedDate || planTimeString) && (
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
                <div className="text-zinc-700">
                  {formattedDate}
                  {formattedDate && planTimeString && <span className="text-zinc-400"> · </span>}
                  {planTimeString}
                </div>
              </div>
            )}
            {planLocationName && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
                <div className="text-zinc-700">{planLocationName}</div>
              </div>
            )}
            {attendeeCount != null && (
              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
                <div className="text-zinc-700">
                  {attendeeCount} attendee{attendeeCount === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </div>

          {planDescription && (
            <div className="pt-4 border-t border-zinc-100">
              <p className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-400 mb-2">
                About
              </p>
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                {planDescription}
              </p>
            </div>
          )}

          {/* Open-in-app CTA: desktop opens QR modal; iOS fires deep link with
              App Store fallback; Android is hidden (Leaf is iOS-only). */}
          {device !== "android" && iosDeepLink && (
            <div className="pt-4 border-t border-zinc-100">
              {device === "desktop" ? (
                <button
                  onClick={() => setShowQrModal(true)}
                  className="block w-full border border-zinc-200 py-2.5 text-xs uppercase tracking-[0.2em] font-bold text-center rounded-lg hover:bg-zinc-50 transition-colors text-zinc-900"
                >
                  Open in Leaf app
                </button>
              ) : (
                <button
                  onClick={handleOpenInApp}
                  className="block w-full border border-zinc-200 py-2.5 text-xs uppercase tracking-[0.2em] font-bold text-center rounded-lg hover:bg-zinc-50 transition-colors text-zinc-900"
                >
                  Open in Leaf app
                </button>
              )}
              <p className="text-[11px] text-zinc-400 text-center mt-2">
                Push notifications, split bill, save photos
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* QR modal — desktop only. Encodes the Universal Link to /c/{notificationId}
          so a scan from iPhone opens the plan chat in the app (or App Store). */}
      {showQrModal && appLinkUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-sm w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQrModal(false)}
              aria-label="Close"
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-900 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-2 text-zinc-900">
              <Smartphone className="w-5 h-5" />
              <h3 className="text-lg font-medium">Open in Leaf app</h3>
            </div>
            <p className="text-sm text-zinc-500 mb-6">
              Scan with your iPhone to open this chat in the Leaf app — or
              install it from the App Store if you don&rsquo;t have it yet.
            </p>
            <div className="flex justify-center bg-white border border-zinc-200 rounded-xl p-4">
              <QRCodeSVG value={appLinkUrl} size={220} level="M" />
            </div>
            <p className="text-[11px] text-zinc-400 text-center mt-4 break-all">
              {appLinkUrl}
            </p>
          </div>
        </div>
      )}

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop-only mini-header for the chat column */}
        <header className="hidden md:flex bg-white border-b border-zinc-200 px-6 py-4 items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium text-zinc-900">Chat</h2>
            <p className="text-xs text-zinc-500">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </p>
          </div>
        </header>

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3"
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

        <div className="bg-white border-t border-zinc-200 px-4 md:px-6 py-3 shrink-0">
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
    </div>
  );
}
