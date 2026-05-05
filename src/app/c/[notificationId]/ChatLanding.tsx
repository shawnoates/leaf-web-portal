"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Modern iPad reports as Mac — also check touch points to catch it.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

export default function ChatLanding({ notificationId }: { notificationId: string }) {
  // Existing iOS deep link from AppVM.swift:
  //   leaf://planChat?planId={eventNotificationId}
  const deepLink = `leaf://planChat?planId=${notificationId}`;

  // Hydrate-safe iOS detection — `null` until first effect tick to avoid a
  // server/client UI mismatch flash.
  const [isIOS, setIsIOS] = useState<boolean | null>(null);

  useEffect(() => {
    setIsIOS(isIOSDevice());
  }, []);

  // On iOS, auto-fire the deep link and fall back to the App Store after a
  // short delay if the app isn't installed (matches the previous behavior).
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
          <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: "0.02em", color: "#18181b", margin: "0 0 12px 0" }}>
            Opening Leaf…
          </h1>
          <p style={{ fontSize: 14, margin: "0 0 24px 0" }}>Taking you to the plan chat.</p>
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

      {isIOS === false && (
        <>
          {/* Leaf is iOS-only — on desktop / Android show a QR so the user
              can scan with their iPhone (opens Leaf or App Store fallback). */}
          <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: "0.02em", color: "#18181b", margin: "0 0 8px 0" }}>
            Join the Plan Chat
          </h1>
          <p style={{ fontSize: 14, margin: "0 0 24px 0", maxWidth: 360 }}>
            Leaf is on iOS. Scan this code with your iPhone to open the plan chat.
          </p>
          <div style={{ background: "#fff", padding: 12, border: "1px solid #e4e4e7", borderRadius: 12 }}>
            <QRCodeSVG value={deepLink} size={200} level="M" />
          </div>
          <p style={{ fontSize: 12, marginTop: 24 }}>
            <a href={APP_STORE_URL} style={{ color: "#18181b", textDecoration: "underline" }}>
              Download Leaf for iOS
            </a>
          </p>
        </>
      )}
    </div>
  );
}
