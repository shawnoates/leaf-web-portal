"use client";

/**
 * The teleprompter recorder.
 *
 * Handing a phone to the native camera takes the whole screen, which makes
 * "read this while you record" impossible — the page with the words is
 * behind the camera UI. So we record in the browser instead, with the
 * prompt sitting directly under the lens.
 *
 * It deliberately does NOT scroll sentences past them. A prompter showing
 * finished prose gets you someone reading finished prose, and a stiff read
 * is worth less than no video. Each beat shows the CUE large, with one way
 * of saying it small and dimmed underneath.
 *
 * And it records a beat at a time. One continuous take with a prompt
 * changing on it forces the host to stop talking, tap, and read, five times
 * in half a minute — the exact stop-start delivery the cues were meant to
 * prevent. Instead, tapping Next PAUSES the recorder; they read the next
 * prompt at their own pace and press record again. `MediaRecorder.pause()`
 * leaves the paused time out of the file, so the joins land as hard cuts:
 * the jumpcut grammar everyone already reads as an edit rather than a
 * stumble. One file, no stitching.
 *
 * Browsers without pause support fall back to a single continuous take, and
 * browsers without MediaRecorder at all fall back to the caller's camera-app
 * input.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { withMp4Duration } from "@/lib/mp4-duration";

export type Beat = {
  id: string;
  cue: string;
  line: string;
  /** A rule that applies to this beat only, shown right where it bites. */
  note?: string;
};

// `resuming` is the brief hold between pressing record again and the
// recorder actually resuming, so the first frame of a segment isn't a hand
// reaching for the screen.
type Phase = "idle" | "countdown" | "recording" | "paused" | "resuming" | "review";

