"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import Parse from "@/lib/parse-client";
import { COPY, type BuildingIntroAnswer, type BuildingIntroChannel } from "@/app/me/buildingIntroCopy";

export interface BuildingIntroPayload {
  calendarId: string;
  calendarName: string;
  shareId: string | null;
}

type Phase =
  | { kind: "asking"; saving: boolean }
  | { kind: "channels"; picked: BuildingIntroChannel[]; saving: boolean }
  | { kind: "done"; answer: BuildingIntroAnswer }
  | { kind: "error" };

/**
 * The post-follow question (spec §10.1), rendered inside the follow modal
 * after a public follow has landed. Requires a Parse session — the caller
 * adopts the OTP session before mounting this. Dismissing the modal is not
 * an answer; the question surfaces once more on /me.
 */
export default function BuildingIntroPrompt({
  intro,
  brandColor,
  onDone,
}: {
  intro: BuildingIntroPayload;
  brandColor?: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "asking", saving: false });
  const renderedRef = useRef(false);
  const base = { surface: "post_follow", calendarId: intro.calendarId };

  useEffect(() => {
    if (renderedRef.current) return;
    renderedRef.current = true;
    Parse.Cloud.run("recordBuildingIntroEvent", { event: "rendered", ...base }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro.calendarId]);

  async function pick(answer: BuildingIntroAnswer) {
    setPhase({ kind: "asking", saving: true });
    try {
      await Parse.Cloud.run("answerBuildingIntro", { answer, ...base });
      setPhase(answer === "yes" ? { kind: "channels", picked: [], saving: false } : { kind: "done", answer });
    } catch {
      setPhase({ kind: "error" });
    }
  }

  function toggle(c: BuildingIntroChannel) {
    if (phase.kind !== "channels") return;
    const picked = phase.picked.includes(c) ? phase.picked.filter((x) => x !== c) : [...phase.picked, c];
    setPhase({ ...phase, picked });
  }

  async function finishChannels() {
    if (phase.kind !== "channels" || phase.picked.length === 0) return;
    setPhase({ ...phase, saving: true });
    try {
      await Parse.Cloud.run("recordBuildingIntroChannels", { channels: phase.picked, ...base });
      setPhase({ kind: "done", answer: "yes" });
    } catch {
      setPhase({ kind: "error" });
    }
  }

  const accent = brandColor || "#18181b";
  const doneBtn = "text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900";

  if (phase.kind === "done") {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-light">{COPY.thanks[phase.answer]}</h3>
        <p className="text-sm text-zinc-500">You&apos;re following {intro.calendarName}.</p>
        <button type="button" onClick={onDone} className={doneBtn}>Done</button>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="text-sm text-zinc-600">{COPY.error}</p>
        <button type="button" onClick={() => setPhase({ kind: "asking", saving: false })} className={doneBtn}>
          Try again
        </button>
      </div>
    );
  }

  if (phase.kind === "channels") {
    const { picked, saving } = phase;
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-2xl font-light tracking-tight">{COPY.channels.prompt}</h3>
          <p className="text-sm text-zinc-500 mt-1">{COPY.channels.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={COPY.channels.prompt}>
          {COPY.channels.options.map((o) => {
            const on = picked.includes(o.key);
            return (
              <button
                type="button"
                key={o.key}
                aria-pressed={on}
                disabled={saving}
                onClick={() => toggle(o.key)}
                className={`px-4 py-2 rounded-full border text-sm transition-colors disabled:opacity-50 ${
                  on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-800 hover:border-zinc-900"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={saving || picked.length === 0}
          onClick={finishChannels}
          className="w-full text-white py-3 text-xs font-bold uppercase tracking-widest transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : COPY.channels.done}
        </button>
      </div>
    );
  }

  const { saving } = phase;
  return (
    <div className="space-y-5" aria-busy={saving}>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">You&apos;re following</p>
        <h3 className="text-2xl font-light tracking-tight mt-2">{COPY.prompt}</h3>
      </div>
      <div className="flex flex-col gap-2" role="group" aria-label={COPY.prompt}>
        {COPY.options.map((o) => (
          <button
            type="button"
            key={o.key}
            disabled={saving}
            onClick={() => pick(o.key)}
            className="w-full text-left px-4 py-3 border border-zinc-300 rounded-lg text-sm text-zinc-900 hover:border-zinc-900 transition-colors disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
