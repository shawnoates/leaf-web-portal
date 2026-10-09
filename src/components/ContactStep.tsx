"use client";

// The contact step shared by the follow and RSVP sheets (/org and /p):
// "How should we reach you?" — Text me / Email me — plus the phone-code
// hook it runs on. Moved out of the calendar page so every sheet that asks
// who someone is asks the same way.

import { useEffect, useState } from "react";
import { Check, Loader2, Mail, MessageCircle } from "lucide-react";
import Parse from "@/lib/parse-client";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { useEmailCodeSignIn } from "@/lib/email-code";
import { getVerifiedUserCookie, setVerifiedUserCookie } from "@/lib/verified-user";

export function formatPhoneNumber(value: string) {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

// --- Phone Verify Hook ---
export function usePhoneVerify(options?: { requireSession?: boolean }) {
  const cached = getVerifiedUserCookie();
  const [name, setName] = useState(cached?.name || "");
  const [phone, setPhone] = useState(cached?.phone || "");
  const [code, setCode] = useState("");
  // The cookie proves a phone, not an account. Callers whose cloud function
  // calls requireUser pass requireSession, so a cached cookie can't skip OTP
  // here — only verifyOTP mints the session token those writes need. Name and
  // phone still prefill either way.
  const [step, setStep] = useState<"phone" | "code" | "verified">(
    cached && !options?.requireSession ? "verified" : "phone"
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // Exposed for callers that need a real Parse session, not just the phone
  // cookie — `requireUser` cloud functions won't accept the cookie identity.
  // Additive: existing callers ignore it and keep their cookie-only behavior.
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const isVerified = step === "verified";

  const sendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setError("Please enter a valid phone number."); return; }
    setSending(true);
    setError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally { setSending(false); }
  };

  const verifyOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    setSending(true);
    setError("");
    try {
      const result = await Parse.Cloud.run("verifyOTP", { phone: `+1${digits}`, code, name: name.trim() });
      if (result && typeof result === "object" && result.sessionToken) {
        // The session is the proof the server checks; the cookie only
        // remembers name + phone for the next form.
        await Parse.User.become(result.sessionToken as string);
        setStep("verified");
        setSessionToken(result.sessionToken as string);
        setVerifiedUserCookie(name, phone);
        return true;
      } else {
        setError("Invalid code. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.");
    } finally { setSending(false); }
    return false;
  };

  const reset = () => {
    setStep("phone");
    setCode("");
    setError("");
  };

  return { name, setName, phone, setPhone, code, setCode, step, isVerified, sending, setSending, error, sendOTP, verifyOTP, reset, sessionToken };
}

// --- "How should we reach you?" (follow + RSVP sheets) ---
//
// One question, two tabs. Each tab shows only its own fields and one button
// whose label names the next step: Text me a code → <action>; Email me a code
// → <action>. Someone already signed in gets their number or address shown as
// verified with a one-tap <action> and "Not you?" (signs this browser out, for
// shared devices). onConfirmed fires once identity is settled, with the phone
// ("" for email) and which channel they chose.

export type ContactChoice = { name: string; phone: string; notify: "text" | "email" };

function readContactSession() {
  const u = Parse.User.current();
  if (!u) return null;
  return {
    phone: String(u.get("phone") || ""),
    email: String(u.get("email") || ""),
    name: String(u.get("full_name") || u.get("name") || ""),
  };
}

