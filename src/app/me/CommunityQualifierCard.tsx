"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { detectCity } from "@/lib/detectCity";
import { COPY, type Q1Key, type Q2Key, type Q3Key } from "./communityQualifierCopy";

// ============================================================================
// Community qualifier — three questions that advance in place, then a build.
// Every path ends on a screen with an action: nearby plans, a calendar, or a
// first plan. There is no thank-you state. Answers mirror to sessionStorage
// so a refresh resumes at the same step.
// ============================================================================

export interface QualifierCalendar { id: string; name: string; shareId: string | null }
export interface NearbyPlan { id: string; title: string; calendarName: string; when: string }
export interface QualifierCreatedPlan { eventGroupId: string | null; title: string }

type Route = "unqualified" | "calendar_created" | "qualified";
interface CompleteResult { route: Route; calendar: QualifierCalendar | null }

type Step = 1 | 2 | 3;
interface Stored { step: Step; q1?: Q1Key; q2?: Q2Key; q3?: Q3Key }
const STORE_KEY = "leaf.communityQualifier";

function readStored(): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch { return null; }
}
function writeStored(s: Stored | null) {
  try {
    if (s) sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORE_KEY);
  } catch { /* storage disabled */ }
}

function track(event: "rendered" | "step", step?: Step, answerKey?: string, preview = false) {
  Parse.Cloud.run("recordCommunityQualifierEvent", { event, step, answerKey, preview }).catch(() => {});
}

type Phase =
  | { kind: "asking" }
  | { kind: "completing" }
  | { kind: "unqualified" }
  | { kind: "ready"; calendar: QualifierCalendar; assurance: boolean }
  | { kind: "error" };

