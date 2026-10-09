"use client";

/**
 * One way into a Leaf account, wherever someone starts: Google, an email
 * code, or a phone code. Every path ends in the same Parse session for the
 * same user, so a crew started on /friends, a calendar on the dashboard and
 * plans in the app all belong to one person.
 *
 * Google leads (one tap, and it sets up calendar availability); email and
 * phone sit underneath. `firstMethod="phone"` leads with the phone instead,
 * for flows that run on texts (a crew invite).
 */

import { useState } from "react";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useEmailCodeSignIn } from "@/lib/email-code";
import { setVerifiedUserCookie } from "@/lib/verified-user";

export type SignInMethod = "google" | "email" | "phone";

type Tone = "light" | "dark";

const STYLES: Record<Tone, { field: string; primary: string; link: string; label: string; muted: string; error: string; divider: string }> = {
  dark: {
    field: "h-12 w-full rounded-2xl border border-fm-line bg-fm-canvas px-4 text-base text-fm-ink placeholder:text-fm-muted focus:border-fm-accent focus:outline-none",
    primary: "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-fm-accent px-6 text-[15px] font-bold text-fm-canvas transition hover:brightness-105 disabled:opacity-60",
    link: "inline-flex items-center gap-1.5 text-sm font-semibold text-fm-ink-2 underline-offset-4 hover:text-fm-ink hover:underline",
    label: "text-sm font-semibold text-fm-ink-2",
    muted: "text-xs leading-relaxed text-fm-muted",
    error: "text-sm text-fm-danger",
    divider: "border-fm-line-dim text-fm-muted",
  },
  light: {
    field: "h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none",
    primary: "flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-[15px] font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60",
    link: "inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline",
    label: "text-sm font-medium text-zinc-700",
    muted: "text-xs leading-relaxed text-zinc-500",
    error: "text-sm text-red-600",
    divider: "border-zinc-200 text-zinc-400",
  },
};

