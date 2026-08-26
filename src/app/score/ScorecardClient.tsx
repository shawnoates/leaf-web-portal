"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Parse from "@/lib/parse-client";
import {
  BENCHMARK_MEDIANS,
  GROUP_TYPES,
  METRIC_EXPLAINERS,
  METRIC_LABELS,
  SCORECARD_QUESTIONS,
  WEAK_LINK_COPY,
  groupTypeFor,
  isValidSid,
  scoreAnswers,
  scorecardBand,
  type GroupType,
  type ScorecardAnswers,
  type ScorecardResult,
} from "@/lib/scorecard";
import { PILLAR_WEIGHTS } from "@/lib/health-score";
import {
  readDevice,
  readUtm,
  trackScorecard,
} from "@/lib/scorecard-track";
import ScoreCard from "./ScoreCard";

const SETUP_URL = "/organizations/setup";
const STORAGE_KEY = "leaf.scorecard.v1";

type Phase = "hero" | "quiz" | "reveal";

interface Persisted {
  groupType: GroupType | null;
  answers: Partial<ScorecardAnswers>;
  index: number;
  sid: string | null;
  done: boolean;
}

/** sessionStorage, not localStorage: a stray back-swipe mid-quiz must not lose
 *  six answers, but a visitor coming back next week should get a fresh page
 *  rather than a stale score from a community that has moved on since. */
function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePersisted(state: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode, quota — the quiz still works, it just won't survive a
       reload. Never let storage break the funnel. */
  }
}

