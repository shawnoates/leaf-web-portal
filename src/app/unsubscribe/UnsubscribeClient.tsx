"use client";

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Status = "working" | "done" | "error";

export default function UnsubscribeClient({
  userId,
  token,
}: {
  userId: string;
  token: string;
}) {
  const [status, setStatus] = useState<Status>("working");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!userId || !token) {
      setStatus("error");
      setErrorMsg("Missing unsubscribe parameters.");
      return;
    }
    Parse.Cloud.run("unsubscribeFromDigest", { userId, token })
      .then(() => setStatus("done"))
      .catch((err: unknown) => {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Could not unsubscribe.");
      });
  }, [userId, token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="max-w-md w-full bg-white border border-zinc-200 rounded-xl p-8 text-center space-y-4">
        {status === "working" && (
          <>
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-zinc-400" />
            <h1 className="text-lg font-medium">Unsubscribing...</h1>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
            <h1 className="text-lg font-medium">You&apos;re unsubscribed</h1>
            <p className="text-sm text-zinc-500">
              You won&apos;t receive daily chat digest emails anymore. You can
              still see messages by opening any plan chat directly.
            </p>
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