export default function LeafSignIn({
  onSignedIn,
  tone = "light",
  firstMethod = "google",
  askName = false,
  ignoreExistingSession = true,
  phoneNote,
}: {
  /** Fires once there's a session, with how they got in. */
  onSignedIn: (user: Parse.User, how: SignInMethod) => void | Promise<void>;
  tone?: Tone;
  firstMethod?: SignInMethod;
  /** Ask for a name on the phone and email paths (a new account has none). */
  askName?: boolean;
  /** false: an existing session signs straight in (sign-in pages). */
  ignoreExistingSession?: boolean;
  /** Small print under the phone form (what Leaf will text them about). */
  phoneNote?: string;
}) {
  const st = STYLES[tone];
  const [method, setMethod] = useState<SignInMethod>(firstMethod);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const digits = phone.replace(/\D/g, "");
  const e164 = `+1${digits.slice(-10)}`;

  const nameIt = async () => {
    const me = Parse.User.current();
    if (askName && name.trim() && me && !me.get("full_name")) {
      me.set("full_name", name.trim());
      me.set("name", name.trim());
      await me.save().catch(() => {});
    }
    return me;
  };

  const email = useEmailCodeSignIn(async () => {
    const me = await nameIt();
    if (me) await onSignedIn(me, "email");
  });

  const sendPhoneCode = async () => {
    if (askName && !name.trim()) { setError("Your name, so people know who it is."); return; }
    if (digits.length < 10) { setError("Enter a 10-digit phone number."); return; }
    setBusy(true); setError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: e164 });
      setPhoneStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the code.");
    } finally { setBusy(false); }
  };

  const verifyPhone = async () => {
    setBusy(true); setError("");
    try {
      const r = (await Parse.Cloud.run("verifyOTP", { phone: e164, code: phoneCode, name: name.trim() })) as { sessionToken?: string } | string;
      const token = typeof r === "object" && r?.sessionToken ? r.sessionToken : null;
      if (!token) { setError("That code didn't work. Try again."); return; }
      await Parse.User.become(token);
      if (name.trim()) setVerifiedUserCookie(name.trim(), phone);
      const me = await nameIt();
      if (me) await onSignedIn(me, "phone");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't verify that code.");
    } finally { setBusy(false); }
  };

  const switchTo = (m: SignInMethod) => { setMethod(m); setError(""); email.restart(); setPhoneStep("phone"); setPhoneCode(""); };
  const others = (["google", "email", "phone"] as SignInMethod[]).filter((m) => m !== method);
  const otherLabel: Record<SignInMethod, React.ReactNode> = {
    google: "Continue with Google",
    email: <><Mail size={15} aria-hidden /> Use email</>,
    phone: <><Phone size={15} aria-hidden /> Use phone</>,
  };
  const nameField = askName && (
    <div className="flex flex-col gap-2">
      <label htmlFor="signin-name" className={st.label}>Your name</label>
      <input id="signin-name" className={st.field} value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last" autoComplete="name" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {method === "google" && (
        <GoogleSignInButton
          fullWidth
          ignoreExistingSession={ignoreExistingSession}
          theme={tone === "dark" ? "filled_black" : "outline"}
          onSignIn={(u) => { void onSignedIn(u as unknown as Parse.User, "google"); }}
          onError={(e) => setError(e)}
        />
      )}

      {method === "email" && (
        email.step === "email" ? (
          <>
            {nameField}
            <div className="flex flex-col gap-2">
              <label htmlFor="signin-email" className={st.label}>Your email</label>
              <input id="signin-email" className={st.field} value={email.email} onChange={(e) => email.setEmail(e.target.value)} placeholder="you@example.com" inputMode="email" autoComplete="email" />
            </div>
            <button
              type="button"
              className={st.primary}
              disabled={email.busy}
              onClick={() => { if (askName && !name.trim()) { setError("Your name, so people know who it is."); return; } setError(""); void email.sendCode(); }}
            >
              {email.busy ? "Sending…" : "Email me a code"}
            </button>
          </>
        ) : (
          <>
            <p className={`m-0 ${st.label}`}>Enter the 6-digit code we sent to {email.email.trim()}.</p>
            <input className={`${st.field} text-center font-mono tracking-[0.4em]`} value={email.code} onChange={(e) => email.setCode(e.target.value)} placeholder="••••••" inputMode="numeric" autoComplete="one-time-code" aria-label="Code" />
            <button type="button" className={st.primary} disabled={email.busy} onClick={() => void email.verify()}>{email.busy ? "Checking…" : "Continue"}</button>
            <button type="button" className={`self-start ${st.link}`} onClick={email.restart}><ArrowLeft size={15} aria-hidden /> Different email</button>
          </>
        )
      )}

      {method === "phone" && (
        phoneStep === "phone" ? (
          <>
            {nameField}
            <div className="flex flex-col gap-2">
              <label htmlFor="signin-phone" className={st.label}>Your phone</label>
              <input id="signin-phone" className={st.field} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" inputMode="tel" autoComplete="tel-national" />
            </div>
            <button type="button" className={st.primary} onClick={sendPhoneCode} disabled={busy}>{busy ? "Sending…" : "Text me a code"}</button>
            {phoneNote && <p className={`m-0 ${st.muted}`}>{phoneNote}</p>}
          </>
        ) : (
          <>
            <p className={`m-0 ${st.label}`}>Enter the code we texted to ({digits.slice(-10, -7)}) {digits.slice(-7, -4)}-{digits.slice(-4)}.</p>
            <input className={`${st.field} text-center font-mono tracking-[0.4em]`} value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" inputMode="numeric" autoComplete="one-time-code" aria-label="Code" />
            <button type="button" className={st.primary} onClick={verifyPhone} disabled={busy || phoneCode.length < 4}>{busy ? "Checking…" : "Continue"}</button>
            <button type="button" className={`self-start ${st.link}`} onClick={() => { setPhoneStep("phone"); setPhoneCode(""); setError(""); }}><ArrowLeft size={15} aria-hidden /> Different number</button>
          </>
        )
      )}

      {(error || email.error) && <p role="alert" className={`m-0 ${st.error}`}>{error || email.error}</p>}

      <div className={`flex items-center gap-3 border-t pt-4 text-xs ${st.divider}`}>
        <span>Or</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {others.map((m) => (
            <button key={m} type="button" className={st.link} onClick={() => switchTo(m)}>{otherLabel[m]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
