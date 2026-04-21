"use client";

import { useState } from "react";
import Parse from "@/lib/parse-client";
import { X, Phone, ShieldCheck, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface PhoneVerificationModalProps {
  onVerified: () => void;
  onClose: () => void;
}

export default function PhoneVerificationModal({ onVerified, onClose }: PhoneVerificationModalProps) {
  const [step, setStep] = useState<"phone" | "code" | "done" | "not_found">("phone");
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
      // Refresh the local cached user so leafAppConnected persists across page reloads
      await Parse.User.current()?.fetch();
      setStep("done");
      onVerified();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed.";
      if (message.includes("No Leaf app account found")) {
        setStep("not_found");
      } else {
        setError(message);
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
                <Smartphone className="w-5 h-5 text-zinc-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Connect to Leaf app</h3>
                <p className="text-xs text-zinc-500">Verify the phone number linked to your Leaf app account</p>
              </div>
            </div>

            <p className="text-xs text-zinc-500 leading-relaxed">
              Enter the phone number you use in the Leaf mobile app. We&apos;ll verify it and connect your accounts.
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
            <h3 className="text-sm font-semibold text-zinc-900">Connected to Leaf app</h3>
            <p className="text-xs text-zinc-500">Your web account is now linked to your Leaf app account.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}

        {step === "not_found" && (
          <div className="text-center space-y-4 py-4">
            <h3 className="text-sm font-semibold text-zinc-900">No Leaf app account found</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              We couldn&apos;t find a Leaf app account with this phone number. Scan the QR code to download the app and create an account, then come back to connect.
            </p>
            <div className="flex justify-center">
              <a
                href="https://apps.apple.com/us/app/leaf-build-your-community/id1040588046"
                target="_blank"
                rel="noopener noreferrer"
              >
                <QRCodeSVG
                  value="https://apps.apple.com/us/app/leaf-build-your-community/id1040588046"
                  size={140}
                  level="M"
                />
              </a>
            </div>
            <button
              onClick={() => { setStep("phone"); setCode(""); setError(""); }}
              className="text-xs text-zinc-500 hover:text-zinc-900 underline"
            >
              Try a different number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
