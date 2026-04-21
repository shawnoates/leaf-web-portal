"use client";

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { X, Phone, ShieldCheck } from "lucide-react";

interface PhoneVerificationModalProps {
  onVerified: (phone: string) => void;
  onClose: () => void;
}

export default function PhoneVerificationModal({ onVerified, onClose }: PhoneVerificationModalProps) {
  const [step, setStep] = useState<"phone" | "code" | "done">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const sendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await Parse.Cloud.run("requestOTP", { phone: `+1${digits}` });
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code.");
    } finally {
      setSending(false);
    }
  };

  const verifyOTP = async () => {
    if (code.length < 4) {
      setError("Please enter the full code.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    setSending(true);
    setError("");
    try {
      await Parse.Cloud.run("verifyPhoneForUser", { phone: `+1${digits}`, code });
      setStep("done");
      onVerified(`+1${digits}`);
    } catch (err: unknown) {
      // Fallback: try the existing verifyOTP and then update user manually
      try {
        await Parse.Cloud.run("verifyOTP", { phone: `+1${digits}`, code });
        // Update the current user's phone
        const user = Parse.User.current();
        if (user) {
          user.set("phone", `+1${digits}`);
          user.set("lookup_phone", `+1${digits}`);
          await user.save();
        }
        setStep("done");
        onVerified(`+1${digits}`);
      } catch (innerErr: unknown) {
        setError(innerErr instanceof Error ? innerErr.message : "Invalid code. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600"
        >
          <X className="w-4 h-4" />
        </button>

        {step === "phone" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
                <Phone className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Verify your phone</h3>
                <p className="text-xs text-zinc-500">Connect your account to the Leaf app</p>
              </div>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              Adding your phone number lets you manage plans from the Leaf mobile app and receive notifications when members RSVP.
            </p>

            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Phone number</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">+1</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  placeholder="(555) 123-4567"
                  className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              onClick={sendOTP}
              disabled={sending}
              className="w-full py-2.5 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending..." : "Send verification code"}
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Enter verification code</h3>
                <p className="text-xs text-zinc-500">Sent to +1 {phone}</p>
              </div>
            </div>

            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter code"
                className="w-full px-3 py-2 text-sm text-center tracking-[0.3em] border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300"
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              onClick={verifyOTP}
              disabled={sending}
              className="w-full py-2.5 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {sending ? "Verifying..." : "Verify"}
            </button>

            <button
              onClick={() => { setStep("phone"); setCode(""); setError(""); }}
              className="w-full text-xs text-zinc-400 hover:text-zinc-600"
            >
              Use a different number
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center space-y-3 py-4">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900">Phone verified</h3>
            <p className="text-xs text-zinc-500">Your account is now connected to the Leaf app.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
