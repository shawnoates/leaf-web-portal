"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Parse from "@/lib/parse-client";
import { SITE_URL } from "@/lib/site";
import { Loader2, Smartphone, MessageCircle } from "lucide-react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const APP_STORE_URL = "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

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
  // Override the "Get the app" tile href. Defaults to the universal /c/{id}
  // link, which is correct from /org/[shareId] (Safari follows it to the
  // chat landing). On the chat landing itself it would be a self-link, so
  // callers there should pass `leaf://planChat?planId=...` (iOS) or the App
  // Store URL.
  appLinkHref?: string;
}

export default function JoinChatPicker({
  eventGroupId,
  eventNotificationId,
  brandColor,
  onError,
  appLinkHref,
}: JoinChatPickerProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [buttonRendered, setButtonRendered] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  // The chat (and linking Google to it) is for the person who RSVP'd, signed
  // in. Right after an RSVP on the calendar page they already are; someone
  // arriving from a texted /c/ link confirms their phone with a code first —
  // the link alone isn't proof, since it can be forwarded.
  const [signedIn, setSignedIn] = useState(() => !!Parse.User.current());
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const digits = phone.replace(/\D/g, "").slice(-10);

  const sendCode = async () => {
    if (digits.length !== 10) { setPhoneError("Enter the number you RSVP'd with."); return; }
    setBusy(true); setPhoneError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setCodeSent(true);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally { setBusy(false); }
  };

  const confirmCode = async () => {
    setBusy(true); setPhoneError("");
    try {
      const r = (await Parse.Cloud.run("verifyOTP", { phone: `+1${digits}`, code })) as { sessionToken?: string } | string;
      const token = typeof r === "object" && r?.sessionToken ? r.sessionToken : null;
      if (!token) throw new Error("That code didn't work. Try again.");
      await Parse.User.become(token);
      setSignedIn(true);
      router.push(`/chat/${eventGroupId}`);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "That code didn't work. Try again.");
    } finally { setBusy(false); }
  };

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
    if (!scriptReady || buttonRendered || !signedIn) return;
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
  }, [scriptReady, buttonRendered, handleCredentialResponse, signedIn]);

  const appUrl = appLinkHref || `${SITE_URL}/c/${eventNotificationId}`;
  const accent = brandColor || "#18181b";

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h4 className="text-xl md:text-2xl font-light tracking-tight">Join the chat</h4>
        <p className="text-sm text-zinc-500">Coordinate with the other attendees</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
        {/* Left card: Get the app */}
        <a
          href={appUrl}
          className="group relative border-2 rounded-2xl p-6 md:p-7 flex flex-col items-center text-center gap-3 hover:bg-zinc-50 transition-colors"
          style={{ borderColor: accent }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: accent }}
          >
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold">Get the Leaf app</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Push notifications, split the bill, save photos
            </p>
          </div>
          <span
            className="text-xs uppercase tracking-wider font-bold mt-1"
            style={{ color: accent }}
          >
            Recommended
          </span>
        </a>

        {/* Right card: Continue in browser via Google */}
        <div className="border border-zinc-200 rounded-2xl p-6 md:p-7 flex flex-col items-center text-center gap-3 bg-white">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-zinc-700" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold">Join in your browser</p>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {signedIn ? "No app install. Add Google for email reminders." : "Confirm it's you with the number you RSVP'd with."}
            </p>
          </div>
          {!signedIn ? (
            <div className="w-full space-y-2 mt-1">
              {!codeSent ? (
                <input
                  type="tel"
                  autoComplete="tel-national"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile number"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base focus:outline-none focus:border-zinc-900"
                />
              ) : (
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-base tracking-[0.3em] focus:outline-none focus:border-zinc-900"
                />
              )}
              {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
              <button
                type="button"
                disabled={busy || (!codeSent ? digits.length !== 10 : code.length < 6)}
                onClick={codeSent ? confirmCode : sendCode}
                className="w-full rounded-xl text-white py-3 text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: accent }}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : codeSent ? "Open the chat" : "Text me a code"}
              </button>
              {codeSent && (
                <button type="button" onClick={() => { setCodeSent(false); setCode(""); }} className="text-xs text-zinc-500 underline">
                  Change number
                </button>
              )}
            </div>
          ) : (
          <>
          <button
            type="button"
            onClick={() => router.push(`/chat/${eventGroupId}`)}
            className="w-full rounded-xl text-white py-3 text-sm font-semibold mt-1"
            style={{ backgroundColor: accent }}
          >
            Open the chat
          </button>
          <div className="flex justify-center items-center min-h-[44px]">
            {signingIn ? (
              <div className="flex items-center gap-2 text-zinc-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
              </div>
            ) : !scriptReady ? (
              <div className="flex items-center gap-2 text-zinc-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : (
              <div ref={buttonRef} />
            )}
          </div>
          </>
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
