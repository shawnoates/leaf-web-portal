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
import IntroVideoRecorder, { type Beat, canRecordInBrowser } from "@/components/IntroVideoRecorder";
import { introVideoFrame } from "@/lib/intro-video-frame";

export type IntroVideoInfo = {
  available: boolean;
  status: "none" | "processing" | "ready" | "errored" | "removed";
  url: string | null;
  posterUrl: string | null;
  /** Mux's "W:H" for the stored take; the player box follows it. */
  aspectRatio?: string | null;
  /** The plan was called off; the video has no page to be on. */
  planCancelled?: boolean;
  durationSec: number | null;
  uploadedAt: string | null;
  bonusEarned: boolean;
  bonusCents: number;
  deadlineAt: string | null;
  deadlineOpen: boolean;
  maxSeconds: number;
  /** What to cover, and one way of saying each. The prompter reads these. */
  beats: Beat[];
  script: string;
  tips: string[];
  /** The one hard rule, kept out of `tips` so it gets its own line. */
  venueRule: string;
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
  const [recording, setRecording] = useState(false);
  // `null` until we've asked the browser. Capability can only be read on the
  // client, so reading it during render makes the server and the client
  // disagree and React throws away the tree. Null is treated as "assume we
  // can" below, which keeps both passes identical.
  const [canRecordHere, setCanRecordHere] = useState<boolean | null>(null);
  useEffect(() => {
    setCanRecordHere(canRecordInBrowser());
  }, []);
  // Set when the browser turns out not to be able to record, or the host
  // says no to the camera. From then on the card offers the camera app.
  const [recorderOff, setRecorderOff] = useState<string | null>(null);
  // Two inputs, because `capture` is not a hint on iOS: an input that carries
  // it opens the camera and never the library. The camera one is the
  // fallback when in-browser recording isn't possible; the library one is
  // for a clip they already have.
  const inputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

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

  /** Mint an upload, PUT the bytes, tell the server. Shared by both paths. */
  const upload = useCallback(async (file: File) => {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    const up = (await Parse.Cloud.run("createHostIntroUpload", { token, origin })) as { uploadUrl: string; uploadId: string };
    setPhase("uploading");
    setProgress(0);
    await putWithProgress(up.uploadUrl, file, setProgress);
    setPhase("finalizing");
    await finalize(up.uploadId);
    await onChanged();
    setShowScript(false);
  }, [token, finalize, onChanged]);

  // Straight out of the in-browser recorder: length is already capped there
  // and the blob came from our own MediaRecorder, so there is nothing to
  // check that we did not just produce.
  const onRecorded = useCallback(async (file: File, _durationSec: number) => {
    void _durationSec;
    setRecording(false);
    setError(null);
    try {
      await upload(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that.");
    } finally {
      setPhase("idle");
    }
  }, [upload]);

  // The camera-app path: anything could arrive, so check it first.
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
      await upload(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that.");
    } finally {
      setPhase("idle");
      if (inputRef.current) inputRef.current.value = "";
      if (libraryInputRef.current) libraryInputRef.current.value = "";
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
  // In-browser recording is the main route, because it is the only one that
  // can put the prompts on screen while the camera is running. Anything that
  // rules it out drops the card back to the camera app. Optimistic before the
  // capability check lands: the recorder reports back through `onUnsupported`
  // if a tap in that window turns out to be a browser that can't record.
  const canRecord = video.beats.length > 0 && !recorderOff && canRecordHere !== false;

  if (recording) {
    return (
      <IntroVideoRecorder
        beats={video.beats}
        maxSeconds={video.maxSeconds}
        onCancel={() => setRecording(false)}
        onRecorded={onRecorded}
        onUnsupported={(reason) => {
          setRecording(false);
          setRecorderOff(reason);
        }}
      />
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
      {/* ── Heading: what this is and what it pays ── */}
      {live ? (
        <>
          <h2 className="text-[17px] font-semibold text-leaf-900">
            {video.planCancelled ? "This plan was called off." : "Your intro is on the plan page."}
          </h2>
          <p className="mt-1.5 text-[14px] leading-snug text-zinc-600">
            {video.planCancelled
              ? "Your intro is saved, but there's no plan page for it to be on any more."
              : video.bonusEarned
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
          {/* The viewfinder loop. It earns its place by doing the explaining
              the copy can't: phone upright, face centred, short. Decorative,
              so no alt text — the heading and the paragraph carry the
              meaning. Animated WebP at 575KB rather than the 3.9MB GIF it
              came from; anyone who asked for less motion, or whose browser
              can't do animated WebP, gets the first frame as a still. */}
          <picture className="mt-4 block">
            <source media="(prefers-reduced-motion: reduce)" srcSet="/host-intro-hero.jpg" />
            <source type="image/webp" srcSet="/host-intro-hero.webp" />
            <img
              src="/host-intro-hero.jpg"
              alt=""
              width={400}
              height={500}
              loading="lazy"
              decoding="async"
              className="mx-auto block w-full max-w-[200px] rounded-2xl"
            />
          </picture>
          <p className="mt-4 text-[14px] leading-snug text-zinc-600">
            A quick intro to camera goes on the plan page next to your bio. People RSVP to a face.
            {bonusOpen && deadlineLabel
              ? ` It pays ${bonus} on top if it's up by ${deadlineLabel}.`
              : bonus
                ? " The bonus window has closed, but it's still worth adding."
                : ""}
          </p>
          {/* The rule, before they ever hit record, and out of the
              collapsible — a venue said out loud on camera is the one thing
              here that can't be taken back. It shows again on the beat where
              they'd say it. */}
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[14px] font-medium leading-snug text-amber-900">
            {video.venueRule}
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
        <div className="mt-4 flex flex-wrap gap-4">
          {/* Sized from the take's real shape — a landscape recording is
              shown whole, never cropped into a tall slice. */}
          <div className={introVideoFrame(video.aspectRatio).className} style={introVideoFrame(video.aspectRatio).style}>
            <HlsVideo src={video.url as string} poster={video.posterUrl} preload="none" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-[14px] text-zinc-600">
            {video.durationSec ? <p>{video.durationSec}s</p> : null}
            <p>Not happy with it? Record another — the new one replaces this one{video.bonusEarned ? " and the bonus stays" : ""}.</p>
          </div>
        </div>
      )}

      {/* ── What to cover ──
          Beats, not a script. The cue is the thing to say; the line under it
          is one way of saying it, in lighter type so it reads as an example
          rather than a line to perform. Same shape the prompter shows while
          they record, so nothing is a surprise once the camera is on. */}
      {!live && video.status !== "processing" && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowScript((s) => !s)}
            className="text-[14px] font-medium text-leaf-800 underline"
          >
            {showScript ? "Hide what to cover" : "What do I say?"}
          </button>
          {showScript && (
            <div className="mt-3 rounded-xl bg-leaf-50 p-4">
              <p className="text-[13px] font-medium uppercase tracking-wide text-leaf-800/70">
                Six things to hit, in your words
              </p>
              <ol className="mt-3 space-y-3">
                {video.beats.map((b, i) => (
                  <li key={b.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-leaf-800 text-[11px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium leading-snug text-leaf-900">{b.cue}</span>
                      <span className="mt-0.5 block text-[14px] leading-snug text-leaf-800/60">
                        &ldquo;{b.line}&rdquo;
                      </span>
                      {b.note && (
                        <span className="mt-1 block text-[13px] font-medium leading-snug text-amber-800">
                          {b.note}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <ul className="mt-4 space-y-1 border-t border-leaf-800/10 pt-3 text-[13px] text-leaf-800/80">
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
              {/* The camera-app path. `capture="user"` opens the front camera
                  straight away on a phone, which takes the whole screen — so
                  it is the fallback, not the main route. On a desktop with no
                  camera it is just a file picker. */}
              <input
                ref={inputRef}
                type="file"
                accept="video/*"
                capture="user"
                className="hidden"
                onChange={(e) => onPick(e.target.files)}
                disabled={busy}
              />
              {/* No `capture`: this one opens the photo library. */}
              <input
                ref={libraryInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => onPick(e.target.files)}
                disabled={busy}
              />
              {canRecord ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => { setError(null); setRecording(true); }}
                    className={live ? btnQuiet : btnPrimary}
                  >
                    {busy ? "Working…" : live ? "Record another" : "Record it here"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => libraryInputRef.current?.click()}
                    className="w-full text-center text-[14px] font-medium text-zinc-500 underline disabled:opacity-50"
                  >
                    Upload one I already made
                  </button>
                </>
              ) : (
                <>
                  {recorderOff && (
                    <p className="text-[14px] leading-snug text-amber-800">{recorderOff}</p>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                    className={live ? btnQuiet : btnPrimary}
                  >
                    {busy ? "Working…" : live ? "Record another" : "Open the camera"}
                  </button>
                  <p className="text-[13px] leading-snug text-zinc-500">
                    Your camera app takes over the screen, so read the six
                    prompts above first and then say them your way.
                  </p>
                </>
              )}
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
