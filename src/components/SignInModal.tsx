"use client";

import { useEffect } from "react";
import Parse from "@/lib/parse-client";
import { X } from "lucide-react";
import GoogleSignInButton from "@/components/GoogleSignInButton";

// Reusable sign-in overlay. Used by /cal/[slug] to prompt an unauth
// visitor to sign in before adopting a calendar — replaces the earlier
// `router.push("/dashboard?signInReturnTo=...")` bounce with an in-place
// modal so the visitor doesn't lose the calendar they're looking at.
//
// Props:
//   onClose      — dismiss handler (backdrop click, X button, ESC)
//   onSignedIn   — fires with the Parse user after successful auth
//   title        — headline copy above the button
//   subtitle     — one-line explainer below the headline
export default function SignInModal({
  onClose,
  onSignedIn,
  title,
  subtitle,
}: {
  onClose: () => void;
  onSignedIn: (user: typeof Parse.User) => void;
  title: string;
  subtitle?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock body scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "rgba(15, 18, 16, 0.72)", backdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl p-8 md:p-10 relative flex flex-col gap-6"
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 transition-colors"
          aria-label="Close"
          style={{ color: "#6B7168" }}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col gap-2 pr-8">
          <h2
            className="m-0 text-[22px] tracking-tight"
            style={{
              color: "#131714",
              fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
              fontWeight: 400,
              lineHeight: 1.15,
              textWrap: "balance",
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="m-0 text-[14px] leading-relaxed"
              style={{ color: "#6B7168" }}
            >
              {subtitle}
            </p>
          )}
        </div>

        <GoogleSignInButton
          onSignIn={(u) => onSignedIn(u)}
          onError={(err) => console.error("[SignInModal] sign-in error:", err)}
        />

        <p className="text-[11px] text-center m-0" style={{ color: "#9EA39C" }}>
          By continuing, you agree to Leaf&apos;s terms of use.
        </p>
      </div>
    </div>
  );
}
