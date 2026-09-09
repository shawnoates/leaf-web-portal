"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { detectCity } from "@/lib/detectCity";
import { SITE_HOST, SITE_URL } from "@/lib/site";
import { COPY, type Q1Key, type Q2Key, type Q3Key } from "./communityQualifierCopy";

// ============================================================================
// Community qualifier — three questions that advance in place, then a build.
// Every path ends on a screen with an action: nearby plans, or a prompt bar
// that drafts their first plan. There is no thank-you state. Answers mirror to
// sessionStorage so a refresh resumes at the same step.
//
// No calendar is created by this card. The composer makes one lazily when the
// plan is saved, so somebody who answers three questions and then walks away
// is never left owning an empty room. Until then the name here is a proposal.
// ============================================================================

export interface QualifierCalendar { id: string; name: string; shareId: string | null }
export interface NearbyPlan { id: string; title: string; calendarName: string; when: string }
export interface QualifierCreatedPlan {
  eventGroupId: string | null;
  title: string;
  inviteUrl: string | null;
  /** Resolved from the refreshed dashboard once the plan lands. */
  calendarShareId: string | null;
}

/** What the composer needs to build the first plan on this person's behalf. */
export interface FirstPlanRequest {
  calendar: QualifierCalendar | null;
  calendarName: string;
  prompt: string;
}

type Route = "unqualified" | "calendar_created" | "qualified";
interface CompleteResult {
  route: Route;
  calendar: QualifierCalendar | null;
  calendarName: string | null;
}
interface Pill { label: string; text: string; reason: string | null }

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
  | { kind: "ready"; calendar: QualifierCalendar | null; calendarName: string; assurance: boolean }
  | { kind: "error" };

