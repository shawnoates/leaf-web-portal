"use client";

import { useEffect } from "react";

export default function ChatRedirect({
  deepLink,
  appStoreUrl,
}: {
  deepLink: string;
  appStoreUrl: string;
}) {
  useEffect(() => {
    // Try to open the iOS app via the leaf:// scheme. If the app is installed
    // it will intercept the navigation and the visibilitychange handler below
    // will fire (so we cancel the App Store fallback).
    let cancelled = false;

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelled = true;
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Kick off the deep link.
    window.location.href = deepLink;

    // If we're still here after 1.5s, assume the app isn't installed and
    // bounce to the App Store. Skip on non-iOS devices entirely.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (isIOS) {
        window.location.href = appStoreUrl;
      }
    }, 1500);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [deepLink, appStoreUrl]);

  return null;
}
