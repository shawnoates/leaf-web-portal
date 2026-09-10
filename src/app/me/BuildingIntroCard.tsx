"use client";

import { useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import { COPY, type BuildingIntroAnswer } from "./buildingIntroCopy";

export interface BuildingIntroPrompt {
  key: "building_intro";
  calendarId: string | null;
  calendarName: string;
  shareId: string | null;
  preview?: boolean;
}

type Phase =
  | { kind: "asking" }
  | { kind: "saving" }
  | { kind: "done"; answer: BuildingIntroAnswer }
  | { kind: "error" };

export default function BuildingIntroCard({ prompt }: { prompt: BuildingIntroPrompt }) {
  const [phase, setPhase] = useState<Phase>({ kind: "asking" });
  const renderedRef = useRef(false);
  const preview = prompt.preview === true;

  useEffect(() => {
    if (renderedRef.current) return;
    renderedRef.current = true;
    Parse.Cloud.run("recordBuildingIntroEvent", {
      event: "rendered", surface: "me_card", calendarId: prompt.calendarId, preview,
    }).catch(() => {});
  }, [prompt.calendarId, preview]);

  async function pick(answer: BuildingIntroAnswer) {
    setPhase({ kind: "saving" });
    try {
      await Parse.Cloud.run("answerBuildingIntro", {
        answer, surface: "me_card", calendarId: prompt.calendarId, preview,
      });
      setPhase({ kind: "done", answer });
    } catch {
      setPhase({ kind: "error" });
    }
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
