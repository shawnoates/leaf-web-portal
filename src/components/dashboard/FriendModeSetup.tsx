"use client";

/**
 * Turning Friend Mode on. The switch opens this; Friend Mode is only turned
 * on when the owner finishes the required steps. Closing early leaves it off
 * — nothing was changed on the server, so there's nothing to undo.
 *
 *   1. How often          (required, defaults to monthly)
 *   2. Invite people      (required: followers pre-selected — untick to leave out — or share the link)
 *   3. Turn on            → enables, sends the picked invites
 *   4. Add a few spots    (optional: places trending nearby, then Done)
 */

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { FM, FriendModeIcon } from "@/components/crew/FriendModeGlyphs";
import { RHYTHM_LABELS } from "@/lib/crew";

type Person = { userId: string; name: string; channel: "push" | "sms" | "none"; canInvite: boolean };
type Preview = { people: Person[]; inviteLink?: string; rhythmDays?: number };
type Spot = { locationId: string; name: string; neighborhood: string | null; category: string | null; saves: number };
type Step = "rhythm" | "invite" | "spots";

export default function FriendModeSetup({
  calendarId,
  calendarName,
  onDone,
  onCancel,
}: {
  calendarId: string;
  calendarName: string;
  /** Friend Mode is on (called after step 3 succeeds and again on Done). */
  onDone: (turnedOn: boolean) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>("rhythm");
  const [rhythm, setRhythm] = useState(28);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trending, setTrending] = useState<Spot[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const on = step === "spots";

  useEffect(() => {
    Parse.Cloud.run("previewCalendarInvites", { calendarId })
      .then((r: Preview) => {
        setPreview(r);
        // Everyone is invited by default; the owner unticks anyone to leave out.
        setPicked(new Set(r.people.filter((p) => p.canInvite).map((p) => p.userId)));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your followers."));
  }, [calendarId]);

  const invitable = preview?.people.filter((p) => p.canInvite) ?? [];
  const canFinish = picked.size > 0 || shared;
  const close = () => (on ? onDone(true) : onCancel());

  const shareLink = async () => {
    if (!preview?.inviteLink) return;
    const text = `Join ${calendarName} on Leaf — we're planning get-togethers: ${preview.inviteLink}`;
    try {
      if (navigator.share) { await navigator.share({ title: calendarName, text }); setShared(true); return; }
    } catch { return; /* cancelled */ }
    try { await navigator.clipboard.writeText(preview.inviteLink); setShared(true); } catch { /* ignore */ }
  };

  const turnOn = async () => {
    setBusy(true);
    setError("");
    try {
      await Parse.Cloud.run("setFriendModeOnCalendar", { calendarId, enabled: true, rhythmDays: rhythm });
      if (picked.size) await Parse.Cloud.run("inviteCalendarMembers", { calendarId, userIds: [...picked] });
      onDone(false);
      setStep("spots");
      Parse.Cloud.run("getCrewBook", { crewId: calendarId })
        .then((r: { trending?: Spot[] }) => setTrending(r.trending || []))
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on Friend Mode.");
    } finally {
      setBusy(false);
    }
  };

  const addSpot = async (s: Spot) => {
    try {
      await Parse.Cloud.run("addToCrewBook", { crewId: calendarId, locationId: s.locationId });
      setAdded(new Set(added).add(s.locationId));
    } catch { /* leave it */ }
  };

  const pill = (active: boolean) => ({
    background: active ? FM.accent : "transparent",
    color: active ? FM.canvas : FM.ink,
    border: `1px solid ${active ? FM.accent : FM.line}`,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Turn on Friend Mode"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl"
        style={{ background: FM.canvas, color: FM.ink, border: `1px solid ${FM.line}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <FriendModeIcon size={40} state={on ? "enabled" : "disabled"} />
            <div>
              <p className="text-[17px] font-semibold">{on ? "Friend Mode is on" : "Turn on Friend Mode"}</p>
              <p className="text-[12px]" style={{ color: FM.mutedText }}>{calendarName}</p>
            </div>
          </div>
          <button onClick={close} aria-label="Close" className="text-xl leading-none" style={{ color: FM.mutedText }}>×</button>
        </div>

        {step === "rhythm" && (
          <div className="mt-5">
            <p className="text-[15px] font-medium">How often should Leaf plan a night?</p>
            <p className="mt-1 text-[13px]" style={{ color: FM.mutedText }}>You can change this later. Each person can also ask to be asked less often.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {Object.entries(RHYTHM_LABELS).map(([d, label]) => (
                <button key={d} onClick={() => setRhythm(Number(d))} className="rounded-xl px-3 py-2.5 text-left text-[14px]" style={pill(rhythm === Number(d))}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button onClick={() => setStep("invite")} className="rounded-full px-5 py-2 text-[14px] font-medium" style={{ background: FM.accent, color: FM.canvas }}>Next</button>
              <button onClick={onCancel} className="text-[13px] underline" style={{ color: FM.mutedText }}>Cancel</button>
            </div>
          </div>
        )}

        {step === "invite" && (
          <div className="mt-5">
            <p className="text-[15px] font-medium">Invite your people</p>
            <p className="mt-1 text-[13px]" style={{ color: FM.mutedText }}>
              Friend Mode turns on once you invite at least one person. Nobody joins until they say yes, and anyone who
              doesn&rsquo;t stays a follower as before.
            </p>

            {invitable.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] uppercase tracking-wide" style={{ color: FM.mutedText }}>Followers</p>
                  <button
                    className="text-[12px] underline"
                    style={{ color: FM.ink }}
                    onClick={() => setPicked(picked.size === invitable.length ? new Set() : new Set(invitable.map((p) => p.userId)))}
                  >
                    {picked.size === invitable.length ? "Clear" : "Select all"}
                  </button>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {invitable.map((p) => {
                    const sel = picked.has(p.userId);
                    return (
                      <li key={p.userId}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2" style={{ background: sel ? FM.brand : "transparent", border: `1px solid ${FM.line}` }}>
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => { const n = new Set(picked); if (sel) n.delete(p.userId); else n.add(p.userId); setPicked(n); }}
                          />
                          <span className="flex-1 text-[14px]">{p.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[12px]" style={{ color: FM.mutedText }}>
                  People not on the app get a text from Leaf&rsquo;s usual number, between 9am and 9pm.
                </p>
              </div>
            )}

            <div className="mt-4 rounded-xl p-3" style={{ border: `1px solid ${FM.line}` }}>
              <p className="text-[14px]">{invitable.length > 0 ? "Or share the invite link" : "Share the invite link"}</p>
              <p className="mt-0.5 text-[12px]" style={{ color: FM.mutedText }}>Send it from your phone to anyone you want in. It works once Friend Mode is on.</p>
              <button onClick={shareLink} disabled={!preview?.inviteLink} className="mt-2 rounded-full px-4 py-1.5 text-[13px]" style={pill(shared)}>
                {shared ? "Link shared ✓" : "Share the link"}
              </button>
            </div>

            {error && <p className="mt-3 text-[13px]" style={{ color: "#F2A39A" }}>{error}</p>}
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={turnOn}
                disabled={!canFinish || busy}
                className="rounded-full px-5 py-2 text-[14px] font-medium disabled:opacity-50"
                style={{ background: FM.accent, color: FM.canvas }}
              >
                {busy ? "Turning on…" : picked.size ? `Turn on and invite ${picked.size}` : "Turn on"}
              </button>
              <button onClick={() => setStep("rhythm")} className="text-[13px] underline" style={{ color: FM.mutedText }}>Back</button>
            </div>
            {!canFinish && <p className="mt-2 text-[12px]" style={{ color: FM.mutedText }}>Pick someone or share the link to continue.</p>}
          </div>
        )}

        {step === "spots" && (
          <div className="mt-5">
            <p className="text-[15px]">
              {picked.size ? `${picked.size} ${picked.size === 1 ? "person was" : "people were"} invited. ` : ""}
              Leaf plans the first night as soon as enough people join.
            </p>
            {trending.length > 0 && (
              <div className="mt-4">
                <p className="text-[15px] font-medium">Start the group&rsquo;s list</p>
                <p className="mt-1 text-[13px]" style={{ color: FM.mutedText }}>Places people nearby have been saving. Leaf picks each night from this list.</p>
                <ul className="mt-3 space-y-1.5">
                  {trending.map((s) => (
                    <li key={s.locationId} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ border: `1px solid ${FM.line}` }}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px]">{s.name}</span>
                        <span className="block truncate text-[12px]" style={{ color: FM.mutedText }}>
                          {[s.category, s.neighborhood].filter(Boolean).join(" · ")}{s.saves ? ` · ${s.saves} saves lately` : ""}
                        </span>
                      </span>
                      {added.has(s.locationId)
                        ? <span className="text-[12px]" style={{ color: FM.accent }}>Added ✓</span>
                        : <button onClick={() => addSpot(s)} className="rounded-full px-3 py-1 text-[12px]" style={pill(false)}>Add</button>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-5">
              <button onClick={() => onDone(true)} className="rounded-full px-5 py-2 text-[14px] font-medium" style={{ background: FM.accent, color: FM.canvas }}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
