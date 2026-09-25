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
  const [sms, setSms] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    setSignedIn(Boolean(Parse.User.current()));
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
      const r = (await Parse.Cloud.run("verifyOTP", { phone: `+1${digits.slice(-10)}`, code: otp })) as { sessionToken?: string } | string;
      const token = typeof r === "object" && r?.sessionToken ? r.sessionToken : null;
      if (!token) { setError("That code didn't work. Try again."); return; }
      await Parse.User.become(token);
      setVerifiedUserCookie(name.trim(), phone);
      const me = Parse.User.current();
      if (me && !me.get("full_name")) { me.set("full_name", name.trim()); me.set("name", name.trim()); await me.save().catch(() => {}); }
      setSignedIn(true);
      setSmsPhone(phone);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify that code.");
    } finally { setBusy(false); }
  };
  const join = async () => {
    setBusy(true); setError("");
    try {
      const r = (await Parse.Cloud.run("joinCrewByCode", { code, sms, phone: sms ? smsPhone || null : null })) as { crewId: string };
      router.push(`/crew/${r.crewId}`);
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

  const smsOk = !sms || smsPhone.replace(/\D/g, "").length >= 10;
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
        ) : !signedIn ? (
          <div className="mt-4 space-y-2">
            <p className="text-[14px] text-zinc-600">Sign in to join. We text you a one-time code to confirm your number.</p>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px]" disabled={codeSent} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Your phone" inputMode="tel" autoComplete="tel" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px]" disabled={codeSent} />
            {codeSent && <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" inputMode="numeric" className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-[15px]" autoFocus />}
            <div className="pt-2">
              {codeSent
                ? <Button onClick={verify} disabled={busy || otp.length < 4}>{busy ? "Checking…" : "Continue"}</Button>
                : <Button onClick={sendCode} disabled={busy}>{busy ? "Sending…" : "Text me a code"}</Button>}
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <div className="mt-3 rounded-xl border border-zinc-300 p-3 text-[13px] text-zinc-700">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="block font-medium text-leaf-900">Text me about this crew&rsquo;s plans</span>
                  Date polls and the night&rsquo;s details, so you don&rsquo;t have to open the app. Up to 5 msgs/wk. Msg &amp; data rates may apply.
                  Reply HELP for help, STOP to opt out.
                </span>
              </label>
              <label className="mt-2 block pl-6">
                <span className="block text-xs text-zinc-500">Mobile number</span>
                <input value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(555) 555-5555" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-[14px]" />
              </label>
            </div>
            <div className="mt-4">
              <Button onClick={join} disabled={busy || !smsOk}>{busy ? "Joining…" : "Join"}</Button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </Card>
    </CrewShell>
  );
}
