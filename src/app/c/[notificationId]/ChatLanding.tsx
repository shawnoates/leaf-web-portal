"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";

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
  const [redirectError, setRedirectError] = useState<string | null>(null);

  useEffect(() => {
    setIsIOS(isIOSDevice());
  }, []);

  // iOS: try the in-app deep link, fall back to App Store after a short delay.
  useEffect(() => {
    if (isIOS !== true) return;

    let cancelled = false;
    const onVisibilityChange = () => {
      if (document.hidden) cancelled = true;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.location.href = deepLink;
    const timer = window.setTimeout(() => {
      if (!cancelled) window.location.href = APP_STORE_URL;
    }, 1500);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isIOS, deepLink]);

  // Non-iOS: forward to the web chat at /chat/{eventGroupId}. Need to translate
  // notificationId -> eventGroupId via cloud function (cheap lookup).
  useEffect(() => {
    if (isIOS !== false) return;
    let cancelled = false;
    Parse.Cloud.run("getEventGroupIdForNotification", { notificationId })
      .then((result: { eventGroupId: string }) => {
        if (cancelled) return;
        if (result?.eventGroupId) {
          window.location.replace(`/chat/${result.eventGroupId}`);
        } else {
          setRedirectError("Could not find this chat.");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRedirectError(
          err instanceof Error ? err.message : "Could not open this chat."
        );
      });
    return () => {
      cancelled = true;
    };
  }, [isIOS, notificationId]);

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
      {isIOS === true && (
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
            Opening Leaf…
          </h1>
          <p style={{ fontSize: 14, margin: "0 0 24px 0" }}>
            Taking you to the plan chat.
          </p>
          <a
            href={deepLink}
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
            Open in Leaf
          </a>
          <p style={{ fontSize: 12, marginTop: 24 }}>
            Don&rsquo;t have the app?{" "}
            <a href={APP_STORE_URL} style={{ color: "#18181b" }}>
              Download Leaf
            </a>
          </p>
        </>
      )}

      {isIOS === false && !redirectError && (
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

      {isIOS === false && redirectError && (
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
            {redirectError}
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