/** Safari gives us mp4, Chrome and Firefox webm. Mux ingests all of them. */
const CANDIDATE_TYPES = [
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

// Long enough that the first frame of a segment isn't a hand reaching for
// the screen, short enough that six of them don't feel like a queue.
const RESUME_DELAY_MS = 700;

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

/** A recorder's state as the union, defeating TS narrowing across a mutating call. */
function stateOf(rec: MediaRecorder): RecordingState {
  return rec.state;
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
  const [captured, setCaptured] = useState(0); // segments in the can
  const [elapsed, setElapsed] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [reviewMeta, setReviewMeta] = useState<{ seconds: number; bytes: number; container: string } | null>(null);
  const reviewRef = useRef<HTMLVideoElement>(null);
  const [segmented, setSegmented] = useState(true);

  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  // Recorded time only. The clock stops while they read the next prompt,
  // because the paused stretch is not in the file either.
  const bankedMsRef = useRef(0);
  const segmentStartRef = useRef(0);
  const resultRef = useRef<{ file: File; duration: number } | null>(null);
  const mimeRef = useRef("");
  const finalizedRef = useRef(false);
  const watchdogRef = useRef<number | null>(null);

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
        // Portrait is asked for three ways because phones honour it
        // unevenly: iPhones tend to hand back 1920x1080 landscape whatever
        // is requested, and the recorder captures exactly what the track
        // delivers. The preview below is object-contain for that reason —
        // the host sees the frame that is actually being recorded, not a
        // crop of it that looks upright and isn't.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1080 },
            height: { ideal: 1920 },
            aspectRatio: { ideal: 9 / 16 },
          },
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

  /**
   * Turn whatever is in `chunks` into the file and move to review. Reached
   * from the stop event in the normal case, and from a watchdog when that
   * event never comes — WebKit has been seen to fire nothing for a stop()
   * issued after pause/resume cycles, and a host who has just done four
   * takes must not be left staring at the live camera.
   */
  const finalize = useCallback(() => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    const rec = recorderRef.current;
    const type = (rec && rec.mimeType) || mimeRef.current || "video/webm";
    const blob = new Blob(chunksRef.current, { type });
    const duration = bankedMsRef.current / 1000;
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const file = new File([blob], `host-intro.${ext}`, { type });
    resultRef.current = blob.size ? { file, duration } : null;
    setReviewMeta(blob.size ? { seconds: duration, bytes: blob.size, container: ext } : null);
    if (!blob.size) {
      setError("Nothing came back from the recorder. Try again, or use your camera app.");
      setReviewUrl(null);
      setPhase("review");
      return;
    }
    setPhase("review");
    // Safari's fragmented MP4 carries no duration, so played from a blob it
    // is a "Live Broadcast" with a dead scrubber and, after any seek, no
    // frames. The recorder knows the length; write it into the header of
    // the playback copy. The upload is left untouched — Mux computes its
    // own. WebM (Chrome) gets the seek trick in settleDuration instead.
    if (ext === "mp4") {
      withMp4Duration(blob, duration).then(({ blob: fixed, report }) => {
        if (report) console.log("[intro-video] mp4 duration patch", report);
        setReviewUrl(URL.createObjectURL(fixed));
      });
    } else {
      setReviewUrl(URL.createObjectURL(blob));
    }
  }, []);

  const finish = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    if (rec.state === "recording") {
      bankedMsRef.current += Date.now() - segmentStartRef.current;
    }
    // Stopping from paused is legal by the spec and silently broken in
    // WebKit; give it a running recorder to stop.
    if (rec.state === "paused") {
      try { rec.resume(); } catch { /* fall through to stop */ }
    }
    try { rec.requestData(); } catch { /* not all builds have it */ }
    try {
      rec.stop();
    } catch {
      finalize();
      return;
    }
    watchdogRef.current = window.setTimeout(finalize, 2000);
  }, [finalize]);

  // The clock, and the hard stop at the cap. Runs only while rolling.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      const secs = (bankedMsRef.current + (Date.now() - segmentStartRef.current)) / 1000;
      setElapsed(secs);
      if (secs >= maxSeconds) finish();
    }, 200);
    return () => clearInterval(id);
  }, [phase, maxSeconds, finish]);

  const roll = useCallback(() => {
    segmentStartRef.current = Date.now();
    setPhase("recording");
  }, []);

  const begin = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    bankedMsRef.current = 0;
    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      onUnsupported("This browser can't record video.");
      return;
    }
    // Pause and resume are what make the segments a single file. Without
    // them the whole thing is one continuous take and Next just turns the
    // page, which is the old behaviour rather than a broken one. The
    // methods existing is not proof they work — nextSegment re-checks the
    // recorder's state after calling pause.
    setSegmented(typeof rec.pause === "function" && typeof rec.resume === "function");
    recorderRef.current = rec;
    mimeRef.current = mimeType;
    finalizedRef.current = false;
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = finalize;
    rec.onerror = () => finalize();
    setBeatIndex(0);
    setCaptured(0);
    setElapsed(0);
    // A timeslice, so data lands every second while rolling. If the final
    // flush on stop() goes missing, the take is still in `chunks`.
    rec.start(1000);
    roll();
  }, [onUnsupported, roll, finalize]);

  // 3, 2, 1 before the light goes on, so nobody's first frame is them
  // reaching for the button. Only before the first segment — a countdown
  // between every prompt would turn a two-minute job into a queue.
  useEffect(() => {
    if (phase !== "countdown") return;
    // Everything happens in the timeout, never in the effect body: "1" gets
    // its full beat on screen before the light goes on, and the state change
    // is not a render-phase side effect.
    const id = setTimeout(() => {
      if (countdown <= 1) begin();
      else setCountdown((c) => c - 1);
    }, 800);
    return () => clearTimeout(id);
  }, [phase, countdown, begin]);

  const start = () => {
    setError(null);
    if (!streamRef.current) {
      setError("The camera isn't ready yet.");
      return;
    }
    setCountdown(3);
    setPhase("countdown");
  };

  /** End this segment: bank the time, cut, and show the next prompt. */
  const nextSegment = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (!segmented || rec.state !== "recording") {
      setBeatIndex((i) => Math.min(i + 1, beats.length - 1));
      return;
    }
    try { rec.pause(); } catch { /* checked below */ }
    // Read through a function: TS has narrowed `rec.state` to "recording"
    // from the guard above and does not know pause() mutates it.
    if (stateOf(rec) !== "paused") {
      // pause() was a no-op. Drop to one continuous take rather than
      // stranding them in a "held" screen that isn't holding anything.
      setSegmented(false);
      setBeatIndex((i) => Math.min(i + 1, beats.length - 1));
      return;
    }
    bankedMsRef.current += Date.now() - segmentStartRef.current;
    setElapsed(bankedMsRef.current / 1000);
    setCaptured((c) => c + 1);
    setBeatIndex((i) => Math.min(i + 1, beats.length - 1));
    setPhase("paused");
  };

  const resumeSegment = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === "recording") { roll(); return; }
    if (rec.state !== "paused") { finish(); return; }
    setPhase("resuming");
    window.setTimeout(() => {
      const r = recorderRef.current;
      if (!r) return;
      try { r.resume(); } catch { /* checked below */ }
      if (r.state !== "recording") { finish(); return; }
      roll();
    }, RESUME_DELAY_MS);
  };

  const retake = () => {
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    setReviewUrl(null);
    setError(null);
    resultRef.current = null;
    finalizedRef.current = false;
    bankedMsRef.current = 0;
    setElapsed(0);
    setBeatIndex(0);
    setCaptured(0);
    setPhase("idle");
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
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null;
      try { rec.stop(); } catch { /* leaving anyway */ }
    }
    stopStream();
    onCancel();
  };

  /**
   * WebM from Chrome's MediaRecorder reports Infinity until the element is
   * forced to walk to the end and back; harmless once the real duration
   * lands. NEVER for MP4: on Safari that same seek lands on a live edge with
   * no frames behind it and the resolving event never fires, which is the
   * black screen. MP4 gets its duration written into the header instead.
   */
  const settleDuration = (v: HTMLVideoElement) => {
    if (reviewMeta?.container === "mp4") return;
    if (v.duration !== Infinity) return;
    const onDur = () => {
      if (v.duration === Infinity) return;
      v.removeEventListener("durationchange", onDur);
      try { v.currentTime = 0; } catch { /* fine */ }
    };
    v.addEventListener("durationchange", onDur);
    try { v.currentTime = 1e101; } catch { /* fine */ }
  };

  /** Replay from the top. Reloading the source is the one way that works on a stream Safari still calls live. */
  const replay = () => {
    const v = reviewRef.current;
    if (!v) return;
    try { v.currentTime = 0; } catch { /* fine */ }
    try { v.load(); } catch { /* fine */ }
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  };

  const fmtBytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

  const beat = beats[beatIndex];
  const nextBeat = beats[beatIndex + 1];
  const last = beatIndex >= beats.length - 1;
  const over = elapsed >= targetSeconds;
  const rolling = phase === "recording";
  const resuming = phase === "resuming";
  const started = rolling || phase === "paused" || resuming;

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
            preload="auto"
            onLoadedMetadata={(e) => settleDuration(e.currentTarget)}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : phase === "review" ? (
          // Nothing was captured. A black frame, not the live camera —
          // the camera would read as "still recording".
          <div className="absolute inset-0 bg-black" />
        ) : (
          <video
            ref={previewRef}
            muted
            playsInline
            autoPlay
            // Mirrored, because an unmirrored preview of your own face is
            // disconcerting enough to make people stop and restart. The
            // recording itself is not mirrored. object-contain, not cover:
            // cover showed an upright-looking crop of a landscape frame and
            // the recording came out wide, which surprised the host.
            className="absolute inset-0 h-full w-full object-contain [transform:scaleX(-1)]"
          />
        )}

        {/* Anywhere on the picture ends the segment. Hunting for a small
            target mid-sentence is its own pause, and the thumb is already
            resting on the screen. */}
        {rolling && !last && (
          <button
            type="button"
            aria-label="Next prompt"
            onClick={nextSegment}
            className="absolute inset-0 z-10"
          />
        )}

        {/* ── The prompt, directly under the lens ──
            High on the screen on purpose: the camera is at the top of the
            phone, so reading here keeps their eyes near it. Lower down and
            everyone looks like they're staring at their shoes. */}
        {phase !== "review" && beat && (
          <div
            onClick={rolling && !last ? nextSegment : undefined}
            className="absolute inset-x-0 top-0 z-20 px-5 pb-6 pt-[max(1rem,env(safe-area-inset-top))] text-left"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.72), rgba(0,0,0,0))" }}
          >
            <div className="mb-2 flex gap-1.5">
              {beats.map((b, i) => (
                <span
                  key={b.id}
                  className={`h-1 flex-1 rounded-full ${
                    i < captured ? "bg-white" : i === beatIndex ? "bg-white/70" : "bg-white/25"
                  }`}
                />
              ))}
            </div>
            <p className="text-[22px] font-semibold leading-snug">{beat.cue}</p>
            <p className="mt-1.5 text-[15px] leading-snug text-white/55">{beat.line}</p>
            {/* The venue rule rides the "where" beat. On screen at the one
                moment they are about to say it out loud, and gone again on
                every other beat. */}
            {beat.note && (
              <p className="mt-2 text-[14px] font-medium leading-snug text-amber-300">
                {beat.note}
              </p>
            )}
            {/* Read-ahead, so the end of a segment isn't a cliff. */}
            {nextBeat ? (
              <p className="mt-3 border-t border-white/15 pt-2 text-[13px] leading-snug text-white/40">
                <span className="uppercase tracking-wide text-white/30">Next</span>{" "}
                {nextBeat.cue}
              </p>
            ) : (
              <p className="mt-3 border-t border-white/15 pt-2 text-[13px] uppercase tracking-wide text-white/30">
                Last one
              </p>
            )}
          </div>
        )}

        {phase === "countdown" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center">
            <span className="text-[96px] font-semibold tabular-nums drop-shadow-lg">
              {countdown}
            </span>
          </div>
        )}

        {/* Rolling / held. The dot is the only thing that says which. */}
        {(rolling || phase === "paused" || resuming) && (
          <div className="absolute bottom-4 left-0 right-0 z-30 flex justify-center">
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-[13px] font-medium tabular-nums ${
                phase === "paused" ? "bg-black/60 text-white/70" : over ? "bg-amber-500/90 text-black" : "bg-black/60"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  rolling ? "bg-red-500" : resuming ? "bg-red-500/50" : "bg-white/40"
                }`}
              />
              {clock(elapsed)}
              {phase === "paused" ? " · held" : over ? " · wrap it up" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        {error && <p className="mb-3 text-center text-[14px] text-red-400">{error}</p>}

        {phase === "review" ? (
          <div className="space-y-3">
            {reviewMeta && (
              <p className="text-center text-[12px] tabular-nums text-white/45">
                {clock(reviewMeta.seconds)} · {reviewMeta.container} · {fmtBytes(reviewMeta.bytes)}
              </p>
            )}
            {reviewUrl && (
              <>
                <button
                  type="button"
                  onClick={use}
                  className="w-full rounded-lg bg-white px-5 py-3.5 text-[16px] font-medium text-black"
                >
                  Use this one
                </button>
                <button
                  type="button"
                  onClick={replay}
                  className="w-full rounded-lg border border-white/30 px-5 py-3.5 text-[16px] font-medium"
                >
                  Play it again
                </button>
              </>
            )}
            <button
              type="button"
              onClick={retake}
              className="w-full rounded-lg border border-white/30 px-5 py-3.5 text-[16px] font-medium"
            >
              Start again
            </button>
          </div>
        ) : rolling || resuming ? (
          <>
            <button
              type="button"
              onClick={last ? finish : nextSegment}
              disabled={resuming}
              className="w-full rounded-lg bg-white px-5 py-3.5 text-[16px] font-medium text-black disabled:opacity-50"
            >
              {last ? "Finish" : segmented ? "Cut — next prompt" : "Next prompt"}
            </button>
            {!last && (
              <button
                type="button"
                onClick={finish}
                className="mt-3 w-full text-center text-[14px] text-white/50 underline"
              >
                That&rsquo;s enough, finish here
              </button>
            )}
            <p className="mt-3 text-center text-[13px] text-white/50">
              {segmented
                ? "Say this bit, then cut. The join reads as an edit, not a stumble."
                : "Keep going — the next prompt is already showing."}
            </p>
          </>
        ) : phase === "paused" ? (
          <>
            <button
              type="button"
              onClick={resumeSegment}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white"
            >
              <span className="h-11 w-11 rounded-full bg-red-500" />
            </button>
            <p className="mt-3 text-center text-[13px] text-white/50">
              Held. Read the next one, take a breath, then record when you&rsquo;re ready.
            </p>
            <button
              type="button"
              onClick={finish}
              className="mt-3 w-full text-center text-[14px] text-white/50 underline"
            >
              That&rsquo;s enough, finish here
            </button>
          </>
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
              Say it your way. You record it one prompt at a time, so there&rsquo;s no
              rush and nothing to memorise.
            </p>
          </>
        )}

        {!started && phase !== "review" && (
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