export default function CommunityQualifierCard({
  nearby, createdPlan, preview = false, onCreatePlan,
}: {
  /** Upcoming plans on calendars this person follows — the 7.1 redirect. */
  nearby: NearbyPlan[];
  /** Set by the parent once the composer has created a plan. */
  createdPlan: QualifierCreatedPlan | null;
  /** Admin design preview — the server records nothing and creates nothing. */
  preview?: boolean;
  onCreatePlan: (req: FirstPlanRequest) => void;
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

  // First plan landed while we were on the ready screen. The popup is derived
  // from `createdPlan` at render time; this only stamps the server.
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
      if (res.route === "unqualified") {
        setPhase({ kind: "unqualified" });
        return;
      }
      setPhase({
        kind: "ready",
        calendar: res.calendar,
        calendarName: res.calendar?.name || res.calendarName || "Your calendar",
        assurance: res.route === "qualified",
      });
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

  if (phase.kind === "ready") {
    return (
      <>
        <ReadyScreen
          calendarName={phase.calendarName}
          calendar={phase.calendar}
          assurance={phase.assurance}
          knownByName={stored.q2}
          onRenamed={(name) => setPhase({ ...phase, calendarName: name })}
          onSubmit={(prompt) => onCreatePlan({
            calendar: phase.calendar,
            calendarName: phase.calendarName,
            prompt,
          })}
        />
        {finishedPlan && <DonePopup plan={finishedPlan} />}
      </>
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

// The name is editable before the calendar exists, so a rename is local state
// until the composer creates it. Only an ALREADY-owned calendar is renamed
// server-side, because only that one has a row to write to.
function ReadyScreen({
  calendarName, calendar, assurance, knownByName, onRenamed, onSubmit,
}: {
  calendarName: string;
  calendar: QualifierCalendar | null;
  assurance: boolean;
  knownByName?: Q2Key;
  onRenamed: (name: string) => void;
  onSubmit: (prompt: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(calendarName);
  const [saving, setSaving] = useState(false);
  const [text, setText] = useState("");
  const [pills, setPills] = useState<Pill[]>([]);
  const [pillsLoading, setPillsLoading] = useState(true);
  const [selectedPill, setSelectedPill] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const d = detectCity();
    Parse.Cloud.run("suggestFirstPlanPrompts", {
      knownByName,
      cityHint: { city: (d as { resolvedCity?: string }).resolvedCity || d.city, lat: d.lat, lng: d.lng, fallback: d.fallback },
    })
      .then((r: { pills?: Pill[] }) => { if (!cancelled) setPills(Array.isArray(r?.pills) ? r.pills : []); })
      .catch(() => { if (!cancelled) setPills([]); })
      .finally(() => { if (!cancelled) setPillsLoading(false); });
    return () => { cancelled = true; };
  }, [knownByName]);

  async function saveName() {
    const name = draft.trim();
    if (!name || name === calendarName) { setEditing(false); return; }
    // Nothing to write to yet when the calendar is still a proposal — the
    // composer carries this name into creation instead.
    if (!calendar) { onRenamed(name); setEditing(false); return; }
    setSaving(true);
    try {
      await Parse.Cloud.run("updateOrganization", { calendarId: calendar.id, name });
      onRenamed(name);
      setEditing(false);
    } catch {
      setDraft(calendarName);
    } finally {
      setSaving(false);
    }
  }

  function submit(override?: string) {
    const value = (override ?? text).trim();
    if (!value) return;
    onSubmit(value);
  }

  // First tap loads the sentence so it can be edited; tapping the loaded pill
  // again sends it. A pill is a starting point, not a commitment.
  function tapPill(pill: Pill) {
    if (selectedPill === pill.text) { submit(pill.text); return; }
    setText(pill.text);
    setSelectedPill(pill.text);
    const el = inputRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => el.setSelectionRange(pill.text.length, pill.text.length));
    }
  }

  return (
    <div className="cq">
      {editing ? (
        <div className="cq-rename">
          <input
            className="cq-input"
            value={draft}
            maxLength={60}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setDraft(calendarName); setEditing(false); } }}
          />
          <button className="btn ghost sm" disabled={saving} onClick={saveName}>{COPY.ready.renameSave}</button>
          <button className="btn text" disabled={saving} onClick={() => { setDraft(calendarName); setEditing(false); }}>
            {COPY.ready.renameCancel}
          </button>
        </div>
      ) : (
        <div className="cq-h">
          {COPY.ready.title(calendarName)}{" "}
          <button type="button" className="linkbtn" onClick={() => setEditing(true)}>{COPY.ready.rename}</button>
        </div>
      )}
      <p className="cq-p">{assurance ? COPY.ready.assurance : COPY.ready.selfServe}</p>

      <div className="cq-bar">
        <input
          ref={inputRef}
          className="cq-prompt"
          value={text}
          placeholder={COPY.ready.placeholder}
          onChange={(e) => { setText(e.target.value); setSelectedPill(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        />
        <button className="btn primary" disabled={!text.trim()} onClick={() => submit()}>
          {COPY.ready.go}
        </button>
      </div>

      {(pillsLoading || pills.length > 0) && (
        <>
          <div className="cq-hint">{COPY.ready.hint}</div>
          <div className="cq-pills">
            {pillsLoading
              ? [0, 1, 2, 3].map((i) => <span className="cq-pill skel" key={i} aria-hidden />)
              : pills.map((p) => (
                <button
                  type="button"
                  key={p.text}
                  className={`cq-pill ${selectedPill === p.text ? "on" : ""}`}
                  title={p.reason ? `${p.text} — ${p.reason}` : p.text}
                  aria-label={p.text}
                  onClick={() => tapPill(p)}
                >
                  {p.label}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// The plan exists; the room is what still needs people. The calendar link is
// the primary action for a reason — a follower sees every plan after this one,
// where a plan link earns exactly one RSVP. The plan link stays available,
// demoted to a text button.
function DonePopup({ plan }: { plan: QualifierCreatedPlan }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState<"calendar" | "plan" | null>(null);
  if (!open) return null;

  const calendarUrl = plan.calendarShareId ? `${SITE_URL}/org/${plan.calendarShareId}` : null;
  const calendarLabel = plan.calendarShareId ? `${SITE_HOST}/org/${plan.calendarShareId}` : null;

  async function copy(url: string, which: "calendar" | "plan") {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard blocked — the address is printed above */ }
  }

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={() => setOpen(false)} aria-label={COPY.done.close}>×</button>
        <div className="modal-body">
          <h2 className="modal-title">{COPY.done.title(plan.title)}</h2>
          <p className="modal-blurb">{COPY.done.lead}</p>
          {calendarLabel && <div className="cq-url">{calendarLabel}</div>}
          <div className="cq-done-acts">
            {calendarUrl && (
              <button className="btn primary" onClick={() => copy(calendarUrl, "calendar")}>
                {copied === "calendar" ? COPY.done.shared : COPY.done.share}
              </button>
            )}
            {plan.calendarShareId && (
              <Link className="btn ghost" href={`/org/${plan.calendarShareId}`}>{COPY.done.viewCalendar}</Link>
            )}
            <Link className="btn ghost" href="/dashboard">{COPY.done.manage}</Link>
          </div>
          {plan.inviteUrl && (
            <button
              type="button"
              className="linkbtn cq-planlink"
              onClick={() => copy(plan.inviteUrl as string, "plan")}
            >
              {copied === "plan" ? COPY.done.planLinkCopied : COPY.done.planLink}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
