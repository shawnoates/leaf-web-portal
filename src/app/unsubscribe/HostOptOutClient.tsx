"use client";

/**
 * Host offer opt-out — /unsubscribe?h=<rosterHostId>&k=host-offers&t=<hmac>
 *
 * Unlike every other unsubscribe kind, this one does NOT fire on load. It
 * offers a choice, because "stop emailing me" and "I'm done" are different asks
 * and collapsing them loses people who only wanted a break.
 *
 * The confirmation deliberately leads with any night they have already accepted
 * — opting out never cancels one, and a host who thinks it did is a no-show.
 */

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { CheckCircle2, AlertCircle } from "lucide-react";

type Result = {
  mode: "pause" | "remove";
  stillOnFor: { title: string; whenLabel: string } | null;
};

export default function HostOptOutClient({
  hostId,
  token,
}: {
  hostId: string;
  token: string;
}) {
  const [busy, setBusy] = useState<"pause" | "remove" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const run = async (mode: "pause" | "remove") => {
    setBusy(mode);
    setError(null);
    try {
      const r = await Parse.Cloud.run("optOutHostFromOffers", { hostId, token, mode });
      setResult({ mode, stillOnFor: r.stillOnFor ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  if (!hostId || !token) {
    return (
      <Frame>
        <AlertCircle className="h-6 w-6 text-red-600" />
        <h1 className="mt-3 text-xl font-semibold text-zinc-900">
          That link is incomplete
        </h1>
        <p className="mt-2 text-[15px] text-zinc-600">
          Try tapping it again from the original email.
        </p>
      </Frame>
    );
  }

  if (result) {
    return (
      <Frame>
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        <h1 className="mt-3 text-xl font-semibold text-zinc-900">
          {result.mode === "remove" ? "You're off the list." : "We'll stop asking."}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
          {result.mode === "remove"
            ? "We've removed your details. If you ever want to come back, you're welcome to apply again."
            : "We won't email you about new nights. If you change your mind, just reply to any of our old emails and we'll switch you back on."}
        </p>
        {/* The important line. Opting out never cancels an accepted night, and
            a host who assumes it did simply doesn't turn up. */}
        {result.stillOnFor && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-[15px] leading-relaxed text-amber-900">
            <strong>You&rsquo;re still on for {result.stillOnFor.title}</strong> on{" "}
            {result.stillOnFor.whenLabel}. That one still stands — we just
            won&rsquo;t ask again after it. If you can&rsquo;t make it, use the
            link in your confirmation email to let us know.
          </div>
        )}
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="text-xl font-semibold text-zinc-900">
        Stop hearing about new nights?
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-zinc-600">
        Two options, depending on what you want.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-[15px] font-medium text-zinc-900">
            Just stop emailing me
          </p>
          <p className="mt-1 text-[14px] leading-snug text-zinc-600">
            You stay on the list. We keep your details and stop getting in touch
            until you tell us otherwise.
          </p>
          <button
            onClick={() => run("pause")}
            disabled={busy !== null}
            className="mt-3 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-[15px] font-medium text-white disabled:opacity-50"
          >
            {busy === "pause" ? "One moment…" : "Stop emailing me"}
          </button>
        </div>

        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-[15px] font-medium text-zinc-900">
            Take me off the list
          </p>
          <p className="mt-1 text-[14px] leading-snug text-zinc-600">
            We delete your details, including your photo. You can always apply
            again later.
          </p>
          {confirmRemove ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => run("remove")}
                disabled={busy !== null}
                className="flex-1 rounded-lg bg-red-700 px-4 py-2.5 text-[15px] font-medium text-white disabled:opacity-50"
              >
                {busy === "remove" ? "Removing…" : "Yes, remove me"}
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-[15px] text-zinc-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              disabled={busy !== null}
              className="mt-3 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-[15px] font-medium text-zinc-800 disabled:opacity-50"
            >
              Take me off the list
            </button>
          )}
        </div>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">{children}</div>
    </main>
  );
}
