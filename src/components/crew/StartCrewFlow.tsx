"use client";

/**
 * The Friend Mode intro: five steps, shared by /crew/start (as a page) and
 * the /me and dashboard popups (as a modal).
 *
 *   1. Meet Friend Mode   2. Name your crew   3. Add people
 *   4. How often?         5. Send the invites → done
 *
 * Adding people is the point. Signed-in visitors see "People you've met"
 * (co-attendees from community plans, names only) above the phone rows.
 * Nobody is texted until they reply IN; step 1 says so.
 */

import { useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { setVerifiedUserCookie } from "@/lib/verified-user";
import { trackMarketingEvent } from "@/components/marketing/analytics";
import { Button } from "@/components/crew/CrewShell";
import { RHYTHM_LABELS } from "@/lib/crew";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";

type Suggestion = { userId: string; name: string; avatar: string | null; sharedPlans: number };
type Row = { name: string; phone: string };
type Created = { crewId: string; token: string; link: string; bookLink: string; quorum: number; invites: { name?: string; ok: boolean; reason?: string }[] };

const STEPS = ["intro", "name", "people", "rhythm", "verify", "done"] as const;
type Step = (typeof STEPS)[number];

export default function StartCrewFlow({
  signedIn,
  suggest = false,
  initialName = "",
  fromEventGroupId = null,
  onClose,
}: {
  signedIn: boolean;
  suggest?: boolean;
  initialName?: string;
  /** A plan the visitor came from (/m/ or /p/ CTA): its attendees are offered first. */
  fromEventGroupId?: string | null;
  /** null when rendered as a page; a handler when rendered in a modal. */
  onClose: (() => void) | null;
}) {
  const [step, setStep] = useState<Step>("intro");
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<Row[]>([{ name: "", phone: "" }, { name: "", phone: "" }]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());
  const [rhythm, setRhythm] = useState(28);
  const [myName, setMyName] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  // 10DLC web-form consent: two separate, un-pre-checked boxes (messages; terms + privacy).
  const [smsConsent, setSmsConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const consented = smsConsent && termsConsent;

  useEffect(() => { trackMarketingEvent("friend_mode_intro_view"); }, []);
  useEffect(() => { trackMarketingEvent("friend_mode_intro_step", { step: STEPS.indexOf(step) + 1 }); }, [step]);
  useEffect(() => {
    if (!signedIn) return;
    Parse.Cloud.run("getFriendModeSuggestions", fromEventGroupId ? { eventGroupId: fromEventGroupId } : {})
      .then((r: { people: Suggestion[] }) => setSuggestions(r.people || []))
      .catch(() => {});
  }, [signedIn, fromEventGroupId]);

  const validRows = rows.filter((r) => r.phone.replace(/\D/g, "").length >= 10);
  const peopleCount = validRows.length + pickedIds.size;

  const next = () => setStep(STEPS[STEPS.indexOf(step) + 1]);
  const back = () => setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const invitees = [
        ...validRows.map((r) => ({ name: r.name.trim(), phone: r.phone })),
        ...[...pickedIds].map((userId) => ({ userId })),
      ];
      const r = (await Parse.Cloud.run("createFriendCrew", { name: name.trim(), rhythmDays: rhythm, invitees })) as Created;
      setCreated(r);
      trackMarketingEvent("friend_mode_crew_created", { people: invitees.length, met: pickedIds.size });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the crew.");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    const digits = myPhone.replace(/\D/g, "");
    if (!myName.trim()) { setError("Your name, so your friends know who added them."); return; }
    if (digits.length < 10) { setError("Enter a 10-digit phone number."); return; }
    setBusy(true);
    setError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally {
      setBusy(false);
    }
  };

  const verifyAndCreate = async () => {
    const digits = myPhone.replace(/\D/g, "");
    setBusy(true);
    setError("");
    try {
      const r = (await Parse.Cloud.run("verifyOTP", { phone: `+1${digits}`, code })) as { sessionToken?: string } | string;
      const sessionToken = typeof r === "object" && r?.sessionToken ? r.sessionToken : null;
      if (!sessionToken) { setError("That code didn't work. Try again."); return; }
      await Parse.User.become(sessionToken);
      setVerifiedUserCookie(myName.trim(), myPhone);
      const me = Parse.User.current();
      if (me && !me.get("full_name")) {
        me.set("full_name", myName.trim());
        me.set("name", myName.trim());
        await me.save().catch(() => {});
      }
      await create();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify that code.");
    } finally {
      setBusy(false);
    }
  };

  const consentBlock = (
    <div className="mt-4 space-y-2 rounded-xl border border-zinc-300 p-3 text-[13px] text-zinc-700">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={smsConsent} onChange={(e) => setSmsConsent(e.target.checked)} className="mt-0.5" />
        <span>
          I agree to receive text messages from Leaf about my crew&rsquo;s plans at the number I provide. Up to 5 msgs/wk.
          Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={termsConsent} onChange={(e) => setTermsConsent(e.target.checked)} className="mt-0.5" />
        <span>
          I agree to the <a href="/terms-conditions" target="_blank" rel="noreferrer" className="underline">Terms of Service</a> and{" "}
          <a href="/privacy-policy" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>.
        </span>
      </label>
    </div>
  );

  const closeLink = onClose ? (
    <button className="text-sm text-zinc-500 hover:underline" onClick={() => { trackMarketingEvent("friend_mode_intro_dismiss", { step }); onClose(); }}>
      Not now
    </button>
  ) : null;

  return (
    <div className="fm rounded-2xl p-1 text-leaf-900">
      {step === "intro" && (
        <div>
          <div className="mb-4"><FriendModeIcon size={64} /></div>
          <h1 className="text-2xl font-semibold">Meet Friend Mode</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
            Leaf finds a night that works for your friends and plans it. You add the people; Leaf does the rest.
          </p>
          <ul className="mt-4 space-y-2 text-[15px] text-zinc-700">
            <li>Every few weeks Leaf picks a place from your crew&rsquo;s book and asks everyone which nights work.</li>
            <li>Friends answer by text or in the app. No one has to be the planner.</li>
            <li>Your friends get one text asking to join. Nothing else until they say IN.</li>
          </ul>
          <div className="mt-6 flex items-center gap-4">
            <Button onClick={next}>Start a crew</Button>
            {closeLink}
          </div>
        </div>
      )}

      {step === "name" && (
        <div>
          <h1 className="text-2xl font-semibold">Name your crew</h1>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Thursday crew, The usual, Book club…"
            className="mt-4 w-full rounded-xl border border-zinc-300 px-4 py-3 text-[17px]"
            maxLength={60}
          />
          <div className="mt-6 flex items-center gap-4">
            <Button onClick={next} disabled={!name.trim()}>Next</Button>
            <button className="text-sm text-zinc-500 hover:underline" onClick={back}>Back</button>
          </div>
        </div>
      )}

      {step === "people" && (
        <div>
          <h1 className="text-2xl font-semibold">Add people</h1>
          <p className="mt-2 text-[15px] text-zinc-700">At least 2. Each gets one text asking to join {name.trim() || "the crew"}.</p>
          {suggestions.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">People you&rsquo;ve met</div>
              <ul className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((s) => {
                  const on = pickedIds.has(s.userId);
                  return (
                    <li key={s.userId}>
                      <button
                        type="button"
                        onClick={() => { const n = new Set(pickedIds); if (on) n.delete(s.userId); else n.add(s.userId); setPickedIds(n); }}
                        className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-leaf-700 bg-leaf-50" : "border-zinc-300"}`}
                      >
                        {on ? "✓ " : "+ "}{s.name} <span className="text-zinc-400">· {s.sharedPlans} plans together</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input value={r.name} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" className="w-2/5 rounded-xl border border-zinc-300 px-3 py-2 text-[15px]" />
                <input value={r.phone} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} placeholder="Phone" inputMode="tel" className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-[15px]" />
              </div>
            ))}
            {rows.length < 14 && (
              <button type="button" className="text-sm text-leaf-700 hover:underline" onClick={() => setRows([...rows, { name: "", phone: "" }])}>+ one more</button>
            )}
          </div>
          {(suggest || fromEventGroupId) && suggestions.length === 0 && signedIn && (
            <p className="mt-3 text-xs text-zinc-500">{fromEventGroupId ? "No one else from that plan yet. Add friends by number." : "No one from community plans yet. Add friends by number."}</p>
          )}
          <div className="mt-6 flex items-center gap-4">
            <Button onClick={next} disabled={peopleCount < 2}>Next{peopleCount ? ` (${peopleCount})` : ""}</Button>
            <button className="text-sm text-zinc-500 hover:underline" onClick={back}>Back</button>
          </div>
        </div>
      )}

      {step === "rhythm" && (
        <div>
          <h1 className="text-2xl font-semibold">How often?</h1>
          <p className="mt-2 text-[15px] text-zinc-700">Leaf starts planning the next night around this rhythm. Anyone can start one sooner.</p>
          <ul className="mt-4 space-y-2">
            {Object.entries(RHYTHM_LABELS).map(([days, label]) => (
              <li key={days}>
                <button
                  type="button"
                  onClick={() => setRhythm(Number(days))}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-[15px] ${rhythm === Number(days) ? "border-leaf-700 bg-leaf-50" : "border-zinc-300"}`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
          {signedIn && consentBlock}
          <div className="mt-6 flex items-center gap-4">
            <Button onClick={() => (signedIn ? create() : next())} disabled={busy || (signedIn && !consented)}>{signedIn ? (busy ? "Sending…" : "Send the invites") : "Next"}</Button>
            <button className="text-sm text-zinc-500 hover:underline" onClick={back}>Back</button>
          </div>
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        </div>
      )}

      {step === "verify" && (
        <div>
          <h1 className="text-2xl font-semibold">Last thing: you</h1>
          <p className="mt-2 text-[15px] text-zinc-700">Your friends will see your name. We text you a code to prove the number is yours.</p>
          <div className="mt-4 space-y-2">
            <input value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px]" disabled={codeSent} />
            <input value={myPhone} onChange={(e) => setMyPhone(e.target.value)} placeholder="Your phone" inputMode="tel" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px]" disabled={codeSent} />
            {codeSent && (
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px]" autoFocus />
            )}
          </div>
          {!codeSent && consentBlock}
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-6 flex items-center gap-4">
            {codeSent ? (
              <Button onClick={verifyAndCreate} disabled={busy || code.length < 4}>{busy ? "Sending invites…" : "Send the invites"}</Button>
            ) : (
              <Button onClick={sendCode} disabled={busy || !consented}>{busy ? "Sending code…" : "Text me a code"}</Button>
            )}
            <button className="text-sm text-zinc-500 hover:underline" onClick={() => (codeSent ? setCodeSent(false) : back())}>Back</button>
          </div>
        </div>
      )}

      {step === "done" && created && (
        <div>
          <h1 className="text-2xl font-semibold">Invites sent</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-zinc-700">
            Leaf starts planning {name.trim()}&rsquo;s first night as soon as {Math.max(1, created.quorum - 1)} more {created.quorum - 1 === 1 ? "person joins" : "people join"}. You&rsquo;ll see it here and by text.
          </p>
          {created.invites.some((i) => !i.ok) && (
            <p className="mt-2 text-sm text-zinc-500">
              Couldn&rsquo;t invite: {created.invites.filter((i) => !i.ok).map((i) => i.name || "someone").join(", ")}.
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button href={created.link}>Open {name.trim()}</Button>
            <Button href={created.bookLink} kind="ghost">Add a place to the book</Button>
          </div>
          {onClose && (
            <div className="mt-4">
              <button className="text-sm text-zinc-500 hover:underline" onClick={onClose}>Close</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
