"use client";

/**
 * Crew Pulse: the crew's last 90 days as a fitness-tracker summary. Three
 * rings (show up, keep it going, share the load), a score out of 100 from
 * the second night on, the numbers people like to brag about, praise-only
 * shout-outs, and one nudge for the group. Share makes a 1080×1350 card
 * (./[token]/pulse) for Instagram or the group chat.
 */

import { useState } from "react";
import { Lightbulb, Share } from "lucide-react";
import type { CrewPulse } from "@/lib/crew";
import { pulseRingRows, ringGeometry, trendLine, PULSE_COLORS } from "@/lib/crew-pulse";
import { Card, Eyebrow, Mono } from "@/components/crew/CrewShell";
import { track } from "@/lib/track";

function Rings({ pulse, size }: { pulse: CrewPulse; size: number }) {
  const rows = pulseRingRows(pulse);
  const stroke = size >= 180 ? 18 : 14;
  const geo = ringGeometry(size, stroke, 4, rows.length);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        {rows.map((row, i) => (
          <g key={row.key}>
            <circle cx={size / 2} cy={size / 2} r={geo[i].r} fill="none" stroke={row.color} strokeOpacity={0.16} strokeWidth={stroke} />
            {row.value > 0 && (
              <circle
                cx={size / 2} cy={size / 2} r={geo[i].r} fill="none" stroke={row.color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={`${geo[i].c * Math.min(row.value, 1)} ${geo[i].c}`}
              />
            )}
          </g>
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {pulse.score != null ? (
          <>
            <span className="font-fm-serif text-[44px] leading-none lg:text-[56px]">{pulse.score}</span>
            <Mono className="mt-1 text-fm-accent">of 100</Mono>
          </>
        ) : (
          <>
            <span className="font-fm-serif text-[36px] leading-none">{pulse.stats.nights}</span>
            <span className="mt-1 text-[11px] text-fm-muted">{pulse.stats.nights === 1 ? "night so far" : "nights so far"}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function CrewPulseCard({ pulse, crewName, shareToken }: { pulse: CrewPulse; crewName: string; shareToken: string | null }) {
  const [sharing, setSharing] = useState(false);
  const rows = pulseRingRows(pulse);
  const scored = pulse.score != null;
  const trend = trendLine(pulse.trend);
  const stats = [
    { n: pulse.stats.nights, label: pulse.stats.nights === 1 ? "night together" : "nights together" },
    { n: pulse.stats.places, label: pulse.stats.places === 1 ? "place tried" : "places tried" },
    { n: pulse.stats.streak, label: "in a row" },
    { n: pulse.stats.mostAtOnce, label: "most at once" },
  ];

  const share = async () => {
    if (!shareToken) return;
    setSharing(true);
    track("crew_pulse_share", { score: pulse.score });
    const url = `/crew/${encodeURIComponent(shareToken)}/pulse`;
    try {
      const blob = await fetch(url).then((r) => (r.ok ? r.blob() : Promise.reject(new Error("image"))));
      const file = new File([blob], `${crewName.replace(/[^\w-]+/g, "-").toLowerCase() || "crew"}-pulse.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${crewName} on Leaf` });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch (e) {
      // Cancelling the share sheet lands here too; only open the image when it really failed.
      if (!(e instanceof DOMException && e.name === "AbortError")) window.open(url, "_blank");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Eyebrow>Crew Pulse · last {pulse.windowDays} days</Eyebrow>
          <h2 className="m-0 font-fm-serif text-[30px] font-normal leading-tight lg:text-[36px]">
            {pulse.bandLabel}
            {scored && trend && <span className="hidden italic text-fm-muted lg:inline"> · {trend.toLowerCase()}</span>}
          </h2>
        </div>
        {scored && shareToken && (
          <button
            type="button"
            onClick={share}
            disabled={sharing}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-fm-line px-4 text-[13px] font-semibold text-fm-ink transition hover:bg-fm-card disabled:opacity-60"
          >
            <Share size={15} aria-hidden /> {sharing ? "Making it…" : "Share"}
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 lg:gap-7">
        <div className="lg:hidden"><Rings pulse={pulse} size={140} /></div>
        <div className="hidden lg:block"><Rings pulse={pulse} size={200} /></div>
        {scored ? (
          <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-3 p-0 lg:gap-4">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-2.5">
                <span className="h-2 w-2 shrink-0 rounded-full lg:h-2.5 lg:w-2.5" style={{ background: r.color }} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] text-fm-ink-2 lg:text-sm lg:font-semibold lg:text-fm-ink">{r.label}</span>
                  <span className="hidden text-xs text-fm-muted lg:block">{r.sub}</span>
                </span>
                <span className="ml-auto font-fm-serif text-[22px] lg:text-[26px]" style={{ color: r.color }}>{r.display}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm leading-relaxed text-fm-ink-2">
            Your score shows up after the second night. The rings fill as people come, the crew keeps its rhythm, and more of you pitch in.
          </p>
        )}
      </div>

      {scored && trend && <p className="m-0 text-[13px] text-fm-muted lg:hidden">{trend}.</p>}

      <div className={`grid gap-2 ${scored ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
        {(scored ? stats : stats.slice(0, 2)).map((s) => (
          <div key={s.label} className="flex flex-col gap-0.5 rounded-2xl bg-fm-card px-3.5 py-3">
            <span className="font-fm-serif text-[30px] leading-none lg:text-[34px]">{s.n}</span>
            <span className="text-xs text-fm-ink-2">{s.label}</span>
          </div>
        ))}
      </div>

      {pulse.shoutOuts.length > 0 && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Shout-outs</Eyebrow>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {pulse.shoutOuts.map((s, i) => (
              <li key={s.kind} className={`items-center gap-2.5 rounded-full border border-fm-line py-1.5 pl-1.5 pr-3.5 ${i > 1 ? "hidden lg:flex" : "flex"}`}>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold text-fm-canvas"
                  style={{ background: [PULSE_COLORS.showUp, PULSE_COLORS.shareLoad, PULSE_COLORS.keepItGoing][i % 3] }}
                  aria-hidden
                >
                  {s.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="text-[13px] text-fm-ink-2">{s.label}: <b className="font-bold text-fm-ink">{s.name.split(/\s+/)[0]}</b></span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pulse.nudge && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-fm-canvas px-3.5 py-3">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-fm-accent" aria-hidden />
          <span className="text-[13px] leading-relaxed text-fm-ink-2">{pulse.nudge}</span>
        </div>
      )}
    </Card>
  );
}