export default function CommunityQualifierCard({
  nearby, createdPlan, preview = false, onCalendarReady, onCreatePlan,
}: {
  /** Upcoming plans on calendars this person follows — the 7.1 redirect. */
  nearby: NearbyPlan[];
  /** Set by the parent once the composer has created a plan. */
  createdPlan: QualifierCreatedPlan | null;
  /** Admin design preview — the server records nothing and creates nothing. */
  preview?: boolean;
  onCalendarReady: (cal: QualifierCalendar) => void;
  onCreatePlan: (cal: QualifierCalendar) => void;
}) {
  const [stored, setStored] = useState<Stored>(() => readStored() || { step: 1 });
  const [phase, setPhase] = useState<Phase>({ kind: "asking" });
  const renderedRef = useRef(false);
  const firstPlanRef = useRef<string | null>(null);

  useEffect(() => {
    if (renderedRef.current) return;
    renderedRef.current = true;
    track("rendered", undefined, undefined, preview);
  }, [preview]);

  // First plan landed while we were on the ready screen. The done screen is
  // derived from `createdPlan` at render time; this only stamps the server.
  const finishedPlan = phase.kind === "ready" && createdPlan?.eventGroupId ? createdPlan : null;
  useEffect(() => {
    if (!finishedPlan?.eventGroupId || firstPlanRef.current === finishedPlan.eventGroupId) return;
    firstPlanRef.current = finishedPlan.eventGroupId;
    Parse.Cloud.run("recordCommunityQualifierFirstPlan", { eventGroupId: finishedPlan.eventGroupId, preview }).catch(() => {});
  }, [finishedPlan, preview]);

  function advance(next: Stored) {
    setStored(next);
    writeStored(next);
  }

  async function complete(answers: Stored) {
    setPhase({ kind: "completing" });
    try {
      const d = detectCity();
      const cityHint = {
        city: (d as { resolvedCity?: string }).resolvedCity || d.city,
        lat: d.lat, lng: d.lng, fallback: d.fallback,
      };
      const res = (await Parse.Cloud.run("completeCommunityQualifier", {
        q1: answers.q1, q2: answers.q2, q3: answers.q3, cityHint, preview,
      })) as CompleteResult;
      writeStored(null);
      if (res.route === "unqualified" || !res.calendar) {
        setPhase({ kind: "unqualified" });
        return;
      }
      onCalendarReady(res.calendar);
      setPhase({ kind: "ready", calendar: res.calendar, assurance: res.route === "qualified" });
    } catch {
      setPhase({ kind: "error" });
    }
  }

  function answer1(k: Q1Key) {
    track("step", 1, k, preview);
    const next: Stored = { step: k === "yes" ? 2 : 1, q1: k };
    if (k === "not_really") { advance(next); complete(next); return; }
    advance(next);
  }
  function answer2(k: Q2Key) {
    track("step", 2, k, preview);
    advance({ ...stored, step: 3, q2: k });
  }
  function answer3(k: Q3Key) {
    track("step", 3, k, preview);
    const next: Stored = { ...stored, step: 3, q3: k };
    advance(next);
    complete(next);
  }
  function back() {
    if (stored.step === 2) advance({ step: 1 });
    else if (stored.step === 3) advance({ ...stored, step: 2, q3: undefined });
  }

  if (phase.kind === "error") {
    return (
      <div className="cq" role="status">
        <p className="cq-p">{COPY.error}</p>
        <button className="btn ghost" onClick={() => setPhase({ kind: "asking" })}>{COPY.back}</button>
      </div>
    );
  }

  if (phase.kind === "unqualified") {
    const rows = nearby.slice(0, 3);
    return (
      <div className="cq">
        <p className="cq-lead">{COPY.unqualified.lead}</p>
        {rows.length > 0 ? (
          <div className="cq-rows">
            {rows.map((p) => (
              <div className="cq-row" key={p.id}>
                <div className="cq-row-text">
                  <div className="cq-row-t">{p.title}</div>
                  <div className="cq-row-s">{[p.calendarName, p.when].filter(Boolean).join(" · ")}</div>
                </div>
                <Link className="row-btn ghost" href={`/p/${p.id}`}>{COPY.unqualified.open}</Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="cq-p">{COPY.unqualified.empty}</p>
        )}
        <Link className="btn ghost cq-cta" href="/calendars">{COPY.unqualified.browse}</Link>
      </div>
    );
  }

  if (phase.kind === "ready" && finishedPlan) {
    return (
      <div className="cq" role="status">
        <div className="cq-h">{COPY.done.title(finishedPlan.title)}</div>
        <p className="cq-p">{COPY.done.closer}</p>
        {finishedPlan.eventGroupId && (
          <Link className="btn ghost cq-cta" href={`/p/${finishedPlan.eventGroupId}`}>{COPY.done.open} ↗</Link>
        )}
      </div>
    );
  }

  if (phase.kind === "ready") {
    return (
      <ReadyScreen
        calendar={phase.calendar}
        assurance={phase.assurance}
        onRenamed={(name) => setPhase({ ...phase, calendar: { ...phase.calendar, name } })}
        onCreate={() => onCreatePlan(phase.calendar)}
      />
    );
  }

  const busy = phase.kind === "completing";
  const step = stored.step;
  return (
    <div className="cq" aria-busy={busy}>
      <div className="cq-top">
        {step > 1 && (
          <button type="button" className="cq-back" onClick={back} disabled={busy} aria-label={COPY.back}>←</button>
        )}
        <div className="eyebrow">{COPY.progress(step)}</div>
      </div>
      {step === 1 && (
        <Question prompt={COPY.q1.prompt} sub={COPY.q1.sub} options={COPY.q1.options} onPick={answer1} busy={busy} />
      )}
      {step === 2 && (
        <Question prompt={COPY.q2.prompt} options={COPY.q2.options} onPick={answer2} busy={busy} />
      )}
      {step === 3 && (
        <Question prompt={COPY.q3.prompt} options={COPY.q3.options} onPick={answer3} busy={busy} />
      )}
    </div>
  );
}

function Question<K extends string>({
  prompt, sub, options, onPick, busy,
}: {
  prompt: string;
  sub?: string;
  options: { key: K; label: string }[];
  onPick: (k: K) => void;
  busy: boolean;
}) {
  return (
    <>
      <div className="cq-h">{prompt}</div>
      {sub && <p className="cq-sub">{sub}</p>}
      <div className="cq-opts" role="group" aria-label={prompt}>
        {options.map((o) => (
          <button type="button" key={o.key} className="cq-opt" disabled={busy} onClick={() => onPick(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}

// Calendar named, editable inline. The assurance paragraph renders on the
// qualified route only; the self-serve route gets the short line and no more.
function ReadyScreen({
  calendar, assurance, onRenamed, onCreate,
}: {
  calendar: QualifierCalendar;
  assurance: boolean;
  onRenamed: (name: string) => void;
  onCreate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(calendar.name);
  const [saving, setSaving] = useState(false);

  async function save() {
    const name = draft.trim();
    if (!name || name === calendar.name) { setEditing(false); return; }
    setSaving(true);
    try {
      await Parse.Cloud.run("updateOrganization", { calendarId: calendar.id, name });
      onRenamed(name);
      setEditing(false);
    } catch {
      setDraft(calendar.name);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cq" role="status">
      {editing ? (
        <div className="cq-rename">
          <input
            className="cq-input"
            value={draft}
            maxLength={60}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(calendar.name); setEditing(false); } }}
          />
          <button className="btn ghost sm" disabled={saving} onClick={save}>{COPY.ready.renameSave}</button>
          <button className="btn text" disabled={saving} onClick={() => { setDraft(calendar.name); setEditing(false); }}>
            {COPY.ready.renameCancel}
          </button>
        </div>
      ) : (
        <div className="cq-h">
          {COPY.ready.title(calendar.name)}{" "}
          <button type="button" className="linkbtn" onClick={() => setEditing(true)}>{COPY.ready.rename}</button>
        </div>
      )}
      <p className="cq-p">{assurance ? COPY.ready.assurance : COPY.ready.selfServe}</p>
      <button className="btn primary cq-cta" onClick={onCreate}>{COPY.ready.cta}</button>
    </div>
  );
}
