"use client";

/**
 * "Enable Friend Mode" from /me (signed in). Creates a small private calendar
 * with Friend Mode on — the owner is the organizer, and people who join
 * become its followers.
 *
 *   1. Name it   2. How often   3. People you keep seeing   4. Share the link
 *
 * Leaf only invites people already on Leaf (the suggestions). Everyone else
 * gets the invite link from the organizer's own phone (share sheet /
 * Messages), so Leaf never texts a number that hasn't agreed to hear from it.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import Parse from "@/lib/parse-client";
import { trackMarketingEvent } from "@/components/marketing/analytics";
import { Button } from "@/components/crew/CrewShell";
import { RHYTHM_LABELS } from "@/lib/crew";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";

type Suggestion = { userId: string; name: string; avatar: string | null; sharedPlans: number };
type Created = { crewId: string; inviteLink: string; invites: { ok: boolean }[] };
type Step = "name" | "rhythm" | "people" | "share";

export default function EnableFriendModeFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [rhythm, setRhythm] = useState(28);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    trackMarketingEvent("friend_mode_enable_open");
    Parse.Cloud.run("getFriendModeSuggestions", {})
      .then((r: { people: Suggestion[] }) => setSuggestions(r.people || []))
      .catch(() => {});
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const r = (await Parse.Cloud.run("createFriendCrew", {
        name: name.trim(),
        rhythmDays: rhythm,
        invitees: [...picked].map((userId) => ({ userId })),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })) as Created;
      setCreated(r);
      trackMarketingEvent("friend_mode_crew_created", { met: picked.size });
      setStep("share");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't turn on Friend Mode.");
    } finally {
      setBusy(false);
    }
  };

  const message = created ? `I'm using Leaf to plan get-togethers for ${name.trim()}. Join here: ${created.inviteLink}` : "";
  const share = async () => {
    if (!created) return;
    try {
      if (navigator.share) { await navigator.share({ title: name.trim(), text: message }); return; }
    } catch { /* cancelled */ }
    window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
  };
  const copy = async () => {
    if (!created) return;
    try { await navigator.clipboard.writeText(created.inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const Back = ({ to }: { to: Step }) => (
    <button className="text-sm text-zinc-500 hover:underline" onClick={() => setStep(to)}>Back</button>
  );

  return (
    <div className="fm rounded-2xl p-1 text-leaf-900">
      {step === "name" && (
        <div>
          <div className="mb-4"><FriendModeIcon size={56} /></div>
          <h1 className="text-2xl font-semibold">Enable Friend Mode</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-zinc-700">
            Recurring plans with your crew, on your schedule. Leaf picks a place, asks everyone which dates work, and locks the night.
          </p>
          <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-zinc-500">Name your crew</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Thursday crew, The usual, Book club…"
            className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-[17px]"
            maxLength={60}
          />
          <div className="mt-6 flex items-center gap-4">
            <Button onClick={() => setStep("rhythm")} disabled={!name.trim()}>Next</Button>
            <button className="text-sm text-zinc-500 hover:underline" onClick={onClose}>Not now</button>
          </div>
        </div>
      )}

      {step === "rhythm" && (
        <div>
          <h1 className="text-2xl font-semibold">How often?</h1>
          <p className="mt-2 text-[15px] text-zinc-700">Each person can also ask to be asked less often.</p>
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {Object.entries(RHYTHM_LABELS).map(([days, label]) => (
              <li key={days}>
                <button
                  onClick={() => setRhythm(Number(days))}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-[15px] ${rhythm === Number(days) ? "border-leaf-700 bg-leaf-50" : "border-zinc-300"}`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-4">
            <Button onClick={() => setStep("people")}>Next</Button>
            <Back to="name" />
          </div>
        </div>
      )}

      {step === "people" && (
        <div>
          <h1 className="text-2xl font-semibold">Who&rsquo;s in?</h1>
          {suggestions.length > 0 ? (
            <>
              <p className="mt-2 text-[15px] text-zinc-700">People you keep seeing at plans. Leaf invites them in the app.</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {suggestions.map((s) => {
                  const on = picked.has(s.userId);
                  return (
                    <li key={s.userId}>
                      <button
                        type="button"
                        onClick={() => { const n = new Set(picked); if (on) n.delete(s.userId); else n.add(s.userId); setPicked(n); }}
                        className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-leaf-700 bg-leaf-50" : "border-zinc-300"}`}
                      >
                        {on ? "✓ " : "+ "}{s.name} <span className="text-zinc-400">· {s.sharedPlans} plans together</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-[15px] text-zinc-700">No suggestions yet.</p>
          )}
          <p className="mt-4 text-[14px] text-zinc-600">
            Anyone else: on the next step you get a link to send from your own phone.
          </p>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-6 flex items-center gap-4">
            <Button onClick={create} disabled={busy}>{busy ? "Turning it on…" : "Turn on Friend Mode"}</Button>
            <Back to="rhythm" />
          </div>
        </div>
      )}

      {step === "share" && created && (
        <div>
          <div className="mb-4"><FriendModeIcon size={56} /></div>
          <h1 className="text-2xl font-semibold">{name.trim()} is on</h1>
          <p className="mt-2 text-[15px] text-zinc-700">
            {picked.size > 0 ? `${picked.size} ${picked.size === 1 ? "person was" : "people were"} invited in the app. ` : ""}
            Send the link to anyone else. They join with one tap, and Leaf plans the first night once enough people are in.
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-[14px]">
            <span className="min-w-0 flex-1 truncate">{created.inviteLink}</span>
            <button className="text-sm font-medium text-leaf-700 hover:underline" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={share}>Share the link</Button>
            <Link href={`/crew/${created.crewId}`} className="text-sm text-leaf-700 hover:underline">Open the crew page</Link>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            It&rsquo;s a private calendar you own, so it&rsquo;s also in your dashboard, where you can turn Friend Mode off or delete it.
          </p>
        </div>
      )}
    </div>
  );
}
