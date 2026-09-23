"use client";

/**
 * "Friend Mode" — the settings row, owners only. Follows the design spec's
 * row states exactly (dark #253A33 surface, lime subline when on, dimmed
 * row + padlock when locked):
 *
 *   enabled   surface brand, title ink, subline lime
 *   disabled  surface brand, title ink, subline muted-text
 *   locked    surface surface-dim, border line-dim, title muted-text,
 *             subline muted, control at 45% with a padlock, no tap.
 *             The subline says why: "Not available · Friend Mode is for
 *             circles under [LIMIT] followers".
 *
 * Turning it on sends every member a consent invite; Leaf starts planning
 * once enough say IN.
 */

import { useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { FM, FriendModeIcon, FriendModeSwitch } from "@/components/crew/FriendModeGlyphs";

const MAX_MEMBERS = 15;

export default function FriendModeCard({
  calendarId,
  enabled: initialEnabled,
  memberCount,
}: {
  calendarId: string;
  enabled: boolean;
  memberCount: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const locked = memberCount > MAX_MEMBERS;
  const state = locked ? "locked" : enabled ? "enabled" : "disabled";

  const toggle = async (v: boolean) => {
    setSaving(true);
    setError("");
    setNote("");
    // Optimistic: the trail animates now; a failure flips it back.
    setEnabled(v);
    try {
      const r = (await Parse.Cloud.run("setFriendModeOnCalendar", { calendarId, enabled: v })) as { enabled: boolean; invited?: number };
      setEnabled(r.enabled);
      if (r.enabled) setNote(`${r.invited ?? 0} ${r.invited === 1 ? "member was" : "members were"} asked to join. Leaf plans the first night once enough say IN.`);
    } catch (err) {
      setEnabled(!v);
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  };

  const subline = locked
    ? `Not available · Friend Mode is for circles under ${MAX_MEMBERS} followers`
    : enabled
      ? "On · Leaf plans nights for this group"
      : "Leaf picks a place, asks everyone which dates work, and locks the night";

  return (
    <section
      className="rounded-xl p-5"
      style={{
        background: locked ? FM.surfaceDim : FM.brand,
        border: `1px solid ${locked ? FM.lineDim : FM.line}`,
      }}
    >
      <div className="flex items-center gap-4">
        <FriendModeIcon state={state} size={40} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium" style={{ color: locked ? FM.mutedText : FM.ink }}>Friend Mode</p>
          <p className="mt-0.5 text-[13px]" style={{ color: locked ? FM.muted : enabled ? FM.accent : FM.mutedText }}>{subline}</p>
        </div>
        <FriendModeSwitch label="Friend Mode" checked={enabled} locked={locked} disabled={saving} onChange={toggle} />
      </div>
      {(note || error || enabled || locked) && (
        <div className="mt-3 text-[13px]" style={{ color: FM.mutedText }}>
          {note && <p style={{ color: FM.ink }}>{note}</p>}
          {error && <p style={{ color: "#F2A39A" }}>{error}</p>}
          {enabled && !locked && (
            <Link href={`/crew/${calendarId}`} className="underline" style={{ color: FM.ink }}>Open the crew page</Link>
          )}
          {locked && (
            <p>
              Start a crew with the people you keep seeing instead:{" "}
              <Link href="/crew/start?suggest=1" className="underline" style={{ color: FM.ink }}>Start a crew</Link>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
