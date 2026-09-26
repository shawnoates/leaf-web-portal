"use client";

/**
 * "Friend Mode" on a calendar's page, owners only. Dark spec surface, one
 * switch on the right, lime subline when on, dimmed when the calendar is
 * over the member limit.
 *
 * Turning it on is quiet: nobody is contacted. The owner then invites
 * members explicitly — the card lists who would get a push (active app
 * users) and who a text, and nothing goes out until they confirm.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { FM, FriendModeSwitch } from "@/components/crew/FriendModeGlyphs";
import { RHYTHM_LABELS } from "@/lib/crew";
import FriendModeSetup from "./FriendModeSetup";
import FriendModeIntro, { friendModeIntroDue, stampFriendModeIntro } from "@/components/crew/FriendModeIntro";

const MAX_MEMBERS = 15;

type Person = { userId: string; name: string; channel: "push" | "sms" | "none"; canInvite: boolean; reason: string | null };
type Preview = { people: Person[]; invited: number; joined: number; ownerSmsOptIn?: boolean; ownerPhoneLast4?: string | null; inviteLink?: string; rhythmDays?: number; oneTime?: boolean;
  lastOneTime?: { happened: boolean; venue: string | null; chosenOption: { date: string; time?: string | null } | null } | null };

export default function FriendModeCard({
  calendarId,
  calendarName = "",
  enabled: initialEnabled,
  memberCount,
}: {
  calendarId: string;
  calendarName?: string;
  enabled: boolean;
  memberCount: number;
}) {
  // Turning on goes through the setup pop-up; it's only on once that's done.
  const [settingUp, setSettingUp] = useState(false);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const locked = memberCount > MAX_MEMBERS;
  // The once-a-month intro, for owners who haven't turned Friend Mode on.
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    if (initialEnabled || locked || !friendModeIntroDue()) return;
    stampFriendModeIntro();
    setIntro(true);
  }, [initialEnabled, locked]);

  const loadPreview = useCallback(async () => {
    try {
      setPreview((await Parse.Cloud.run("previewCalendarInvites", { calendarId })) as Preview);
    } catch {
      setPreview(null);
    }
  }, [calendarId]);

  useEffect(() => {
    // Also when off: a finished "Just once" night offers "Do it again?".
    if (!locked) void loadPreview();
  }, [enabled, locked, loadPreview]);

  const toggle = async (v: boolean) => {
    if (v) { setError(""); setSettingUp(true); return; }
    setSaving(true);
    setError("");
    setNote("");
    setConfirming(false);
    setEnabled(v); // optimistic; a failure flips it back
    try {
      const r = (await Parse.Cloud.run("setFriendModeOnCalendar", { calendarId, enabled: v })) as { enabled: boolean };
      setEnabled(r.enabled);
      if (!r.enabled) setPreview(null);
    } catch (err) {
      setEnabled(!v);
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  };

  const invite = async () => {
    setSaving(true);
    setError("");
    try {
      const r = (await Parse.Cloud.run("inviteCalendarMembers", { calendarId })) as { invited: number };
      setNote(`${r.invited} ${r.invited === 1 ? "person was" : "people were"} invited. Leaf plans the first night once enough join.`);
      setConfirming(false);
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send invites.");
    } finally {
      setSaving(false);
    }
  };

  // After a "Just once" night: another single night, or monthly from now on.
  const again = async (oneTime: boolean) => {
    setSaving(true);
    setError("");
    try {
      await Parse.Cloud.run("runCrewAgain", { calendarId, oneTime, ...(oneTime ? {} : { rhythmDays: 28 }) });
      setEnabled(true);
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start it again.");
    } finally {
      setSaving(false);
    }
  };

  const invitable = preview?.people.filter((p) => p.canInvite) ?? [];
  const pushes = invitable.filter((p) => p.channel === "push");
  const texts = invitable.filter((p) => p.channel === "sms");

  // On: one line of status. Everything else (rhythm, texts, invite link)
  // lives on the crew page, so the card stays a switch and a door.
  const rhythmText = preview ? (preview.oneTime ? "just once" : RHYTHM_LABELS[preview.rhythmDays || 28]?.toLowerCase()) : null;
  const status = preview
    ? [
        rhythmText,
        `${preview.joined + 1} in`,
        preview.invited ? `${preview.invited} invited` : null,
        invitable.length ? `${invitable.length} not invited yet` : null,
      ].filter(Boolean).join(" · ")
    : "";
  const subline = locked
    ? `Not available · Friend Mode is for circles under ${MAX_MEMBERS} followers`
    : enabled
      ? `On${status ? ` · ${status}` : ""}`
      : "Off · recurring plans with your crew, on your schedule";

  return (
    <section
      className="rounded-xl px-4 py-2.5"
      style={{ background: locked ? FM.surfaceDim : FM.brand, border: `1px solid ${locked ? FM.lineDim : FM.line}` }}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2.5 text-[14px] font-medium" style={{ color: locked ? FM.mutedText : FM.ink }}>
            Friend Mode
            {enabled && !locked && (
              <Link
                href={`/crew/${calendarId}`}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-4 no-underline"
                style={{ border: `1px solid ${FM.line}`, color: FM.ink }}
              >
                View
              </Link>
            )}
            {!enabled && (
              <Link href="/help/calendars-and-rsvps/friend-mode" target="_blank" className="ml-2 text-[12px] font-normal italic underline" style={{ color: FM.mutedText }}>
                What is this?
              </Link>
            )}
          </p>
          <p className="text-[12px]" style={{ color: locked ? FM.muted : enabled ? FM.accent : FM.mutedText }}>{subline}</p>
        </div>
        {/* The switch's state in words, so it reads without knowing which side is on. */}
        {!locked && (
          <span aria-hidden className="text-[12px] font-medium uppercase tracking-wide" style={{ color: enabled ? FM.accent : FM.mutedText }}>
            {enabled ? "On" : "Off"}
          </span>
        )}
        <FriendModeSwitch label="Friend Mode" checked={enabled} locked={locked} disabled={saving} onChange={toggle} />
      </div>

      {(locked || error || note || (enabled && (invitable.length > 0 || confirming))) && (
        <div className="mt-1.5 space-y-2 pb-1 text-[12px]" style={{ color: FM.mutedText }}>
          {error && <p style={{ color: "#F2A39A" }}>{error}</p>}
          {note && <p style={{ color: FM.ink }}>{note}</p>}

          {enabled && !locked && invitable.length > 0 && !confirming && (
            <button onClick={() => setConfirming(true)} className="underline" style={{ color: FM.ink }}>
              Invite {invitable.length} new {invitable.length === 1 ? "follower" : "followers"}
            </button>
          )}

          {enabled && confirming && (
            <div className="rounded-lg p-3" style={{ background: FM.canvas, border: `1px solid ${FM.line}` }}>
              <p className="mb-1.5" style={{ color: FM.ink }}>Leaf will ask these people to join. Nobody is added until they say yes.</p>
              {pushes.length > 0 && <p><span style={{ color: FM.ink }}>Push in the app:</span> {pushes.map((p) => p.name).join(", ")}</p>}
              {texts.length > 0 && <p><span style={{ color: FM.ink }}>Text message:</span> {texts.map((p) => p.name).join(", ")}</p>}
              {texts.length > 0 && <p className="mt-1">Texts go out between 9am and 9pm; outside that they wait until morning.</p>}
              <div className="mt-2 flex gap-3">
                <button onClick={invite} disabled={saving} className="rounded-full px-3 py-1 font-medium disabled:opacity-60" style={{ background: FM.accent, color: FM.canvas }}>
                  {saving ? "Sending…" : `Invite ${invitable.length}`}
                </button>
                <button onClick={() => setConfirming(false)} className="underline" style={{ color: FM.ink }}>Cancel</button>
              </div>
            </div>
          )}

          {locked && (
            <p>Friend Mode is for smaller groups. Make a new private calendar for the people you want to see, then turn it on there.</p>
          )}
        </div>
      )}
      {intro && !settingUp && (
        <FriendModeIntro source="dashboard" onClose={() => setIntro(false)} onStart={() => { setIntro(false); setSettingUp(true); }} />
      )}
      {!enabled && !locked && preview?.lastOneTime && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pb-1 text-[12px]" style={{ color: FM.mutedText }}>
          <span style={{ color: FM.ink }}>
            {preview.lastOneTime.happened
              ? `That was the one night${preview.lastOneTime.venue ? ` at ${preview.lastOneTime.venue}` : ""}. Do it again?`
              : "The night didn't come together. Try again?"}
          </span>
          <button onClick={() => again(true)} disabled={saving} className="rounded-full px-3 py-1 font-medium" style={{ background: FM.accent, color: FM.canvas }}>
            One more time
          </button>
          <button onClick={() => again(false)} disabled={saving} className="underline" style={{ color: FM.ink }}>Make it regular</button>
        </div>
      )}

      {settingUp && (
        <FriendModeSetup
          calendarId={calendarId}
          calendarName={calendarName}
          onDone={(finished) => {
            setEnabled(true);
            void loadPreview();
            if (finished) setSettingUp(false);
          }}
          onCancel={() => setSettingUp(false)}
        />
      )}
    </section>
  );
}
