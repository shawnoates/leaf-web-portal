"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { SurveyCardHandle } from "./SurveyCard";
import type { PhotoUploadHandle } from "./PhotoUpload";

// The one Submit for a recap surface (/m page, /me popup). It saves the rating
// if it changed. Photos upload on their own as they are picked (PhotoUpload);
// the bar only counts the ones still on their way or that failed, and a tap
// waits for or retries those.
//
// The rating goes first and a failure there doesn't stop the photos: each
// half reports its own error inline, and the bar just says something didn't
// save.

type Status = "idle" | "saved" | "failed";

export function useRecapSubmit() {
  const surveyRef = useRef<SurveyCardHandle>(null);
  const photosRef = useRef<PhotoUploadHandle>(null);
  const submittingRef = useRef(false);
  const [surveyDirty, setSurveyDirty] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  const onSurveyDirtyChange = useCallback((dirty: boolean) => {
    setSurveyDirty(dirty);
    if (dirty && !submittingRef.current) setStatus("idle");
  }, []);

  const onPendingPhotosChange = useCallback((count: number) => {
    setPendingPhotos(count);
    if (count > 0 && !submittingRef.current) setStatus("idle");
  }, []);

  const submit = useCallback(async () => {
    submittingRef.current = true;
    setSubmitting(true);
    setStatus("idle");
    const surveyOk = (await surveyRef.current?.submit()) ?? true;
    const photosOk = (await photosRef.current?.submit()) ?? true;
    submittingRef.current = false;
    setSubmitting(false);
    setStatus(surveyOk && photosOk ? "saved" : "failed");
  }, []);

  return {
    surveyRef,
    photosRef,
    onSurveyDirtyChange,
    onPendingPhotosChange,
    surveyDirty,
    pendingPhotos,
    submitting,
    status,
    submit,
  };
}

function pendingLabel(surveyDirty: boolean, pendingPhotos: number): string {
  const parts: string[] = [];
  if (surveyDirty) parts.push("Your rating");
  if (pendingPhotos > 0) parts.push(`${pendingPhotos} ${pendingPhotos === 1 ? "photo" : "photos"}`);
  return parts.join(" + ");
}

export default function RecapSubmitBar({
  submission,
  alreadyAnswered,
  position,
}: {
  submission: ReturnType<typeof useRecapSubmit>;
  /** They've rated before, so an idle bar reads "All saved", not a prompt. */
  alreadyAnswered: boolean;
  /** "sticky" pins to the bottom of a scrolling modal; "fixed" to the viewport. */
  position: "sticky" | "fixed";
}) {
  const { surveyDirty, pendingPhotos, submitting, status, submit } = submission;
  const pending = pendingLabel(surveyDirty, pendingPhotos);
  const hasPending = pending.length > 0;

  const message = submitting
    ? `Saving ${pending.toLowerCase() || "your answers"}…`
    : status === "failed"
      ? "Something didn't save. See above."
      : hasPending
        ? pending
        : status === "saved"
          ? "Thanks, it's all saved."
          : alreadyAnswered
            ? "All saved. Change anything above to update."
            : "Rate the plan. Photos save on their own.";

  const shell =
    position === "sticky"
      ? "sticky bottom-0 z-10"
      : "fixed inset-x-0 bottom-0 z-40";

  return (
    <div
      className={`${shell} bg-white/95 backdrop-blur border-t border-zinc-200 pb-[env(safe-area-inset-bottom)]`}
    >
      <div
        className={`flex items-center justify-between gap-3 py-3 ${
          position === "sticky" ? "px-5 sm:px-6" : "max-w-2xl mx-auto px-4"
        }`}
      >
        <p
          className={`text-xs truncate ${status === "failed" && !submitting ? "text-red-600" : "text-zinc-500"}`}
          aria-live="polite"
        >
          {message}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !hasPending}
          className="shrink-0 inline-flex items-center gap-2 bg-zinc-900 text-white px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : status === "saved" && !hasPending ? (
            <Check className="w-3.5 h-3.5" />
          ) : null}
          {submitting
            ? "Saving…"
            : status === "saved" && !hasPending
              ? "Saved"
              : status === "failed" && hasPending
                ? "Try again"
                : "Submit"}
        </button>
      </div>
    </div>
  );
}
