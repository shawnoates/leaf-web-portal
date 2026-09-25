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

const MAX_MEMBERS = 15;

type Person = { userId: string; name: string; channel: "push" | "sms" | "none"; canInvite: boolean; reason: string | null };
type Preview = { people: Person[]; invited: number; joined: number; ownerSmsOptIn?: boolean; ownerPhoneLast4?: string | null; inviteLink?: string };

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
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirming, setConfirming] = useState(false);
  // The owner's own text opt-in, offered once Friend Mode is on. Never pre-ticked.
  const [ownerSms, setOwnerSms] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const copyLink = async () => {
    if (!preview?.inviteLink) return;
    try { await navigator.clipboard.writeText(preview.inviteLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); } catch { /* ignore */ }
  };
  const locked = memberCount > MAX_MEMBERS;

  const loadPreview = useCallback(async () => {
    try {
      setPreview((await Parse.Cloud.run("previewCalendarInvites", { calendarId })) as Preview);
    } catch {
      setPreview(null);
    }
  }, [calendarId]);

  useEffect(() => {
    if (enabled && !locked) void loadPreview();
  }, [enabled, locked, loadPreview]);

  const toggle = async (v: boolean) => {
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

  const setTexts = async (on: boolean) => {
    setSaving(true);
    setError("");
    try {
      await Parse.Cloud.run("setCrewTexts", { crewId: calendarId, on, ...(on && ownerPhone ? { phone: ownerPhone } : {}) });
      setOwnerSms(false);
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  };

  const invitable = preview?.people.filter((p) => p.canInvite) ?? [];
  const pushes = invitable.filter((p) => p.channel === "push");
  const texts = invitable.filter((p) => p.channel === "sms");

  const subline = locked
    ? `Not available · Friend Mode is for circles under ${MAX_MEMBERS} followers`
    : enabled
      ? "On · recurring plans with your crew, on your schedule"
      : "Recurring plans with your crew, on your schedule";

  const status = preview
    ? [
        `${preview.joined + 1} in`,
        preview.invited ? `${preview.invited} invited` : null,
        invitable.length ? `${invitable.length} not invited yet` : null,
      ].filter(Boolean).join(" · ")
    : "";

  return (
    <section
      className="rounded-xl px-4 py-2.5"
      style={{ background: locked ? FM.surfaceDim : FM.brand, border: `1px solid ${locked ? FM.lineDim : FM.line}` }}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium" style={{ color: locked ? FM.mutedText : FM.ink }}>
            Friend Mode{" "}
            <Link href="/help/calendars-and-rsvps/friend-mode" target="_blank" className="ml-1 text-[12px] font-normal italic underline" style={{ color: FM.mutedText }}>
              What is this?
            </Link>
          </p>
          <p className="text-[12px]" style={{ color: locked ? FM.muted : enabled ? FM.accent : FM.mutedText }}>{subline}</p>
        </div>
        <FriendModeSwitch label="Friend Mode" checked={enabled} locked={locked} disabled={saving} onChange={toggle} />
      </div>

      {(enabled || locked || error) && (
        <div className="mt-1.5 space-y-2 pb-1 text-[12px]" style={{ color: FM.mutedText }}>
          {error && <p style={{ color: "#F2A39A" }}>{error}</p>}
          {note && <p style={{ color: FM.ink }}>{note}</p>}

          {enabled && !locked && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {status && <span>{status}</span>}
              {invitable.length > 0 && !confirming && (
                <button onClick={() => setConfirming(true)} className="font-medium underline" style={{ color: FM.ink }}>
                  Invite members
                </button>
              )}
              {preview?.inviteLink && (
                <button onClick={copyLink} className="underline" style={{ color: FM.ink }}>{linkCopied ? "Link copied" : "Copy invite link"}</button>
              )}
              <Link href={`/crew/${calendarId}`} className="underline" style={{ color: FM.ink }}>Open the crew page</Link>
            </div>
          )}

          {enabled && preview && (
            preview.ownerSmsOptIn ? (
              <p>
                Texts to you about this crew are on.{" "}
                <button className="underline" disabled={saving} onClick={() => setTexts(false)} style={{ color: FM.ink }}>Turn off</button>
              </p>
            ) : (
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <label className="flex flex-1 items-start gap-2">
                  <input type="checkbox" checked={ownerSms} onChange={(e) => setOwnerSms(e.target.checked)} className="mt-0.5" />
                  <span>
                    <span style={{ color: FM.ink }}>Text me about this crew&rsquo;s plans</span> — up to 5 msgs/wk. Msg &amp; data rates may apply.
                    Reply HELP for help, STOP to opt out.
                  </span>
                </label>
                <label className="w-full pl-6">
                  <span className="block" style={{ color: FM.mutedText }}>Mobile number</span>
                  <input
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={preview.ownerPhoneLast4 ? `Number on file ending in ${preview.ownerPhoneLast4}` : "(555) 555-5555"}
                    className="mt-1 w-full max-w-xs rounded-lg px-3 py-1.5 text-[13px]"
                    style={{ background: FM.canvas, border: `1px solid ${FM.line}`, color: FM.ink }}
                  />
                </label>
                {ownerSms && (preview.ownerPhoneLast4 || ownerPhone.replace(/\D/g, "").length >= 10) && (
                  <button onClick={() => setTexts(true)} disabled={saving} className="rounded-full px-3 py-1 font-medium disabled:opacity-60" style={{ background: FM.accent, color: FM.canvas }}>
                    Save
                  </button>
                )}
              </div>
            )
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
