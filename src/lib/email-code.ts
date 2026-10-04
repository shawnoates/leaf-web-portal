"use client";

// Email code sign-in — the email twin of the phone OTP flow. The server
// (requestEmailCode / verifyEmailCode) emails a 6-digit code and returns a
// session for the address's account; we adopt it like verifyOTP's, so every
// session-gated call afterwards (follow, /me) runs as that person.

import { useState } from "react";
import Parse from "@/lib/parse-client";

export interface EmailSignedIn {
  userId: string;
  name: string;
  email: string;
  hasPhone: boolean;
}

export function useEmailCodeSignIn(onSignedIn: (who: EmailSignedIn) => void | Promise<void>) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendCode = async () => {
    const e = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) { setError("Enter a valid email address."); return; }
    setBusy(true); setError("");
    try {
      await Parse.Cloud.run("requestEmailCode", { email: e });
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally { setBusy(false); }
  };

  const verify = async () => {
    if (code.replace(/\D/g, "").length !== 6) { setError("Enter the 6-digit code."); return; }
    setBusy(true); setError("");
    try {
      const r = (await Parse.Cloud.run("verifyEmailCode", { email: email.trim(), code })) as {
        sessionToken?: string; userId?: string; name?: string; email?: string; hasPhone?: boolean;
      };
      if (!r?.sessionToken) throw new Error("That code didn't work. Try again.");
      await Parse.User.become(r.sessionToken);
      await onSignedIn({
        userId: r.userId || "",
        name: r.name || "",
        email: r.email || email.trim(),
        hasPhone: !!r.hasPhone,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That code didn't work. Try again.");
    } finally { setBusy(false); }
  };

  const restart = () => { setStep("email"); setCode(""); setError(""); };

  return { email, setEmail, code, setCode: (v: string) => setCode(v.replace(/\D/g, "").slice(0, 6)), step, busy, error, sendCode, verify, restart };
}
