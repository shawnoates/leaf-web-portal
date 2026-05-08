"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import JoinChatPicker from "@/components/JoinChatPicker";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Modern iPad reports as Mac — also check touch points to catch it.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

export default function ChatLanding({ notificationId }: { notificationId: string }) {
  const deepLink = `leaf://planChat?planId=${notificationId}`;
  const [isIOS, setIsIOS] = useState<boolean | null>(null);
  const [eventGroupId, setEventGroupId] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  useEffect(() => {
    setIsIOS(isIOSDevice());
    // Parse stores the session in localStorage; safe to read on client mount.
    setHasUser(!!Parse.User.current());
  }, []);

  // Translate notificationId -> eventGroupId so both branches can offer the
  // web chat as an option (iOS) or auto-redirect to it (non-iOS).
  useEffect(() => {
    if (isIOS === null) return;
    let cancelled = false;
    Parse.Cloud.run("getEventGroupIdForNotification", { notificationId })
      .then((result: { eventGroupId: string }) => {
        if (cancelled) return;
        if (result?.eventGroupId) {
          setEventGroupId(result.eventGroupId);
        } else {
          setLookupError("Could not find this chat.");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLookupError(err instanceof Error ? err.message : "Could not open this chat.");
      });
    return () => {
      cancelled = true;
    };
  }, [isIOS, notificationId]);

  // iOS: don't auto-fire the deep link — both Chrome and Safari show a "This
  // site is trying to open another application" prompt that's confusing for
  // users who don't have the app. Let them tap "Open in Leaf app" explicitly,
  // which still uses the same deep link.

  // Non-iOS: forward to /chat/{eventGroupId} as soon as we have the id —
  // but only if the user is already signed in. Unauthenticated visitors get
  // the Google sign-in flow rendered below (otherwise ChatShell would just
  // show the "You need to RSVP first" denied state).
  useEffect(() => {
    if (isIOS !== false) return;
    if (hasUser !== true) return;
    if (!eventGroupId) return;
    window.location.replace(`/chat/${eventGroupId}`);
  }, [isIOS, hasUser, eventGroupId]);

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        textAlign: "center",
        color: "#52525b",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {hasUser === false && eventGroupId && !lookupError && (
        <div style={{ width: "100%", maxWidth: 640 }}>
          <JoinChatPicker
            eventGroupId={eventGroupId}
            eventNotificationId={notificationId}
            appLinkHref={isIOS ? deepLink : APP_STORE_URL}
          />
        </div>
      )}

      {hasUser === true && isIOS === true && !lookupError && (
        <>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 300,
              letterSpacing: "0.02em",
              color: "#18181b",
              margin: "0 0 12px 0",
            }}
          >
            Join the Plan Chat
          </h1>
          <p style={{ fontSize: 14, margin: "0 0 32px 0", maxWidth: 360 }}>
            Open in the Leaf app for push notifications and split-the-bill, or
            continue in your browser.
          </p>
          <a
            href={deepLink}
            style={{
              display: "inline-block",
              backgroundColor: "#18181b",
              color: "#ffffff",
              padding: "14px 32px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: 8,
              minWidth: 240,
            }}
          >
            Open in Leaf app
          </a>
          {eventGroupId && (
            <a
              href={`/chat/${eventGroupId}`}
              style={{
                display: "inline-block",
                marginTop: 12,
                color: "#18181b",
                fontSize: 13,
                textDecoration: "underline",
              }}
            >
              Continue in browser
            </a>
          )}
          <p style={{ fontSize: 12, marginTop: 32 }}>
            Don&rsquo;t have the app?{" "}
            <a href={APP_STORE_URL} style={{ color: "#18181b" }}>
              Download Leaf
            </a>
          </p>
        </>
      )}

      {hasUser === true && isIOS === false && !lookupError && (
        <>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 300,
              letterSpacing: "0.02em",
              color: "#18181b",
              margin: "0 0 12px 0",
            }}
          >
            Opening chat…
          </h1>
          <p style={{ fontSize: 14, margin: "0 0 24px 0" }}>
            Taking you to your plan chat.
          </p>
        </>
      )}

      {lookupError && (
        <>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 300,
              letterSpacing: "0.02em",
              color: "#18181b",
              margin: "0 0 12px 0",
            }}
          >
            Couldn&rsquo;t open the chat
          </h1>
          <p style={{ fontSize: 14, margin: "0 0 24px 0", maxWidth: 360 }}>
            {lookupError}
          </p>
          <a
            href={APP_STORE_URL}
            style={{
              display: "inline-block",
              backgroundColor: "#18181b",
              color: "#ffffff",
              padding: "12px 32px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderRadius: 8,
            }}
          >
            Get the Leaf app
          </a>
        </>
      )}
    </div>
  );
}
