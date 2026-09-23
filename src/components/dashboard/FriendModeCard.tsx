"use client";

/**
 * "Turn on Friend Mode" — dashboard Settings, owners only.
 *
 * For a small calendar (15 members or fewer) it's a switch: on sends every
 * member a consent invite, and Leaf starts planning nights for the group.
 * For a bigger calendar the mode isn't offered; the card points at starting
 * a crew from people you've met instead.
 */

import { useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import SettingsSwitch from "@/components/SettingsSwitch";

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
  const small = memberCount <= MAX_MEMBERS;

  const toggle = async (v: boolean) => {
    setSaving(true);
    setError("");
    setNote("");
    try {
      const r = (await Parse.Cloud.run("setFriendModeOnCalendar", { calendarId, enabled: v })) as { enabled: boolean; invited?: number };
      setEnabled(r.enabled);
      if (r.enabled) setNote(`On. ${r.invited ?? 0} ${r.invited === 1 ? "member was" : "members were"} asked to join. Leaf plans the first night once enough say IN.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border border-zinc-200 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 mb-1">🍃 Friend Mode</h2>
          <p className="text-sm text-zinc-900">Let Leaf plan nights for this group</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {small
              ? "Every few weeks Leaf picks a place, asks everyone which dates work, and locks the night. Members get one text asking to join first."
              : `Friend Mode is for groups of ${MAX_MEMBERS} or fewer. This calendar has ${memberCount}. Start a crew with the people you keep seeing instead.`}
          </p>
          {note && <p className="text-xs text-emerald-700 mt-2">{note}</p>}
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          {enabled && (
            <Link href={`/crew/${calendarId}`} className="mt-2 inline-block text-xs text-zinc-700 underline">
              Open the crew page
            </Link>
          )}
        </div>
        {small ? (
          <SettingsSwitch label="Friend Mode" checked={enabled} disabled={saving} onChange={toggle} />
        ) : (
          <Link href="/crew/start?suggest=1" className="shrink-0 rounded-full border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 hover:bg-zinc-50">
            Start a crew
          </Link>
        )}
      </div>
    </section>
  );
}
