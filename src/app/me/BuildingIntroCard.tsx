"use client";

import { useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import { COPY, type BuildingIntroAnswer, type BuildingIntroChannel } from "./buildingIntroCopy";
import BuildingIntroComposer, { type BuildingIntroComposerPayload } from "@/components/BuildingIntroComposer";

export interface BuildingIntroPrompt {
  key: "building_intro";
  calendarId: string | null;
  calendarName: string;
  shareId: string | null;
  preview?: boolean;
  // A `yes` that never sent anything comes back once, straight into the composer.
  stage?: "composer";
  composer?: BuildingIntroComposerPayload;
}

type Phase =
  | { kind: "asking" }
  | { kind: "saving" }
  | { kind: "channels"; picked: BuildingIntroChannel[]; saving: boolean }
  | { kind: "composer"; composer: BuildingIntroComposerPayload; resurfaced: boolean }
  | { kind: "done"; answer: BuildingIntroAnswer }
  | { kind: "error" };

export default function BuildingIntroCard({ prompt }: { prompt: BuildingIntroPrompt }) {
  const resurfaced = prompt.stage === "composer" && !!prompt.composer;
  const [phase, setPhase] = useState<Phase>(() =>
    resurfaced ? { kind: "composer", composer: prompt.composer!, resurfaced: true } : { kind: "asking" });
  const renderedRef = useRef(false);
  const preview = prompt.preview === true;
  const base = { surface: "me_card", calendarId: prompt.calendarId, preview };

  useEffect(() => {
    if (resurfaced || renderedRef.current) return;
    renderedRef.current = true;
    Parse.Cloud.run("recordBuildingIntroEvent", { event: "rendered", ...base }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.calendarId, preview]);

  // The answer lands before the channel step so an abandon still counts as a
  // `yes`; the channels are a refinement, saved on Done.
  async function pick(answer: BuildingIntroAnswer) {
    setPhase({ kind: "saving" });
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
      const r: { composer?: BuildingIntroComposerPayload } = await Parse.Cloud.run("recordBuildingIntroChannels", {
        channels: phase.picked,
        ...base,
      });
      setPhase(r.composer ? { kind: "composer", composer: r.composer, resurfaced: false } : { kind: "done", answer: "yes" });
    } catch {
      setPhase({ kind: "error" });
    }
  }

  if (phase.kind === "composer") {
    return (
      <div className="cq">
        <div className="cq-top">
          <div className="eyebrow">{prompt.calendarName}</div>
        </div>
        <BuildingIntroComposer
          composer={phase.composer}
          calendarId={prompt.calendarId}
          surface="me_card"
          preview={preview}
          resurfaced={phase.resurfaced}
          onDone={() => setPhase({ kind: "done", answer: "yes" })}
        />
      </div>
    );
  }

  if (phase.kind === "done") {
    return (
      <div className="cq" role="status">
        <div className="eyebrow">{prompt.calendarName}</div>
        <div className="cq-h">{COPY.thanks[phase.answer]}</div>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="cq" role="status">
        <div className="cq-h">{COPY.error}</div>
        <div className="cq-opts">
          <button type="button" className="cq-opt" onClick={() => setPhase({ kind: "asking" })}>Try again</button>
        </div>
      </div>
    );
  }

  if (phase.kind === "channels") {
    const { picked, saving } = phase;
    return (
      <div className="cq" aria-busy={saving}>
        <div className="cq-top">
          <div className="eyebrow">{prompt.calendarName}</div>
        </div>
        <div className="cq-h">{COPY.channels.prompt}</div>
        <p className="cq-sub">{COPY.channels.sub}</p>
        <div className="cq-pills" role="group" aria-label={COPY.channels.prompt}>
          {COPY.channels.options.map((o) => (
            <button
              type="button"
              key={o.key}
              className={`cq-pill${picked.includes(o.key) ? " on" : ""}`}
              aria-pressed={picked.includes(o.key)}
              disabled={saving}
              onClick={() => toggle(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn primary cq-cta"
          disabled={saving || picked.length === 0}
          onClick={finishChannels}
        >
          {COPY.channels.done}
        </button>
      </div>
    );
  }

  const busy = phase.kind === "saving";
  return (
    <div className="cq" aria-busy={busy}>
      <div className="cq-top">
        <div className="eyebrow">{prompt.calendarName}</div>
      </div>
      <div className="cq-h">{COPY.prompt}</div>
      <div className="cq-opts" role="group" aria-label={COPY.prompt}>
        {COPY.options.map((o) => (
          <button type="button" key={o.key} className="cq-opt" disabled={busy} onClick={() => pick(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
