"use client";

import { useState } from "react";
import { Loader2, Check, Star } from "lucide-react";
import Parse from "@/lib/parse-client";
import type { SurveyState, SurveyResult } from "./types";

// The post-event rating, shared by /m/[notificationId] and the /me recap
// popup. Single 1-5 stars + optional comment, plus the private virtual-host
// half on plans that had one.
//
// Both halves are independently submittable — an attendee who only wants to
// say something about the host must not be forced to star the event first.
// The server (submitAttendeeSurvey) enforces the same rule.

export default function SurveyCard({
  notificationId,
  survey,
  attendeeName,
  variant = "card",
  onSaved,
}: {
  notificationId: string;
  survey: SurveyState;
  attendeeName: string;
  /** "card" draws its own border (the /m page); "bare" sits inside a modal. */
  variant?: "card" | "bare";
  onSaved?: (result: SurveyResult) => void;
}) {
  const [rating, setRating] = useState<number>(survey.existing?.rating ?? 0);
  const [comment, setComment] = useState<string>(survey.existing?.comment ?? "");
  const [existing, setExisting] = useState<SurveyResult | null>(survey.existing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  async function submit() {
    // The private host-feedback half is gone, so an event rating is the whole
    // form — nothing to submit without one.
    const hasEventRating = rating >= 1;
    if (!hasEventRating) return;
    setError(null);
    setSubmitting(true);
    setJustSaved(false);
    try {
      const result = (await Parse.Cloud.run("submitAttendeeSurvey", {
        notificationId,
        rating: hasEventRating ? rating : undefined,
        comment: hasEventRating ? comment.trim() || undefined : undefined,
      })) as SurveyResult;
      setExisting(result);
      setJustSaved(true);
      onSaved?.(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save your rating.");
    } finally {
      setSubmitting(false);
    }
  }

  const stars = Array.from({ length: survey.ratingMax }, (_, i) => i + 1);

  return (
    <div className={variant === "card" ? "border border-zinc-200 rounded-xl p-5 mb-6" : ""}>
      <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
        How was it?
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        {existing
          ? "Update your rating below — the host can see your response."
          : "Rate the event so the host knows what's landing. Optional."}
      </p>

      <div
        className="flex items-center gap-1 mb-4"
        role="radiogroup"
        aria-label="Rate this event from 1 to 5 stars"
      >
        {stars.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => {
              setRating(n);
              setJustSaved(false);
            }}
            disabled={submitting}
            className="p-1 disabled:opacity-50 transition-transform hover:scale-110"
          >
            <Star
              className={`w-7 h-7 ${
                rating >= n ? "fill-amber-400 text-amber-400" : "fill-zinc-100 text-zinc-300"
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="text-xs text-zinc-500 ml-2">
            {rating} of {survey.ratingMax}
          </span>
        )}
      </div>

      <label className="block">
        <span className="sr-only">Optional comment</span>
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            setJustSaved(false);
          }}
          maxLength={survey.commentMaxLen}
          rows={2}
          disabled={submitting}
          placeholder="Anything you'd want the host to know? (optional)"
          className="w-full text-sm border border-zinc-200 rounded-lg p-3 focus:outline-none focus:border-zinc-400 resize-y disabled:opacity-50"
        />
      </label>

      {/* A private "how was your host?" half used to sit here, rendered only on
          virtual-hosted plans and routed to the Leaf team rather than the group.
          It went with the persona on 2026-09-02: rating a person who does not
          exist is not feedback anyone can act on. Attendee ratings above are
          unchanged. */}

      <div className="flex items-center justify-between gap-3 mt-3">
        <p className="text-[11px] text-zinc-400">Visible to the host as {attendeeName}.</p>
        <button
          type="button"
          onClick={submit}
          disabled={submitting || rating < 1}
          className="inline-flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : justSaved ? (
            <Check className="w-3.5 h-3.5" />
          ) : null}
          {submitting ? "Saving…" : justSaved ? "Saved" : existing ? "Update" : "Submit"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
