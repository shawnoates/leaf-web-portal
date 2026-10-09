"use client";

/**
 * Join a crew from its invite link. Shows the crew, signs the person in with
 * a one-time code if needed (the code they ask for is a sign-in message, not
 * a Friend Mode text), then Join — with the optional, unticked text opt-in
 * and its number on the same form (10DLC). Joining makes them a follower of
 * the crew's calendar.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Parse from "@/lib/parse-client";
import { setVerifiedUserCookie, getVerifiedUserCookie } from "@/lib/verified-user";
import { CrewShell, Card, Button } from "@/components/crew/CrewShell";
import { FriendModeIcon } from "@/components/crew/FriendModeGlyphs";
import SeedPlaces from "@/components/crew/SeedPlaces";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { cadenceLabel } from "@/lib/crew";

type Invite = {
  name: string; ownerName: string; image: string | null; rhythmDays: number; oneTime?: boolean; joined: number; full: boolean;
  mine: { status: string | null; crewId: string } | null;
};

export default function JoinCrewClient({ code }: { code: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loadError, setLoadError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [name, setName] = useState(() => getVerifiedUserCookie()?.name || "");
  const [phone, setPhone] = useState(() => getVerifiedUserCookie()?.phone || "");
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  // Signed in with a number on file: no need to ask for one.
  const [hasPhone, setHasPhone] = useState(false);
  const [passed, setPassed] = useState(false);
  // Signed out and tapped Join: now ask who they are (name, phone, code),
  // then join straight away. The choice comes first, sign-in second.
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Set once they're in: the optional tap-to-add step runs before the crew
  // page so it's asked while they're still here, not buried on a later visit.
  const [joinedCrewId, setJoinedCrewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = (await Parse.Cloud.run("getCrewInvite", { code })) as Invite;
      setInvite(r);
      if (r.mine?.status === "in") router.replace(`/crew/${r.mine.crewId}`);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "This invite link has expired.");
    }
  }, [code, router]);

  useEffect(() => {
    const u = Parse.User.current();
    setSignedIn(Boolean(u));
    setHasPhone(Boolean(u?.get("phone")));
    void load();
  }, [load]);

  const digits = phone.replace(/\D/g, "");
  const sendCode = async () => {
    if (!name.trim()) { setError("Your name, so the group knows who joined."); return; }
    if (digits.length < 10) { setError("Enter a 10-digit phone number."); return; }
    setBusy(true); setError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits.slice(-10)}` });
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError("");
    try {
      const r = (await Parse.Cloud.run("verifyOTP", { phone: `+1${digits.slice(-10)}`, code: otp, name: name.trim() })) as { sessionToken?: string } | string;
      const token = typeof r === "object" && r?.sessionToken ? r.sessionToken : null;
      if (!token) { setError("That code didn't work. Try again."); return; }
      await Parse.User.become(token);
      setVerifiedUserCookie(name.trim(), phone);
      const me = Parse.User.current();
      if (me && !me.get("full_name")) { me.set("full_name", name.trim()); me.set("name", name.trim()); await me.save().catch(() => {}); }
      setSignedIn(true);
      setHasPhone(true);
      setSmsPhone(phone);
      // They already chose Join — finish it, with the number they just verified.
      if (joining) { setBusy(false); await join({ verified: true }); return; }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify that code.");
    } finally { setBusy(false); }
  };
  const join = async ({ verified = false }: { verified?: boolean } = {}) => {
    setBusy(true); setError("");
    try {
      // Joining turns on texts about the crew (the terms sit under the
      // button), same as the crew page's invite screen.
      const r = (await Parse.Cloud.run("joinCrewByCode", { code, sms: true, phone: verified || hasPhone ? null : smsPhone || null })) as { crewId: string };
      setJoinedCrewId(r.crewId);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join.");
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <CrewShell>
        <Card><p className="text-[15px] text-zinc-700">{loadError}</p></Card>
      </CrewShell>
    );
  }
  if (!invite) return <CrewShell><p className="text-sm text-zinc-500">Loading…</p></CrewShell>;

  if (joinedCrewId) {
    return (
      <CrewShell>
        <Card>
          <p className="m-0 mb-4 text-[15px] text-zinc-700">You&rsquo;re in {invite.name}.</p>
          <SeedPlaces
            auth={{ crewId: joinedCrewId }}
            crewName={invite.name}
            onDone={() => router.push(`/crew/${joinedCrewId}`)}
          />
        </Card>
      </CrewShell>
    );
  }

  const smsOk = hasPhone || smsPhone.replace(/\D/g, "").length >= 10;

  if (passed) {
    return (
      <CrewShell>
        <Card>
          <p className="m-0 text-[15px] text-zinc-700">No problem. Nothing&rsquo;s changed, and this link still works if you change your mind.</p>
        </Card>
      </CrewShell>
    );
  }
  return (
    <CrewShell>
      <div className="mb-5 flex items-center gap-3">
        {invite.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={invite.image} alt="" className="h-12 w-12 rounded-xl object-cover" />
          : <FriendModeIcon size={48} />}
        <div>
          <h1 className="text-2xl font-semibold text-leaf-900">{invite.name}</h1>
          <p className="text-[14px] text-zinc-600">{invite.ownerName} invited you · {cadenceLabel(invite)} · {invite.joined} in</p>
        </div>
      </div>

      <Card>
        <p className="text-[15px] text-zinc-700">
          Recurring plans with your crew, on your schedule. Leaf picks a place, asks everyone which dates work, and locks the night.
        </p>

        {invite.full ? (
          <p className="mt-4 text-[15px] text-zinc-700">This crew is full.</p>
        ) : !signedIn && !joining ? (
          <div className="mt-2">
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => setJoining(true)}>Join</Button>
              <Button kind="ghost" onClick={() => setPassed(true)}>No thanks</Button>
            </div>
            <p className="mb-0 mt-3 text-[11px] leading-snug text-zinc-500">
              By joining, you agree to get texts about this crew&rsquo;s plans (date polls and the night&rsquo;s details). Up to 5 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.
            </p>
          </div>
        ) : !signedIn ? (
          <div className="mt-4 space-y-2">
            <p className="text-[14px] text-zinc-600">{codeSent ? "Enter the code we just texted you." : "Your name and number, so the crew knows who joined. We\u2019ll text a code to confirm it."}</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" className="h-11 w-full rounded-xl border border-zinc-300 px-3 text-[16px]" disabled={codeSent} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone" inputMode="tel" autoComplete="tel" className="h-11 w-full rounded-xl border border-zinc-300 px-3 text-[16px]" disabled={codeSent} />
            {codeSent && <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" className="h-11 w-full rounded-xl border border-zinc-300 px-3 text-[16px]" autoFocus />}
            <div className="flex items-center gap-3 pt-2">
              {codeSent
                ? <Button onClick={verify} disabled={busy || otp.length < 4}>{busy ? "Joining…" : "Join"}</Button>
                : <Button onClick={sendCode} disabled={busy}>{busy ? "Sending…" : "Text me a code"}</Button>}
              <button type="button" className="text-sm text-zinc-500 underline underline-offset-4" onClick={() => { setJoining(false); setError(""); }} disabled={busy}>Back</button>
            </div>
            <p className="mb-0 pt-1 text-[11px] leading-snug text-zinc-500">
              By joining, you agree to get texts about this crew&rsquo;s plans. Up to 5 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.
            </p>
            {!codeSent && (
              <div className="border-t border-zinc-200 pt-3">
                <p className="mb-2 mt-0 text-xs text-zinc-500">Already on Leaf? Sign in with Google instead.</p>
                {/* Same Leaf account as the app and calendars. Joining then asks for a number only if the account has none. */}
                <GoogleSignInButton
                  fullWidth
                  ignoreExistingSession
                  onSignIn={(u) => {
                    const user = u as unknown as Parse.User;
                    setSignedIn(true);
                    setHasPhone(Boolean(user?.get?.("phone")));
                    setError("");
                    void load();
                  }}
                  onError={(e) => setError(e)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-2">
            {!hasPhone && (
              <label className="mt-3 block">
                <span className="block text-xs text-zinc-500">Mobile number, for texts</span>
                <input value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(555) 555-5555" className="mt-1 h-11 w-full rounded-xl border border-zinc-300 px-3 text-[16px]" />
              </label>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => join()} disabled={busy || !smsOk}>{busy ? "Joining…" : "Join"}</Button>
              <Button kind="ghost" onClick={() => setPassed(true)} disabled={busy}>No thanks</Button>
            </div>
            <p className="mb-0 mt-3 text-[11px] leading-snug text-zinc-500">
              By joining, you agree to get texts about this crew&rsquo;s plans (date polls and the night&rsquo;s details). Up to 5 msgs/wk. Msg &amp; data rates may apply. Reply HELP for help, STOP to opt out.
            </p>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </Card>
    </CrewShell>
  );
}
