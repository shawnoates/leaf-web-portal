"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { getVerifiedUserCookie } from "@/lib/verified-user";
import { Calendar, MessageCircle, Loader2, Users, EyeOff } from "lucide-react";

const APP_STORE_URL =
  "https://apps.apple.com/us/app/leaf-build-your-community/id1040588046";

type Attendee = { name: string; phone: string | null; sharePhoneWithHost: boolean };
type HypeData = {
  title: string;
  expiryDate: string | null;
  timeString: string | null;
  attendees: Attendee[];
  // Server confirms the caller is the host of this plan.
  isHost?: boolean;
  // Server confirms the caller can see the attendee roster + Message All —
  // true for hosts and confirmed attendees, false for random URL recipients.
  canSeeRoster?: boolean;
  hasAppOpenedChat: boolean;
};

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Send the visitor's verified phone (cookie set after RSVP/follow OTP)
        // so the server can decide whether to include the attendee roster.
        // Hosts and confirmed attendees of the plan get the roster; random
        // URL recipients don't.
        const cached = typeof window !== "undefined" ? getVerifiedUserCookie() : null;
        const phoneNumber = cached?.phone?.replace(/\D/g, "") || undefined;
        const result = (await Parse.Cloud.run("getHostHypePageData", {
          notificationId,
          phoneNumber,
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

  // Only attendees who opted in to sharing get included in the SMS bundle.
  // iOS Safari treats `+` in `sms:` URLs as a space and is inconsistent with
  // comma-separated multi-recipient `sms:phone1,phone2`. The `&addresses=`
  // query form is the documented way to populate multiple recipients on iOS.
  // Android handles either format fine.
  const sharingPhones = data.attendees
    .filter((a) => a.sharePhoneWithHost && a.phone)
    .map((a) => a.phone as string);
  const smsHref =
    sharingPhones.length > 0
      ? `sms:&addresses=${sharingPhones.map((p) => encodeURIComponent(p)).join(",")}`
      : null;

  // Route through /c/{notificationId} — that landing already handles iOS deep
  // link to the app vs. redirect to the web chat for non-iOS / no-app users.
  // Single source of truth for "open the chat" so /h/ stays in sync.
  const chatHref = `/c/${notificationId}`;

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
          {data.canSeeRoster
            ? "Join the plan chat in the app or your browser, or text every attendee at once from your phone."
            : "Join the plan chat in the app or your browser to coordinate with the group."}
        </p>

        <div className="space-y-3">
          <Link
            href={chatHref}
            className="block w-full bg-zinc-900 text-white py-3.5 text-xs uppercase tracking-[0.2em] font-bold text-center rounded-lg hover:opacity-90 transition-opacity"
          >
            Join Plan Chat
          </Link>
          {data.canSeeRoster && smsHref && (
            <a
              href={smsHref}
              className="flex items-center justify-center gap-2 w-full border border-zinc-200 py-3.5 text-xs uppercase tracking-[0.2em] font-bold rounded-lg hover:bg-zinc-50 transition-colors text-zinc-900"
            >
              <MessageCircle className="w-4 h-4" />
              Message All ({sharingPhones.length})
            </a>
          )}
          {data.canSeeRoster && !smsHref && (
            <p className="text-xs text-zinc-400 text-center py-2">
              No attendees have shared their number yet.
            </p>
          )}
        </div>

        {data.canSeeRoster && data.attendees.length > 0 && (
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
                  {a.sharePhoneWithHost && a.phone ? (
                    <a
                      href={`sms:${encodeURIComponent(a.phone)}`}
                      className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                      {a.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-300 flex items-center gap-1">
                      <EyeOff className="w-3 h-3" /> Hidden
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[11px] text-zinc-400 text-center mt-10">
          Don&rsquo;t have the app?{" "}
          <a href={APP_STORE_URL} className="underline hover:text-zinc-900">
            Download Leaf
          </a>
        </p>
      </div>
    </div>
  );
}
