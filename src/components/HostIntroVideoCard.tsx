"use client";

/**
 * The intro-video card on the accepted offer page.
 *
 * A host records a 30-second hello to camera; it goes on the plan page next
 * to their bio, and pays a bonus if it is up within a day of accepting. The
 * file goes straight from the browser to Mux — the server only mints the
 * one-shot upload URL and is told when the PUT has landed.
 *
 * States: ask → checking → uploading → processing → live. After the bonus
 * window the same card stays, minus the money line: a late video still
 * introduces the host.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import HlsVideo from "@/components/HlsVideo";

export type IntroVideoInfo = {
  available: boolean;
  status: "none" | "processing" | "ready" | "errored" | "removed";
  url: string | null;
  posterUrl: string | null;
  durationSec: number | null;
  uploadedAt: string | null;
  bonusEarned: boolean;
  bonusCents: number;
  deadlineAt: string | null;
  deadlineOpen: boolean;
  maxSeconds: number;
  script: string;
  tips: string[];
};

const MAX_BYTES = 250 * 1024 * 1024;

const btnPrimary =
  "w-full rounded-lg bg-leaf-800 px-5 py-3.5 text-[16px] font-medium text-white " +
  "transition-colors hover:bg-leaf-900 disabled:opacity-50";
const btnQuiet =
  "w-full rounded-lg border border-zinc-300 bg-white px-5 py-3.5 text-[16px] " +
  "font-medium text-leaf-900 transition-colors hover:border-zinc-400 disabled:opacity-50";

function money(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

function fmtDeadline(iso: string | null, timeZone: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short", hour: "numeric", minute: "2-digit", timeZone: timeZone ?? undefined,
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

/** Duration of a local video file, read from its metadata; null when unreadable. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = (n: number | null) => {
      URL.revokeObjectURL(url);
      resolve(n);
    };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    v.src = url;
  });
}

function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

export default function HostIntroVideoCard({
  token,
  video,
  timeZone,
  planStarted,
  onChanged,
}: {
  token: string;
  video: IntroVideoInfo;
  timeZone: string | null;
  planStarted: boolean;
  /** Re-fetch the offer; the card re-renders from the fresh `video`. */
  onChanged: () => Promise<unknown>;
}) {
  const [phase, setPhase] = useState<"idle" | "checking" | "uploading" | "finalizing">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(video.status === "none");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const bonus = video.bonusCents > 0 ? money(video.bonusCents) : null;
  const deadlineLabel = fmtDeadline(video.deadlineAt, timeZone);
  const bonusOpen = Boolean(bonus && video.deadlineOpen);

  // Mux usually has a phone clip playable in well under a minute. Poll the
  // offer while it says processing so the host sees it flip without a
  // reload; the server re-checks Mux on each read.
  useEffect(() => {
    if (video.status !== "processing") return;
    const id = setInterval(() => { onChanged(); }, 5000);
    return () => clearInterval(id);
  }, [video.status, onChanged]);

  const finalize = useCallback(async (uploadId: string) => {
    // The PUT is done; the asset can take a beat to appear on Mux's side.
    for (let attempt = 0; attempt < 8; attempt++) {
      const r = (await Parse.Cloud.run("finalizeHostIntroUpload", { token, uploadId })) as { status?: string };
      if (r.status !== "uploading") return;
      await new Promise((res) => setTimeout(res, 1500));
    }
    throw new Error("The upload is taking longer than usual. Reload this page in a minute.");
  }, [token]);

  const onPick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setPhase("checking");
    try {
      if (file.size > MAX_BYTES) throw new Error("That file is too big. Keep it under 30 seconds and try again.");
      const dur = await readDuration(file);
      if (dur !== null && dur > video.maxSeconds + 1) {
        throw new Error(`That one's ${Math.round(dur)} seconds. Keep it under ${video.maxSeconds} — short beats polished.`);
      }
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const up = (await Parse.Cloud.run("createHostIntroUpload", { token, origin })) as { uploadUrl: string; uploadId: string };
      setPhase("uploading");
      setProgress(0);
      await putWithProgress(up.uploadUrl, file, setProgress);
      setPhase("finalizing");
      await finalize(up.uploadId);
      await onChanged();
      setShowScript(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that.");
    } finally {
      setPhase("idle");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await Parse.Cloud.run("removeHostIntroVideo", { token });
      setConfirmRemove(false);
      await onChanged();
      setShowScript(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't remove it.");
    }
  };

  if (!video.available) return null;
  if (planStarted && video.status !== "ready") return null;

  const busy = phase !== "idle";
  const live = video.status === "ready" && video.url;

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
      {/* ── Heading: what this is and what it pays ── */}
      {live ? (
        <>
          <h2 className="text-[17px] font-semibold text-leaf-900">Your intro is on the plan page.</h2>
          <p className="mt-1.5 text-[14px] leading-snug text-zinc-600">
            {video.bonusEarned
              ? `You earned ${bonus} on top — it's paid with the plan.`
              : bonus
                ? "Added after the bonus window, but it's up, and people RSVP to a face."
                : "People RSVP to a face."}
          </p>
        </>
      ) : video.status === "processing" ? (
        <>
          <h2 className="text-[17px] font-semibold text-leaf-900">Got it — making it playable.</h2>
          <p className="mt-1.5 text-[14px] leading-snug text-zinc-600">
            Usually under a minute. You can close this page; it goes up on its own.
            {video.bonusEarned ? ` ${bonus} is yours — it was in before the deadline.` : ""}
          </p>
        </>
      ) : (
        <>
          <h2 className="text-[17px] font-semibold text-leaf-900">
            {bonusOpen ? `Earn ${bonus} more: a 30-second hello.` : "Add a 30-second hello."}
          </h2>
          <p className="mt-1.5 text-[14px] leading-snug text-zinc-600">
            A quick intro to camera goes on the plan page next to your bio. People RSVP to a face.
            {bonusOpen && deadlineLabel
              ? ` It pays ${bonus} on top if it's up by ${deadlineLabel}.`
              : bonus
                ? " The bonus window has closed, but it's still worth adding."
                : ""}
          </p>
          {video.status === "errored" && (
            <p className="mt-2 text-[14px] text-amber-800">
              The last file couldn&rsquo;t be processed. Try recording it again.
            </p>
          )}
        </>
      )}

      {/* ── The video itself, once live ── */}
      {live && (
        <div className="mt-4 flex gap-4">
          <div className="w-[132px] shrink-0 aspect-[9/16] overflow-hidden rounded-xl bg-zinc-900">
            <HlsVideo src={video.url as string} poster={video.posterUrl} preload="none" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-[14px] text-zinc-600">
            {video.durationSec ? <p>{video.durationSec}s</p> : null}
            <p>Not happy with it? Record another — the new one replaces this one{video.bonusEarned ? " and the bonus stays" : ""}.</p>
          </div>
        </div>
      )}

      {/* ── Script ── */}
      {!live && video.status !== "processing" && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowScript((s) => !s)}
            className="text-[14px] font-medium text-leaf-800 underline"
          >
            {showScript ? "Hide the script" : "Show the script"}
          </button>
          {showScript && (
            <div className="mt-3 rounded-xl bg-leaf-50 p-4">
              <p className="whitespace-pre-line text-[17px] leading-relaxed text-leaf-900">{video.script}</p>
              <ul className="mt-4 space-y-1 text-[13px] text-leaf-800/80">
                {video.tips.map((t) => (
                  <li key={t}>· {t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Upload / progress ── */}
      {video.status !== "processing" && (
        <div className="mt-4 space-y-3">
          {phase === "uploading" && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                <div className="h-full bg-leaf-800 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1.5 text-[13px] text-zinc-500">Uploading… {progress}%</p>
            </div>
          )}
          {phase === "finalizing" && <p className="text-[13px] text-zinc-500">Almost there…</p>}
          {phase === "checking" && <p className="text-[13px] text-zinc-500">Checking the file…</p>}
          {error && <p className="text-[14px] text-red-700">{error}</p>}
          {!planStarted && (
            <>
              {/* capture="user" opens the front camera straight away on a
                  phone; on a desktop it's a normal file picker. */}
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                capture="user"
                className="hidden"
                onChange={(e) => onPick(e.target.files)}
                disabled={busy}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className={live ? btnQuiet : btnPrimary}
              >
                {busy ? "Working…" : live ? "Record another" : "Record it now"}
              </button>
            </>
          )}
          {live && !planStarted && (
            confirmRemove ? (
              <div className="flex items-center gap-3 text-[14px]">
                <span className="text-zinc-600">
                  Take it down{video.bonusEarned ? " (the bonus goes with it)" : ""}?
                </span>
                <button type="button" onClick={remove} className="font-medium text-red-700 underline">Yes, remove</button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="font-medium text-zinc-600 underline">Keep it</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="text-[14px] font-medium text-zinc-500 underline"
              >
                Remove it
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
