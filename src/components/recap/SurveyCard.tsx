"use client";

import { useState } from "react";
import { Loader2, Check, Star, Lock } from "lucide-react";
import Parse from "@/lib/parse-client";
import type { SurveyState, SurveyResult } from "./types";

// The post-event rating, shared by /m/[notificationId] and the /me recap
// popup. Two halves:
//
//   1. The plan — 1-5 stars + a public comment. The comment is shown on the
//      memory page to everyone who holds a link to the plan (attendees, host,
//      calendar owner), so the label says so.
//   2. The staff host — only on plans Leaf staffed with a roster host. 1-5
//      stars + a private note. Both go to the Leaf team and never to the host
//      or the group; the calendar owner sees the average only.
//
// Both halves are independently submittable — an attendee who only wants to
// say something about the host must not be forced to star the plan first.
// The server (submitAttendeeSurvey) enforces the same rule, and it refuses
// the whole form from anyone who ran the plan.

function Stars({
  value,
  max,
  onChange,
  disabled,
  label,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled: boolean;
  label: string;
}) {
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          disabled={disabled}
          className="p-1 disabled:opacity-50 transition-transform hover:scale-110"
        >
          <Star
            className={`w-7 h-7 ${
              value >= n ? "fill-amber-400 text-amber-400" : "fill-zinc-100 text-zinc-300"
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs text-zinc-500 ml-2">
          {value} of {max}
        </span>
      )}
    </div>
  );
}

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
  const hostFeedback = survey.hostFeedback?.enabled ? survey.hostFeedback : null;

  const [rating, setRating] = useState<number>(survey.existing?.rating ?? 0);
  const [comment, setComment] = useState<string>(survey.existing?.comment ?? "");
  const [hostRating, setHostRating] = useState<number>(survey.existing?.hostRating ?? 0);
  const [hostComment, setHostComment] = useState<string>(survey.existing?.hostComment ?? "");
  const [existing, setExisting] = useState<SurveyResult | null>(survey.existing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const hasEventRating = rating >= 1;
  const hasHostHalf = !!hostFeedback && (hostRating >= 1 || hostComment.trim().length > 0);
  const canSubmit = hasEventRating || hasHostHalf;

  const touch = () => setJustSaved(false);

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    setJustSaved(false);
    try {
      // Send only the halves that have something in them — the server
      // overwrites per half, so an untouched half must stay absent, not
      // arrive as an empty value that blanks an earlier answer.
      const result = (await Parse.Cloud.run("submitAttendeeSurvey", {
        notificationId,
        rating: hasEventRating ? rating : undefined,
        comment: hasEventRating ? comment.trim() || undefined : undefined,
        hostRating: hostFeedback && hostRating >= 1 ? hostRating : undefined,
        hostComment: hostFeedback && hostComment.trim() ? hostComment.trim() : undefined,
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

  return (
    <div className={variant === "card" ? "border border-zinc-200 rounded-xl p-5 mb-6" : ""}>
      <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-1">
        How was it?
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        {existing
          ? "Update your answers below any time."
          : "Rate the plan so the host knows what's landing. Optional."}
      </p>

      <div className="mb-4">
        <Stars
          value={rating}
          max={survey.ratingMax}
          onChange={(n) => {
            setRating(n);
            touch();
          }}
          disabled={submitting}
          label="Rate this plan from 1 to 5 stars"
        />
      </div>

      <label className="block">
        <span className="sr-only">Public comment</span>
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            touch();
          }}
          maxLength={survey.commentMaxLen}
          rows={2}
          disabled={submitting}
          placeholder="Say something about the plan (optional)"
          className="w-full text-sm border border-zinc-200 rounded-lg p-3 focus:outline-none focus:border-zinc-400 resize-y disabled:opacity-50"
        />
      </label>
      <p className="text-[11px] text-zinc-400 mt-1">
        Shown on this page as {attendeeName}, to the host and everyone who went.
      </p>

      {hostFeedback && (
        <div className="mt-5 pt-5 border-t border-zinc-100">
          <div className="flex items-center gap-3 mb-1">
            {hostFeedback.hostPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hostFeedback.hostPhotoUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : null}
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              {hostFeedback.hostName ? `How was ${hostFeedback.hostName}, your host?` : "How was your host?"}
            </h3>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Goes to the Leaf team only. Your host never sees this.
          </p>
          <div className="mb-3">
            <Stars
              value={hostRating}
              max={survey.ratingMax}
              onChange={(n) => {
                setHostRating(n);
                touch();
              }}
              disabled={submitting}
              label="Rate your host from 1 to 5 stars"
            />
          </div>
          <label className="block">
            <span className="sr-only">Private note to the Leaf team</span>
            <textarea
              value={hostComment}
              onChange={(e) => {
                setHostComment(e.target.value);
                touch();
              }}
              maxLength={survey.commentMaxLen}
              rows={2}
              disabled={submitting}
              placeholder="Private note to the Leaf team about your host (optional)"
              className="w-full text-sm border border-zinc-200 rounded-lg p-3 focus:outline-none focus:border-zinc-400 resize-y disabled:opacity-50"
            />
          </label>
          <p className="flex items-center gap-1 text-[11px] text-zinc-400 mt-1">
            <Lock className="w-3 h-3" />
            Private. Not shown to the host, the group, or on this page.
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !canSubmit}
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
