"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Status = "working" | "done" | "error";
type Mode = "muteChat" | "unfollowCalendar" | "ownerDrip" | "digest";

export default function UnsubscribeClient({
  userId,
  token,
  eventGroupId,
  calendarId,
  kind,
}: {
  userId: string;
  token: string;
  eventGroupId: string;
  calendarId: string;
  kind?: string;
}) {
  const [status, setStatus] = useState<Status>("working");
  const [errorMsg, setErrorMsg] = useState<string>("");
  // `k` is checked first: the owner drip carries no group or calendar id, and
  // without this it would fall through to the chat-digest handler and opt the
  // recipient out of the wrong thing.
  const mode: Mode =
    kind === "owner-drip"
      ? "ownerDrip"
      : eventGroupId
        ? "muteChat"
        : calendarId
          ? "unfollowCalendar"
          : "digest";

  useEffect(() => {
    if (!userId || !token) {
      setStatus("error");
      setErrorMsg("Missing unsubscribe parameters.");
      return;
    }
    const call =
      mode === "muteChat"
        ? Parse.Cloud.run("muteChatFromEmail", { userId, eventGroupId, token })
        : mode === "unfollowCalendar"
          ? Parse.Cloud.run("unfollowCalendarFromEmail", { userId, calendarId, token })
          : mode === "ownerDrip"
            ? Parse.Cloud.run("unsubscribeFromOwnerDrip", { userId, token })
            : Parse.Cloud.run("unsubscribeFromDigest", { userId, token });

    call
      .then(() => setStatus("done"))
      .catch((err: unknown) => {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Could not unsubscribe.");
      });
  }, [userId, token, eventGroupId, calendarId, mode]);

  const doneCopy = (() => {
    switch (mode) {
      case "muteChat":
        return {
          title: "Chat muted",
          body: "You won't get email digests for this chat anymore. You're still in the chat — open it in Leaf to unmute.",
        };
      case "ownerDrip":
        return {
          title: "You're unsubscribed",
          body: "You won't receive Leaf emails for calendar owners anymore. This doesn't change your chat digest or any calendar you follow.",
        };
      case "unfollowCalendar":
        return {
          title: "Calendar unfollowed",
          body: "You won't get email updates about new plans on this calendar anymore. You can re-follow it from its plan page anytime.",
        };
      default:
        return {
          title: "You're unsubscribed",
          body: "You won't receive daily chat digest emails anymore. You can still see messages by opening any plan chat directly.",
        };
    }
  })();

  const workingTitle =
    mode === "muteChat"
      ? "Muting chat..."
      : mode === "unfollowCalendar"
        ? "Unfollowing calendar..."
        : "Unsubscribing...";

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="max-w-md w-full bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-4">
        {status === "working" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-zinc-400" />
            <h1 className="text-lg font-medium">{workingTitle}</h1>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
            <h1 className="text-lg font-medium">{doneCopy.title}</h1>
            <p className="text-sm text-zinc-500">{doneCopy.body}</p>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="w-10 h-10 mx-auto text-rose-600" />
            <h1 className="text-lg font-medium">Couldn&apos;t unsubscribe</h1>
            <p className="text-sm text-zinc-500">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
