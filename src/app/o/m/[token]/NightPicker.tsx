"use client";

/**
 * Pick the night: the one from Shawn's email, shown as neighbors will see it
 * on the calendar, or their own. The suggestion is selected by default so
 * most merchants never type a word.
 */

import { Field, dollars, input, textarea } from "./ui";

export type Suggested = { title: string; description: string; durationMin: number; priceCents: number };

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-leaf-700 bg-leaf-700" : "border-stone-300 bg-white"}`}
    >
      {on && <span className="h-2 w-2 rounded-full bg-white" />}
    </span>
  );
}

export default function NightPicker({
  suggested,
  useOwn,
  setUseOwn,
  title,
  setTitle,
  description,
  setDescription,
  meta,
  merchantName,
}: {
  suggested: Suggested;
  useOwn: boolean;
  setUseOwn: (v: boolean) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  /** e.g. "Wed 7 PM · 90 min · 8 to 15 neighbors · Free to join" */
  meta: string;
  merchantName: string;
}) {
  return (
    <div className="space-y-3" role="radiogroup" aria-label="Your night">
      <button
        type="button"
        role="radio"
        aria-checked={!useOwn}
        onClick={() => setUseOwn(false)}
        className={`relative w-full overflow-hidden rounded-2xl border-2 text-left transition-colors ${
          !useOwn ? "border-leaf-700 bg-leaf-50/60" : "border-stone-200 bg-white"
        }`}
      >
        <div className="flex gap-3 p-4">
          <Radio on={!useOwn} />
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded-full bg-leaf-800 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
              Suggested for you
            </span>
            {/* A preview of the listing on the calendar. */}
            <div className="mt-3 rounded-xl border border-stone-200 bg-white p-3.5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-500">{merchantName}</p>
              <p className="mt-0.5 font-fm-serif text-[24px] leading-tight text-stone-900">{capitalize(suggested.title)}</p>
              <p className="mt-1 text-[15px] leading-snug text-stone-600">{suggested.description}</p>
              <p className="mt-2.5 text-[13px] font-medium text-leaf-700">{meta}</p>
            </div>
            <p className="mt-2 text-[13px] text-stone-500">The night from our email. Neighbors will see it like this.</p>
          </div>
        </div>
      </button>

      <div
        className={`overflow-hidden rounded-2xl border-2 transition-colors ${useOwn ? "border-leaf-700 bg-white" : "border-stone-200 bg-white"}`}
      >
        <button type="button" role="radio" aria-checked={useOwn} onClick={() => setUseOwn(true)} className="flex w-full gap-3 p-4 text-left">
          <Radio on={useOwn} />
          <div>
            <p className="text-[16px] font-semibold text-stone-900">Write your own</p>
            <p className="text-[14px] text-stone-500">Something you already do, or a twist on the idea.</p>
          </div>
        </button>
        {useOwn && (
          <div className="space-y-4 border-t border-stone-100 px-4 pb-4 pt-4">
            <Field label="Name it">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Tuesday trivia" className={input} autoFocus />
            </Field>
            <Field label="In a sentence">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What neighbors will do, in one line."
                className={textarea}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

export function nightMeta({ startTimeLabel, durationMin, headcount, priceCents, perRsvp }: {
  startTimeLabel: string;
  durationMin: number;
  headcount: string;
  priceCents: number;
  perRsvp: boolean;
}) {
  return [startTimeLabel, `${durationMin} min`, `${headcount} neighbors`, perRsvp ? "Free to join" : `${dollars(priceCents)} a seat`].join(" · ");
}