function clearPersisted() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export default function ScorecardClient() {
  const [phase, setPhase] = useState<Phase>("hero");
  // 0 is the unscored segmentation question; 1–6 are the scored ones.
  const [index, setIndex] = useState(0);
  const [groupType, setGroupType] = useState<GroupType | null>(null);
  const [answers, setAnswers] = useState<Partial<ScorecardAnswers>>({});
  const [result, setResult] = useState<ScorecardResult | null>(null);
  const [sid, setSid] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);

  // Reveal animation state. The card mounts empty and fills over ~1.2s:
  // gauge sweeps, bars stagger in, band lands last.
  const [gaugeValue, setGaugeValue] = useState(0);
  const [barsFilled, setBarsFilled] = useState(false);
  const [bandShown, setBandShown] = useState(false);

  const phaseRef = useRef<Phase>("hero");
  const indexRef = useRef(0);
  phaseRef.current = phase;
  indexRef.current = index;

  // ── Mount: view event, and restore a session if there is one ────────────

  useEffect(() => {
    trackScorecard("scorecard_view", {
      ...readUtm(),
      device: readDevice(),
      variant: "a",
    });

    const saved = loadPersisted();
    if (!saved) return;

    if (saved.done && saved.groupType && isCompleteAnswers(saved.answers)) {
      // Return visit after a reveal. Nobody wants to answer six questions
      // twice — go straight to the result with a retake link.
      setGroupType(saved.groupType);
      setAnswers(saved.answers);
      setResult(scoreAnswers(saved.answers));
      setSid(isValidSid(saved.sid) ? saved.sid : null);
      setPhase("reveal");
      setResumed(true);
      return;
    }

    if (saved.index > 0) {
      // Mid-quiz reload. Restore, but stay on the hero so the visitor chooses
      // to continue rather than being dropped back into a question they may
      // not remember leaving.
      setGroupType(saved.groupType);
      setAnswers(saved.answers);
      setIndex(saved.index);
      setResumed(true);
    }
  }, []);

  // ── Abandonment ─────────────────────────────────────────────────────────
  // pagehide rather than beforeunload: beforeunload does not fire reliably on
  // mobile Safari, which is most of this page's traffic.

  useEffect(() => {
    const onLeave = () => {
      if (phaseRef.current !== "quiz") return;
      trackScorecard("scorecard_abandoned", {
        last_question_index: indexRef.current,
      });
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, []);

  // ── Hero idle gauge ─────────────────────────────────────────────────────
  // Slow loop between 58 and 84 with the bars moving in sympathy. The ad shows
  // a static sample of 78; the page shows a meter that is clearly running,
  // which is what says "this is a live thing, yours goes here".

  const [idle, setIdle] = useState(71);
  useEffect(() => {
    if (phase !== "hero") return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return; // hold at the midpoint
    }
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame += 1;
      // ~13s round trip: slow enough to read as a meter, not a slot machine.
      const t = (Math.sin(frame / 130) + 1) / 2;
      setIdle(Math.round(58 + t * 26));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // ── Quiz ────────────────────────────────────────────────────────────────

  const startQuiz = useCallback(() => {
    trackScorecard("scorecard_start", { resumed });
    setPhase("quiz");
  }, [resumed]);

  const finish = useCallback(
    async (finalAnswers: ScorecardAnswers, finalGroupType: GroupType) => {
      const computed = scoreAnswers(finalAnswers);
      setResult(computed);
      setPhase("reveal");

      savePersisted({
        groupType: finalGroupType,
        answers: finalAnswers,
        index: SCORECARD_QUESTIONS.length + 1,
        sid: null,
        done: true,
      });

      trackScorecard("scorecard_revealed", {
        score: computed.score,
        band: computed.band,
        weak_metric: computed.weakMetric,
        group_type: finalGroupType,
      });

      // Persist server-side so the CTA can carry an opaque sid, the reveal is
      // shareable, and the estimate survives to be quoted back after the
      // calendar exists. Deliberately not awaited by the UI: the reveal has
      // already animated, and a slow round trip must not hold it.
      try {
        const session = await Parse.Cloud.run("createScorecardSession", {
          answers: finalAnswers,
          groupType: finalGroupType,
          utm: readUtm(),
          variant: "a",
        });
        if (session?.sid) {
          setSid(session.sid);
          savePersisted({
            groupType: finalGroupType,
            answers: finalAnswers,
            index: SCORECARD_QUESTIONS.length + 1,
            sid: session.sid,
            done: true,
          });
        }
      } catch (err) {
        // The CTA falls back to /organizations/setup?src=scorecard with no
        // sid. Setup works fine without one — losing attribution is bad,
        // blocking the conversion would be worse.
        console.error("[scorecard] session create failed", err);
      }
    },
    [],
  );

  const pick = useCallback(
    (optionIndex: number) => {
      if (index === 0) {
        const picked = GROUP_TYPES[optionIndex];
        setGroupType(picked.value);
        setIndex(1);
        savePersisted({
          groupType: picked.value,
          answers,
          index: 1,
          sid: null,
          done: false,
        });
        return;
      }

      const question = SCORECARD_QUESTIONS[index - 1];
      const value = question.options[optionIndex].value;
      const next = { ...answers, [question.metric]: value };
      setAnswers(next);

      trackScorecard("scorecard_question_answered", {
        question_index: index,
        metric: question.metric,
        value,
      });

      if (index >= SCORECARD_QUESTIONS.length) {
        if (isCompleteAnswers(next) && groupType) {
          void finish(next, groupType);
        }
        return;
      }

      setIndex(index + 1);
      savePersisted({
        groupType,
        answers: next,
        index: index + 1,
        sid: null,
        done: false,
      });
    },
    [index, answers, groupType, finish],
  );

  const goBack = useCallback(() => {
    if (index === 0) {
      setPhase("hero");
      return;
    }
    setIndex(index - 1);
  }, [index]);

  // ── Reveal animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== "reveal" || !result) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setGaugeValue(result.score);
      setBarsFilled(true);
      setBandShown(true);
      return;
    }

    // Gauge sweeps 0 → score over 800ms on an ease-out curve, so it decelerates
    // into the number rather than snapping.
    const DURATION = 800;
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setGaugeValue(Math.round(result.score * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const barsTimer = window.setTimeout(() => setBarsFilled(true), 240);
    const bandTimer = window.setTimeout(() => setBandShown(true), 1000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(barsTimer);
      window.clearTimeout(bandTimer);
    };
  }, [phase, result]);

  // Resumed sessions skip the animation — it is a reward for finishing the
  // quiz, not something to replay on every reload.
  useEffect(() => {
    if (phase === "reveal" && resumed && result) {
      setGaugeValue(result.score);
      setBarsFilled(true);
      setBandShown(true);
    }
  }, [phase, resumed, result]);

  const retake = useCallback(() => {
    clearPersisted();
    setAnswers({});
    setGroupType(null);
    setResult(null);
    setSid(null);
    setIndex(0);
    setResumed(false);
    setGaugeValue(0);
    setBarsFilled(false);
    setBandShown(false);
    setPhase("quiz");
    trackScorecard("scorecard_start", { retake: true });
  }, []);

  const onCtaClick = useCallback(() => {
    if (!result) return;
    trackScorecard("scorecard_cta_click", {
      score: result.score,
      weak_metric: result.weakMetric,
      sid,
    });
  }, [result, sid]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (phase === "hero") {
    return (
      <main>
        <section className="hero wrap">
          <span className="eyebrow">
            <span className="dot" aria-hidden="true" />
            Updating live
          </span>

          <h1>Your community has a score.</h1>
          <p className="sub">
            Participation. Retention. Who actually shows up. Six answers, and
            you&rsquo;ll see where yours stands.
          </p>

          <IdleCard value={idle} />

          <div className="hero-cta">
            <button type="button" className="btn" onClick={startQuiz}>
              {resumed ? "Pick up where you left off" : "Get your score"}
            </button>
            <p className="fineprint">
              Takes about 30 seconds. No account needed.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (phase === "quiz") {
    const isSegmentation = index === 0;
    const question = isSegmentation ? null : SCORECARD_QUESTIONS[index - 1];
    const scoredIdx = index - 1;

    return (
      <main>
        <section className="quiz wrap">
          <div className="quiz-bar">
            <button
              type="button"
              className="quiz-back"
              onClick={goBack}
              aria-label={isSegmentation ? "Back to the top" : "Previous question"}
            >
              ←
            </button>
            <div
              className="segments"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={SCORECARD_QUESTIONS.length}
              aria-valuenow={Math.max(0, scoredIdx + 1)}
              aria-label={`Question ${Math.max(1, index)} of ${
                SCORECARD_QUESTIONS.length + 1
              }`}
            >
              {SCORECARD_QUESTIONS.map((q, i) => (
                <span key={q.metric} data-done={i <= scoredIdx} />
              ))}
            </div>
          </div>

          <div className="quiz-body quiz-anim" key={index}>
            <h1 className="quiz-q">
              {isSegmentation
                ? "What kind of community do you run?"
                : question!.question}
            </h1>

            <div className="quiz-opts">
              {(isSegmentation
                ? GROUP_TYPES.map((g) => g.label)
                : question!.options.map((o) => o.label)
              ).map((label, i) => {
                const picked = isSegmentation
                  ? groupType === GROUP_TYPES[i].value
                  : answers[question!.metric] === question!.options[i].value;
                return (
                  <button
                    type="button"
                    className="opt"
                    key={label}
                    data-picked={picked}
                    onClick={() => pick(i)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ── Reveal ──────────────────────────────────────────────────────────────

  if (!result || !groupType) return null;

  const group = groupTypeFor(groupType);
  const weak = WEAK_LINK_COPY[result.weakMetric];
  const benchmark = BENCHMARK_MEDIANS[groupType];
  const setupHref = sid
    ? `${SETUP_URL}?src=scorecard&sid=${encodeURIComponent(sid)}`
    : `${SETUP_URL}?src=scorecard`;

  return (
    <main>
      <section className="reveal wrap">
        <div className="reveal-in">
          <ScoreCard
            score={gaugeValue}
            band={scorecardBand(bandShown ? result.score : gaugeValue)}
            pillarScores={result.pillarScores}
            weakMetric={result.weakMetric}
            benchmark={benchmark}
            groupNoun={group.noun}
            filled={barsFilled}
          />
        </div>

        {/* The emotional hinge: name the lowest pillar in one line, then let
            the CTA answer exactly that line. */}
        <div className="callout" style={{ opacity: bandShown ? 1 : 0 }}>
          <p>
            <span className="callout-label">Your weak link</span>
            {weak.callout}
          </p>
        </div>

        <div className="cta-block">
          <h2>
            The fastest way to move this number is one plan on the calendar.
          </h2>
          <p>{weak.cta}</p>
          <a
            href={setupHref}
            className="btn"
            data-cta="score_create_first_plan"
            onClick={onCtaClick}
          >
            Create your first plan
          </a>
          <p className="fineprint">Pick a day. Pick your people.</p>
          <p style={{ textAlign: "center", margin: 0 }}>
            <button type="button" className="retake" onClick={retake}>
              Retake the quiz
            </button>
          </p>
        </div>

        <MethodAccordion />
        <BenchmarkStrip yours={groupType} />
      </section>
    </main>
  );
}

/** Hero card. Same component as the reveal's, driven by the idle loop instead
 *  of a real score, so the two are guaranteed to look identical — the whole
 *  point of the hero is that it is the thing the visitor tapped. */
function IdleCard({ value }: { value: number }) {
  const answers = SCORECARD_QUESTIONS.reduce((acc, q) => {
    // Move the bars in sympathy with the gauge rather than independently, so
    // the card reads as one instrument.
    acc[q.metric] = Math.max(20, Math.min(100, value + ((q.metric.length * 7) % 17) - 8));
    return acc;
  }, {} as Record<string, number>);

  return (
    <ScoreCard
      score={value}
      band={scorecardBand(value)}
      pillarScores={answers as never}
      weakMetric={null}
      benchmark={value}
      groupNoun="community"
    />
  );
}

function MethodAccordion() {
  return (
    <section className="method">
      <h2>How the score works</h2>
      {SCORECARD_QUESTIONS.map((q) => (
        <details key={q.metric}>
          <summary>
            <span>{METRIC_LABELS[q.metric]}</span>
            <span className="weight">
              {Math.round(PILLAR_WEIGHTS[q.metric] * 100)}%
            </span>
          </summary>
          <p>{METRIC_EXPLAINERS[q.metric]}</p>
        </details>
      ))}
    </section>
  );
}

function BenchmarkStrip({ yours }: { yours: GroupType }) {
  return (
    <section className="bench">
      <h2>Typical scores</h2>
      <ul>
        {GROUP_TYPES.map((g) => (
          <li key={g.value} data-you={g.value === yours}>
            <span className="n">{BENCHMARK_MEDIANS[g.value]}</span>
            <span className="t">{g.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function isCompleteAnswers(
  value: Partial<ScorecardAnswers>,
): value is ScorecardAnswers {
  return SCORECARD_QUESTIONS.every((q) => typeof value[q.metric] === "number");
}
