"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Parse from "@/lib/parse-client";
import { Loader2, Smartphone, MessageCircle } from "lucide-react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const APP_STORE_URL = "https://apps.apple.com/us/app/leaf-plans-with-friends/id1521960862";

let gisLoading = false;
let gisLoaded = false;

function loadGIS(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  if (gisLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (gisLoaded) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }
  gisLoading = true;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      gisLoading = false;
      resolve();
    };
    script.onerror = () => {
      gisLoading = false;
      reject(new Error("Failed to load Google Sign-In"));
    };
    document.head.appendChild(script);
  });
}

interface JoinChatPickerProps {
  eventGroupId: string;
  eventNotificationId: string;
  brandColor?: string;
  onError?: (message: string) => void;
}

export default function JoinChatPicker({
  eventGroupId,
  eventNotificationId,
  brandColor,
  onError,
}: JoinChatPickerProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [buttonRendered, setButtonRendered] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const handleCredentialResponse = useCallback(
    async (response: google.accounts.id.CredentialResponse) => {
      setSigningIn(true);
      try {
        const result = (await Parse.Cloud.run("linkGoogleAfterRsvp", {
          idToken: response.credential,
          eventNotificationId,
        })) as { sessionToken: string; eventGroupId: string };

        await Parse.User.become(result.sessionToken);
        router.push(`/chat/${result.eventGroupId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
        onError?.(msg);
        setSigningIn(false);
      }
    },
    [eventNotificationId, router, onError]
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    loadGIS()
      .then(() => setScriptReady(true))
      .catch(() => onError?.("Failed to load Google Sign-In"));
  }, [onError]);

  useEffect(() => {
    if (!scriptReady || buttonRendered) return;
    if (!buttonRef.current) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });

    google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 320,
    });

    setButtonRendered(true);
  }, [scriptReady, buttonRendered, handleCredentialResponse]);

  const appUrl = `https://os.joinleaf.com/c/${eventNotificationId}`;

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h4 className="text-base font-medium">Join the chat</h4>
        <p className="text-xs text-zinc-500">Coordinate with the other attendees</p>
      </div>

      <a
        href={appUrl}
        className="flex items-center gap-3 w-full border border-zinc-900 rounded-lg p-4 hover:bg-zinc-50 transition-colors"
        style={{ borderColor: brandColor || "#18181b" }}
      >
        <Smartphone className="w-5 h-5 shrink-0" style={{ color: brandColor || "#18181b" }} />
        <div className="flex-1 text-left">
          <p className="text-sm font-medium">Get the Leaf app</p>
          <p className="text-xs text-zinc-500">Push notifications, split bill, save photos</p>
        </div>
      </a>

      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <div className="flex-1 h-px bg-zinc-200" />
        <span>or</span>
        <div className="flex-1 h-px bg-zinc-200" />
      </div>

      <div className="border border-zinc-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-5 h-5 shrink-0 text-zinc-700" />
          <div className="flex-1">
            <p className="text-sm font-medium">Join in your browser</p>
            <p className="text-xs text-zinc-500">No app install. Get email reminders.</p>
          </div>
        </div>
        <div className="flex justify-center min-h-[40px]">
          {signingIn ? (
            <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
            </div>
          ) : !scriptReady ? (
            <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : (
            <div ref={buttonRef} />
          )}
        </div>
      </div>

      <p className="text-[11px] text-zinc-400 text-center">
        Don&apos;t have the app?{" "}
        <a href={APP_STORE_URL} className="underline hover:text-zinc-900">
          Download Leaf
        </a>
      </p>
    </div>
  );
}
