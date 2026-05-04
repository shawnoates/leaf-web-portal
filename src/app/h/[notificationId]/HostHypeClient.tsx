"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, MessageCircle, Loader2, Users } from "lucide-react";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

type Attendee = { name: string; phone: string };
type HypeData = {
  title: string;
  expiryDate: string | null;
  timeString: string | null;
  attendees: Attendee[];
  hasAppOpenedChat: boolean;
};

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Modern iPad reports as Mac — also check touch points to catch it.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
}

function formatWhen(expiryDate: string | null, timeString: string | null): string {
  if (!expiryDate) return "";
  const date = new Date(expiryDate);
  const day = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  if (timeString) return `${day} • ${timeString}`;
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} • ${time}`;
}

export default function HostHypeClient({ notificationId }: { notificationId: string }) {
  const [data, setData] = useState<HypeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Hydrate-safe iOS detection — `false` on server, real value on first effect.
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(isIOSDevice());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = (await Parse.Cloud.run("getHostHypePageData", {
          notificationId,
        })) as HypeData;
        if (!cancelled) setData(result);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load this plan.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notificationId]);

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8 text-center">
        <p className="text-sm text-zinc-500">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  const deepLink = `leaf://planChat?planId=${notificationId}`;
  // iOS Safari treats `+` in `sms:` URLs as a space and is inconsistent with
  // comma-separated multi-recipient `sms:phone1,phone2`. The `&addresses=`
  // query form is the documented way to populate multiple recipients on iOS.
  // Android handles either format fine.
  const smsHref =
    data.attendees.length > 0
      ? `sms:&addresses=${data.attendees.map((a) => encodeURIComponent(a.phone)).join(",")}`
      : null;

  const handleOpenChat = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.location.href = deepLink;
    setTimeout(() => {
      window.location.href = APP_STORE_URL;
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto px-6 py-10">
        <p className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-400 mb-2">
          Your plan starts soon
        </p>
        <h1 className="text-2xl font-light tracking-tight text-zinc-900 mb-1">
          {data.title}
        </h1>
        {data.expiryDate && (
          <p className="text-sm text-zinc-500 flex items-center gap-1.5 mb-8">
            <Calendar className="w-3.5 h-3.5" />
            {formatWhen(data.expiryDate, data.timeString)}
          </p>
        )}

        <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
          Join the plan chat in the app or text every attendee at once from
          your phone.
        </p>

        <div className="space-y-3">
          {isIOS ? (
            <a
              href={deepLink}
              onClick={handleOpenChat}
              className="block w-full bg-zinc-900 text-white py-3.5 text-xs uppercase tracking-[0.2em] font-bold text-center rounded-lg hover:opacity-90 transition-opacity"
            >
              Join Plan Chat
            </a>
          ) : (
            // Leaf is iOS-only. On non-iOS (desktop, Android), show a QR code
            // so the host can scan with their iPhone — opens directly into
            // the plan chat if Leaf is installed, App Store fallback otherwise.
            <div className="flex flex-col items-center gap-2 p-5 border border-zinc-200 rounded-lg">
              <p className="text-xs uppercase tracking-[0.15em] font-bold text-zinc-700">
                Join Plan Chat
              </p>
              <p className="text-[11px] text-zinc-500 text-center">
                Scan with your iPhone to open the chat in Leaf.
              </p>
              <div className="bg-white p-2 rounded">
                <QRCodeSVG value={deepLink} size={160} level="M" />
              </div>
              <a
                href={APP_STORE_URL}
                className="text-[11px] text-zinc-500 underline hover:text-zinc-900"
              >
                Or download Leaf for iOS
              </a>
            </div>
          )}
          {smsHref ? (
            <a
              href={smsHref}
              className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-3.5 text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-zinc-50 transition-colors text-zinc-900"
            >
              <MessageCircle className="w-4 h-4" />
              Message All ({data.attendees.length})
            </a>
          ) : (
            <p className="text-xs text-zinc-400 text-center py-2">
              No attendees have shared their number yet.
            </p>
          )}
        </div>

        {data.attendees.length > 0 && (
          <div className="mt-8 pt-6 border-t border-zinc-100">
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1.5 mb-3">
              <Users className="w-3.5 h-3.5" /> Attendees ({data.attendees.length})
            </h2>
            <div className="space-y-2">
              {data.attendees.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-1.5 border-b border-zinc-50 last:border-0"
                >
                  <span className="text-sm text-zinc-800">{a.name}</span>
                  <a
                    href={`sms:${encodeURIComponent(a.phone)}`}
                    className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
                  >
                    {a.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {isIOS && (
          <p className="text-[11px] text-zinc-400 text-center mt-10">
            Don&rsquo;t have the app?{" "}
            <a href={APP_STORE_URL} className="underline hover:text-zinc-900">
              Download Leaf
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
