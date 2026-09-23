"use client";

import type React from "react";

/**
 * Friend Mode glyphs, from "Friend Mode — Design Spec" (Sep 23, 2026).
 *
 * The switch's knob is a trail of three people. Lime (#C8F25A) means "on"
 * and is used nowhere else. Two forms from one idea:
 *
 *   FriendModeIcon   (B6) the switch outlined on a rounded #253A33 tile —
 *                    anywhere a square icon is expected. Safe on light
 *                    backgrounds; the tile carries its own contrast.
 *   FriendModeMark   (B7) the switch alone, lime fill with dark knobs — UI
 *                    chrome, badges and the actual control. Dark surfaces
 *                    only (it disappears on lime or light).
 *   FriendModeSwitch the live 88×44 control: the trail slides left→right
 *                    over 200 ms ease-out and the lead knob turns lime at
 *                    the end of travel.
 *
 * Everything is drawn on the spec's 200-unit grid and scales linearly.
 */

export const FM = {
  brand: "#253A33",
  canvas: "#101A16",
  surfaceDim: "#1B2B25",
  line: "#3B5449",
  lineDim: "#2E4038",
  ink: "#F2F1EC",
  accent: "#C8F25A",
  muted: "#6F7D75",
  mutedText: "#8A928C",
  padlock: "#9BA39D",
} as const;

export type FriendModeState = "enabled" | "disabled" | "locked";

function IconPadlock() {
  return (
    <>
      <circle cx="152" cy="148" r="26" fill={FM.canvas} stroke={FM.line} strokeWidth="2" />
      <path d="M143 146 V140 A9 9 0 0 1 161 140 V146" fill="none" stroke={FM.padlock} strokeWidth="4" strokeLinecap="round" />
      <rect x="140" y="146" width="24" height="17" rx="3" fill={FM.padlock} />
    </>
  );
}

/** B6. `size` in px (min 24). Below 32 px the padlock is dropped, as specified. */
export function FriendModeIcon({ state = "enabled", size = 40, className = "", title }: { state?: FriendModeState; size?: number; className?: string; title?: string }) {
  const small = size <= 40;
  const on = state === "enabled";
  const knob = on ? FM.ink : FM.muted;
  const lead = on ? FM.accent : FM.muted;
  const track = on ? FM.ink : FM.muted;
  // 40 px ladder: thicker strokes and bigger knobs so it still reads.
  const stroke = small ? 10 : 6;
  const ring = small ? 8 : 6;
  const r = small ? 22 : 20;
  const cx = on ? [142, 122, 102] : [58, 78, 98];
  const trail = (
    <>
      <rect x="31" y="73" width="138" height="58" rx="29" fill="none" stroke={track} strokeWidth={stroke} />
      <circle cx={cx[0]} cy="102" r={r} fill={lead} />
      <circle cx={cx[1]} cy="102" r={r} fill={knob} stroke={FM.brand} strokeWidth={ring} />
      <circle cx={cx[2]} cy="102" r={r} fill={knob} stroke={FM.brand} strokeWidth={ring} />
    </>
  );
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect x="0.5" y="0.5" width="199" height="199" rx="46" fill={FM.brand} stroke={FM.line} />
      {state === "locked" ? <g opacity="0.45">{trail}</g> : trail}
      {state === "locked" && size >= 32 && <IconPadlock />}
    </svg>
  );
}

/** B7. `width` in px (min 36); holds three knobs down to 44 px, two below. */
export function FriendModeMark({ state = "enabled", width = 44, className = "" }: { state?: FriendModeState; width?: number; className?: string }) {
  const on = state === "enabled";
  const twoKnobs = width < 44;
  const knobs = on
    ? [{ cx: 154, fill: FM.brand }, { cx: 126, fill: FM.brand, ring: FM.accent }, { cx: 98, fill: FM.brand, ring: FM.accent }]
    : [{ cx: 46, fill: FM.muted }, { cx: 74, fill: FM.muted, ring: FM.surfaceDim }, { cx: 102, fill: FM.muted, ring: FM.surfaceDim }];
  const body = (
    <>
      {on ? (
        <rect x="0" y="2" width="200" height="96" rx="48" fill={FM.accent} />
      ) : (
        <rect x="1" y="3" width="198" height="94" rx="47" fill={FM.surfaceDim} stroke={FM.line} strokeWidth="2" />
      )}
      {knobs.slice(0, twoKnobs ? 2 : 3).map((k, i) => (
        <circle key={i} cx={k.cx} cy="50" r="30" fill={k.fill} stroke={k.ring} strokeWidth={k.ring ? 8 : 0} />
      ))}
    </>
  );
  return (
    <svg viewBox="0 0 200 100" width={width} height={width / 2} className={className} aria-hidden>
      {state === "locked" ? <g opacity="0.45">{body}</g> : body}
      {state === "locked" && (
        <>
          <circle cx="170" cy="74" r="22" fill={FM.canvas} stroke={FM.line} strokeWidth="2" />
          <path d="M163 72 V67 A7 7 0 0 1 177 67 V72" fill="none" stroke={FM.padlock} strokeWidth="3" strokeLinecap="round" />
          <rect x="160" y="72" width="20" height="14" rx="3" fill={FM.padlock} />
        </>
      )}
    </svg>
  );
}

/**
 * The settings-row control: an 88×44 mark that animates. Locked renders the
 * locked mark and is not interactive (cursor: not-allowed).
 */
export function FriendModeSwitch({
  checked,
  locked = false,
  disabled = false,
  onChange,
  label,
}: {
  checked: boolean;
  locked?: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  if (locked) {
    return (
      <span aria-label={label} role="switch" aria-checked={false} aria-disabled title="Not available" style={{ cursor: "not-allowed", display: "inline-flex" }}>
        <FriendModeMark state="locked" width={88} />
      </span>
    );
  }
  // Knob centres travel 108 units (46 → 154 for the lead), i.e. 54% of width.
  const t = "cx 200ms ease-out, fill 200ms ease-out, stroke 200ms ease-out";
  const ring = checked ? FM.accent : FM.surfaceDim;
  const knobFill = checked ? FM.brand : FM.muted;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{ background: "none", border: 0, padding: 0, cursor: disabled ? "default" : "pointer", display: "inline-flex", opacity: disabled ? 0.7 : 1 }}
    >
      {/* Knob centres are animated as CSS `cx` (a geometry property in
          current browsers), so the 108-unit travel stays in grid units. */}
      <svg viewBox="0 0 200 100" width={88} height={44} aria-hidden style={{ display: "block" }}>
        <rect x="1" y="3" width="198" height="94" rx="47" fill={checked ? FM.accent : FM.surfaceDim} stroke={checked ? FM.accent : FM.line} strokeWidth="2" style={{ transition: t }} />
        {/* The trail mirrors as it travels: off is lead 46 · 74 · 102, on is
            98 · 126 · lead 154, so each knob has its own pair of centres.
            Trailing knobs first so the lead knob paints on top. */}
        {[{ off: 102, on: 98 }, { off: 74, on: 126 }, { off: 46, on: 154 }].map((k, i) => (
          <circle
            key={k.off}
            cy="50"
            r="30"
            fill={knobFill}
            stroke={i < 2 ? ring : "none"}
            strokeWidth={i < 2 ? 8 : 0}
            style={{ cx: `${checked ? k.on : k.off}px`, transition: t } as React.CSSProperties}
          />
        ))}
      </svg>
    </button>
  );
}
