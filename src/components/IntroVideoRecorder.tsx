"use client";

/**
 * The teleprompter recorder.
 *
 * Handing a phone to the native camera takes the whole screen, which makes
 * "read this while you record" impossible — the page with the words is
 * behind the camera UI. So we record in the browser instead, with the
 * prompt sitting directly under the lens.
 *
 * It deliberately does NOT scroll sentences past them. A prompter that
 * shows finished prose gets you someone reading finished prose, and a stiff
 * read is worth less than no video at all. Each beat shows the CUE in large
 * type, with one way of saying it small and dimmed underneath, and the host
 * taps forward when they're ready. Nothing moves on a timer, so the pace is
 * theirs and the words come out in their own voice.
 *
 * Falls back to the caller's file input when the browser can't record.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type Beat = { id: string; cue: string; line: string };

type Phase = "idle" | "starting" | "countdown" | "recording" | "review";

/** Safari gives us mp4, Chrome and Firefox webm. Mux ingests all of them. */
const CANDIDATE_TYPES = [
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function canRecordInBrowser() {
  if (typeof window === "undefined") return false;
  // `typeof`, not a truthiness check: TypeScript types both of these as
  // always present, but an http origin or an old WebView has neither.
  return Boolean(
    navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function" &&
      typeof window.MediaRecorder === "function"
  );
}

function pickMimeType() {
  for (const t of CANDIDATE_TYPES) {
    try {
      if (window.MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* isTypeSupported throws on some older builds; fall through */
    }
  }
  return "";
}

function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function IntroVideoRecorder({
  beats,
  maxSeconds,
  targetSeconds = 30,
  onCancel,
  onRecorded,
  onUnsupported,
}: {
  beats: Beat[];
  maxSeconds: number;
  targetSeconds?: number;
  onCancel: () => void;
  onRecorded: (file: File, durationSec: number) => void | Promise<void>;
  onUnsupported: (reason: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [beatIndex, setBeatIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);

  const previewRef = useRef<HTMLVideoElement>(null);
  const reviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const resultRef = useRef<{ file: File; duration: number } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Camera on mount. Asking straight away rather than behind another tap:
  // they already chose to record, and the permission sheet is the thing
  // standing between them and the preview of their own face.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!canRecordInBrowser()) {
        onUnsupported("This browser can't record video.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
          await previewRef.current.play().catch(() => {});
        }
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        onUnsupported(
          name === "NotAllowedError"
            ? "We don't have camera access, so you'll need to record with your camera app instead."
            : "We couldn't open the camera, so you'll need to record with your camera app instead."
        );
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [onUnsupported, stopStream]);

  useEffect(
    () => () => {
      if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    },
    [reviewUrl]
  );

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  // The elapsed counter, and the hard stop at the cap.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      const secs = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(secs);
      if (secs >= maxSeconds) stop();
    }, 200);
    return () => clearInterval(id);
  }, [phase, maxSeconds, stop]);

  // 3, 2, 1 before the light goes on, so nobody's first frame is them
  // reaching for the button.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      begin();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  const begin = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      onUnsupported("This browser can't record video.");
      return;
    }
    recorderRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const duration = (Date.now() - startedAtRef.current) / 1000;
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `host-intro.${ext}`, { type });
      resultRef.current = { file, duration };
      const url = URL.createObjectURL(blob);
      setReviewUrl(url);
      setPhase("review");
    };
    startedAtRef.current = Date.now();
    setElapsed(0);
    setBeatIndex(0);
    rec.start();
    setPhase("recording");
  };

  const start = () => {
    setError(null);
    if (!streamRef.current) {
      setError("The camera isn't ready yet.");
      return;
    }
    setCountdown(3);
    setPhase("countdown");
  };

  const retake = () => {
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    resultRef.current = null;
    setElapsed(0);
    setBeatIndex(0);
    setPhase("idle");
    // The preview element is remounted by the phase switch; reattach.
    requestAnimationFrame(() => {
      if (previewRef.current && streamRef.current) {
        previewRef.current.srcObject = streamRef.current;
        previewRef.current.play().catch(() => {});
      }
    });
  };

  const use = async () => {
    const r = resultRef.current;
    if (!r) return;
    stopStream();
    await onRecorded(r.file, r.duration);
  };

  const close = () => {
    stopStream();
    onCancel();
  };

  const beat = beats[beatIndex];
  const last = beatIndex >= beats.length - 1;
  const over = elapsed >= targetSeconds;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      {/* ── Camera / playback ── */}
      <div className="relative flex-1 overflow-hidden">
        {phase === "review" && reviewUrl ? (
          <video
            ref={reviewRef}
            src={reviewUrl}
            controls
            playsInline
            autoPlay
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <video
            ref={previewRef}
            muted
            playsInline
            autoPlay
            // Mirrored, because an unmirrored preview of your own face is
            // disconcerting enough to make people stop and restart. The
            // recording itself is not mirrored.
            className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]"
          />
        )}

        {/* ── The prompt, directly under the lens ──
            High on the screen on purpose: the camera is at the top of the
            phone, so reading here keeps their eyes near it. Lower down and
            everyone looks like they're staring at their shoes. */}
        {phase !== "review" && beat && (
          <button
            type="button"
            onClick={() => !last && setBeatIndex((i) => i + 1)}
            className="absolute inset-x-0 top-0 px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-left"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.72), rgba(0,0,0,0))" }}
          >
            <div className="mb-2 flex gap-1.5">
              {beats.map((b, i) => (
                <span
                  key={b.id}
                  className={`h-1 flex-1 rounded-full ${i <= beatIndex ? "bg-white" : "bg-white/30"}`}
                />
              ))}
            </div>
            <p className="text-[22px] font-semibold leading-snug">{beat.cue}</p>
            <p className="mt-1.5 text-[15px] leading-snug text-white/55">{beat.line}</p>
            {!last && (
              <p className="mt-2 text-[12px] uppercase tracking-wide text-white/40">
                Tap for the next one
              </p>
            )}
          </button>
        )}

        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[96px] font-semibold tabular-nums drop-shadow-lg">
              {countdown}
            </span>
          </div>
        )}

        {phase === "recording" && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium tabular-nums ${
                over ? "bg-amber-500/90 text-black" : "bg-black/60"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {clock(elapsed)}
              {over ? " · wrap it up" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {error && <p className="mb-3 text-center text-[14px] text-red-400">{error}</p>}

        {phase === "review" ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={use}
              className="w-full rounded-lg bg-white px-5 py-3.5 text-[16px] font-medium text-black"
            >
              Use this one
            </button>
            <button
              type="button"
              onClick={retake}
              className="w-full rounded-lg border border-white/30 px-5 py-3.5 text-[16px] font-medium"
            >
              Record it again
            </button>
          </div>
        ) : phase === "recording" ? (
          <button
            type="button"
            onClick={stop}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white"
          >
            <span className="h-6 w-6 rounded bg-red-500" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={start}
              disabled={phase === "countdown"}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white disabled:opacity-40"
            >
              <span className="h-11 w-11 rounded-full bg-red-500" />
            </button>
            <p className="mt-3 text-center text-[13px] text-white/50">
              Say it your way. The prompts are only there so you don&rsquo;t lose your
              place.
            </p>
          </>
        )}

        {phase !== "recording" && (
          <button
            type="button"
            onClick={close}
            className="mt-4 w-full text-center text-[14px] text-white/50 underline"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
