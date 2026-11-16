"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

// ============================================================================
// Interest pills — neighborhood calendars ask followers which KINDS of plans
// they'd go to ("Outdoors", "Games & trivia"…) instead of asking them to come
// up with a plan. When a plan of a picked kind is hosted, they get a text,
// push or email (leaflets-server cloud/interest-pills.js).
//
// The list is Leaf's (InterestPill on the server, edited in the admin portal);
// it arrives on getOrgCalendarPage as `interestPills`, and the viewer's own
// picks as `myInterestPills`.
//
//   <InterestPills>        the toggle row, controlled
//   <InterestPillsPrompt>  the post-follow step / dialog around it
// ============================================================================

export interface InterestPillDef {
  key: string;
  label: string;
  emoji: string | null;
}

export const INTEREST_PILLS_HEADLINE = "What would you go to?";
export const INTEREST_PILLS_SUBHEAD = "We’ll let you know the moment one’s hosted.";

export function InterestPills({
  pills,
  selected,
  onToggle,
  disabled = false,
  size = "md",
}: {
  pills: InterestPillDef[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Kinds of plans">
      {pills.map((p) => {
        const on = selected.has(p.key);
        return (
          <button
            key={p.key}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(p.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-all active:scale-95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${pad} ${
              on
                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
            }`}
          >
            {p.emoji && <span aria-hidden="true">{p.emoji}</span>}
            <span>{p.label}</span>
            {on && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The pick-your-kinds step. Owns its own selection until Done; `onDone` saves
 * and resolves (the step shows a saving state meanwhile, and an error line if
 * it throws). Skip / ✕ / Esc / the scrim close without saving.
 */
export function InterestPillsPrompt({
  calendarName,
  pills,
  initial,
  onDone,
  onSkip,
  inline = false,
}: {
  calendarName: string;
  pills: InterestPillDef[];
  initial: Iterable<string>;
  onDone: (keys: string[]) => Promise<void>;
  onSkip: () => void;
  /** Render as a card body (inside FollowModal) rather than its own dialog. */
  inline?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inline) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inline, onSkip]);

  const toggle = (key: string) => {
    setError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const done = async () => {
    setSaving(true);
    setError(null);
    try {
      // List order, not tap order.
      await onDone(pills.map((p) => p.key).filter((k) => selected.has(k)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save. Try again.");
      setSaving(false);
    }
  };

  const body = (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs tracking-wider uppercase text-zinc-400 font-bold">{calendarName}</p>
        <h3 id="ipills-headline" className="text-2xl font-light tracking-tight">
          {INTEREST_PILLS_HEADLINE}
        </h3>
        <p className="text-sm text-zinc-500">{INTEREST_PILLS_SUBHEAD}</p>
      </div>
      <InterestPills pills={pills} selected={selected} onToggle={toggle} disabled={saving} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-[11px] leading-relaxed text-zinc-400">
        A text, push or email for each new plan that matches, on top of the weekly roundup. Msg frequency varies. Reply STOP to opt out of texts.
      </p>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="text-sm text-zinc-500 hover:text-zinc-900 px-3 py-2"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={done}
          disabled={saving}
          className="text-sm font-semibold bg-zinc-900 text-white rounded-full px-5 py-2.5 hover:bg-zinc-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : selected.size > 0 ? "Done" : "Skip"}
        </button>
      </div>
    </div>
  );

  if (inline) return body;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-zinc-900/60 backdrop-blur-sm"
      onClick={onSkip}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ipills-headline"
        className="bg-white w-full max-w-md rounded-t-2xl md:rounded-xl p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onSkip}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900"
        >
          <X className="w-5 h-5" />
        </button>
        {body}
      </div>
    </div>
  );
}