export function ContactStep({
  verify,
  brandColor,
  actionLabel,
  busy,
  onConfirmed,
  allowEmail = true,
  notes,
  extras,
  renderVerifiedAction,
}: {
  verify: ReturnType<typeof usePhoneVerify>;
  brandColor?: string;
  /** What the final button does: "Follow", "Confirm RSVP", "Join waitlist"… */
  actionLabel: string;
  busy: boolean;
  onConfirmed: (who: ContactChoice) => void | Promise<void>;
  allowEmail?: boolean;
  notes?: { text?: string; email?: string };
  /** Extra fields above the final button (a note for the host, checkboxes). */
  extras?: (state: { method: "text" | "email"; verified: boolean }) => React.ReactNode;
  /** Replaces the final button once the phone is verified (paid tickets). */
  renderVerifiedAction?: () => React.ReactNode;
}) {
  const [session, setSession] = useState(readContactSession);
  // The browser keeps its own copy of the signed-in account, which can lag
  // (an old address after a merge). Refresh it so the verified row shows the
  // address the confirmation will actually go to.
  useEffect(() => {
    const u = Parse.User.current();
    if (!u) return;
    let live = true;
    u.fetch().then(() => { if (live) setSession(readContactSession()); }).catch(() => { /* keep the cached copy */ });
    return () => { live = false; };
  }, []);
  const [method, setMethod] = useState<"text" | "email">(() =>
    allowEmail && Parse.User.current() && !Parse.User.current()?.get("phone") ? "email" : "text");
  const [googleError, setGoogleError] = useState("");
  const [emailName, setEmailName] = useState(() => readContactSession()?.name || "");
  const emailSignIn = useEmailCodeSignIn(async (who) => {
    setSession(readContactSession());
    await onConfirmed({ name: who.name || emailName.trim(), phone: "", notify: "email" });
  });

  const notYou = async () => {
    try { await Parse.User.logOut(); } catch { /* already signed out */ }
    document.cookie = "leaf_verified_user=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    try { localStorage.removeItem("leaf_follower_phone"); } catch { /* storage off */ }
    setSession(null);
    verify.reset();
    verify.setName("");
    verify.setPhone("");
  };

  const submitText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verify.step === "phone") { await verify.sendOTP(); return; }
    if (verify.step === "code") {
      if (await verify.verifyOTP()) await onConfirmed({ name: verify.name, phone: verify.phone, notify: "text" });
      return;
    }
    await onConfirmed({ name: verify.name, phone: verify.phone, notify: "text" });
  };

  const inputCls = "w-full rounded-xl border border-zinc-200 px-4 py-3 text-base focus:outline-none focus:border-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500";
  const primaryCls = "w-full rounded-xl text-white py-3.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40";
  const primaryStyle = { backgroundColor: brandColor || "#18181b" };
  const spinner = <Loader2 className="w-4 h-4 animate-spin mx-auto" />;
  const verifiedRow = (label: string) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3">
      <span className="flex items-center gap-2 text-sm min-w-0">
        <Check className="w-4 h-4 shrink-0 text-emerald-600" />
        <span className="truncate">{label}</span>
      </span>
      <button type="button" onClick={notYou} className="text-xs text-zinc-500 underline shrink-0">Not you?</button>
    </div>
  );
  const codeInput = (value: string, onChange: (v: string) => void, sentTo: string, onChangeTarget: () => void, targetWord: string) => (
    <div className="space-y-2">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder="6-digit code"
        className={`${inputCls} tracking-[0.3em]`}
      />
      <p className="text-xs text-zinc-500">
        Sent to {sentTo}.{" "}
        <button type="button" onClick={onChangeTarget} className="underline">Change {targetWord}</button>
      </p>
    </div>
  );

  return (
    <div className="space-y-5">
      {allowEmail && (
        <div>
          <p className="text-xs font-semibold text-zinc-700 mb-2">How should we reach you?</p>
          <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100">
            {(["text", "email"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={method === m}
                onClick={() => setMethod(m)}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  method === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {m === "text" ? <MessageCircle className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                {m === "text" ? "Text me" : "Email me"}
              </button>
            ))}
          </div>
        </div>
      )}

      {method === "text" ? (
        <form onSubmit={submitText} className="space-y-4">
          {verify.isVerified ? (
            verifiedRow(verify.phone)
          ) : (
            <>
              <input
                type="text"
                value={verify.name}
                onChange={(e) => verify.setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                disabled={verify.step === "code"}
                className={inputCls}
              />
              {verify.step === "phone" ? (
                <input
                  type="tel"
                  value={verify.phone}
                  onChange={(e) => verify.setPhone(formatPhoneNumber(e.target.value))}
                  placeholder="Mobile number"
                  autoComplete="tel-national"
                  className={inputCls}
                />
              ) : codeInput(verify.code, verify.setCode, verify.phone, verify.reset, "number")}
            </>
          )}
          {verify.error && <p className="text-xs text-red-600">{verify.error}</p>}
          {extras?.({ method: "text", verified: verify.isVerified })}
          {verify.isVerified && renderVerifiedAction ? (
            renderVerifiedAction()
          ) : (
            <button
              type="submit"
              disabled={
                busy || verify.sending ||
                (verify.step === "phone" && (!verify.name.trim() || verify.phone.replace(/\D/g, "").length < 10)) ||
                (verify.step === "code" && verify.code.length < 6)
              }
              className={primaryCls}
              style={primaryStyle}
            >
              {busy || verify.sending ? spinner : verify.step === "phone" ? "Text me a code" : actionLabel}
            </button>
          )}
          {notes?.text && <p className="text-center text-xs text-zinc-400">{notes.text}</p>}
        </form>
      ) : (
        <div className="space-y-4">
          {session?.email ? (
            <>
              {verifiedRow(session.email)}
              {extras?.({ method: "email", verified: true })}
              <button
                type="button"
                disabled={busy}
                onClick={() => onConfirmed({ name: session.name, phone: "", notify: "email" })}
                className={primaryCls}
                style={primaryStyle}
              >
                {busy ? spinner : actionLabel}
              </button>
            </>
          ) : (
            <>
              <GoogleSignInButton
                fullWidth
                ignoreExistingSession
                onSignIn={(u) => {
                  const user = u as unknown as Parse.User;
                  setSession(readContactSession());
                  const name = String(user?.get?.("full_name") || user?.get?.("name") || "");
                  void onConfirmed({ name, phone: "", notify: "email" });
                }}
                onError={(msg) => setGoogleError(msg)}
              />
              {googleError && <p className="text-xs text-red-600">{googleError}</p>}
              <div className="flex items-center gap-3 text-xs text-zinc-400">
                <span className="h-px flex-1 bg-zinc-200" />or<span className="h-px flex-1 bg-zinc-200" />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (emailSignIn.step === "email") void emailSignIn.sendCode();
                  else void emailSignIn.verify();
                }}
                className="space-y-4"
              >
                {emailSignIn.step === "email" ? (
                  <>
                    <input
                      type="text"
                      value={emailName}
                      onChange={(e) => setEmailName(e.target.value)}
                      placeholder="Your name"
                      autoComplete="name"
                      className={inputCls}
                    />
                    <input
                      type="email"
                      value={emailSignIn.email}
                      onChange={(e) => emailSignIn.setEmail(e.target.value)}
                      placeholder="Email address"
                      autoComplete="email"
                      className={inputCls}
                    />
                  </>
                ) : codeInput(emailSignIn.code, emailSignIn.setCode, emailSignIn.email, emailSignIn.restart, "email")}
                {emailSignIn.error && <p className="text-xs text-red-600">{emailSignIn.error}</p>}
                {extras?.({ method: "email", verified: false })}
                <button
                  type="submit"
                  disabled={
                    busy || emailSignIn.busy ||
                    (emailSignIn.step === "email" && (!emailName.trim() || !emailSignIn.email.includes("@"))) ||
                    (emailSignIn.step === "code" && emailSignIn.code.length < 6)
                  }
                  className={primaryCls}
                  style={primaryStyle}
                >
                  {busy || emailSignIn.busy ? spinner : emailSignIn.step === "email" ? "Email me a code" : actionLabel}
                </button>
              </form>
            </>
          )}
          {notes?.email && <p className="text-center text-xs text-zinc-400">{notes.email}</p>}
        </div>
      )}
    </div>
  );
}
