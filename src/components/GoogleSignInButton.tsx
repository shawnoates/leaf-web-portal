"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Parse from "@/lib/parse-client";
import { Check, Loader2 } from "lucide-react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

// Module-level script loading (same pattern as CityAutocomplete)
let gisLoading = false;
let gisLoaded = false;

function loadGIS(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  if (gisLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (gisLoaded) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  gisLoading = true;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gisLoaded = true;
      gisLoading = false;
      resolve();
    };
    script.onerror = () => {
      gisLoading = false;
      reject(new Error("Failed to load Google Sign-In"));
    };
    document.head.appendChild(script);
  });
}

interface GoogleSignInButtonProps {
  onSignIn: (user: typeof Parse.User) => void;
  onError: (error: string) => void;
}

interface GoogleUser {
  name: string;
  email: string;
}

export default function GoogleSignInButton({
  onSignIn,
  onError,
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [buttonRendered, setButtonRendered] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signedInUser, setSignedInUser] = useState<GoogleUser | null>(null);

  const handleCredentialResponse = useCallback(
    async (response: google.accounts.id.CredentialResponse) => {
      setSigningIn(true);
      try {
        const jwt = response.credential;

        // Use server-side cloud function to handle auth (handles existing accounts)
        const result = await Parse.Cloud.run("googleSignIn", {
          idToken: jwt,
        });

        // Become the user with the returned session token
        const user = await Parse.User.become(result.sessionToken);

        setSignedInUser({
          name: result.name || "",
          email: result.email || "",
        });
        onSignIn(user);
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : "Sign-in failed. Please try again."
        );
      } finally {
        setSigningIn(false);
      }
    },
    [onSignIn, onError]
  );

  // Load GIS script + check existing session in parallel
  useEffect(() => {
    // Always load GIS as a fallback
    if (GOOGLE_CLIENT_ID) {
      loadGIS()
        .then(() => setScriptReady(true))
        .catch(() => onError("Failed to load Google Sign-In"));
    }

    // Check for existing Parse session
    try {
      const currentUser = Parse.User.current();
      if (currentUser) {
        currentUser.fetch().then((fetched: typeof Parse.User) => {
          const name = fetched.get("full_name") || fetched.get("name") || "";
          const email = fetched.get("email") || fetched.getEmail() || "";
          if (name || email) {
            setSignedInUser({ name, email });
            onSignIn(fetched);
          }
        }).catch(async () => {
          // Session expired or invalid auth — clear everything
          try { await Parse.User.logOut(); } catch { /* ignore */ }
        });
      }
    } catch { /* Parse not initialized */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render button once script is ready AND the div is mounted
  useEffect(() => {
    if (!scriptReady || buttonRendered || signedInUser) return;
    if (!buttonRef.current) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });

    google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: 320,
    });

    setButtonRendered(true);
  }, [scriptReady, buttonRendered, signedInUser, handleCredentialResponse]);

  if (signedInUser) {
    return (
      <div className="flex items-center gap-3 p-4 bg-zinc-50 border border-zinc-200">
        <div className="w-8 h-8 bg-zinc-900 text-white flex items-center justify-center rounded-full shrink-0">
          <Check className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{signedInUser.name}</p>
          <p className="text-xs text-zinc-500 truncate">{signedInUser.email}</p>
        </div>
      </div>
    );
  }

  if (signingIn) {
    return (
      <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Signing in...
      </div>
    );
  }

  return (
    <div ref={buttonRef}>
      {!scriptReady && (
        <div className="flex items-center gap-2 text-zinc-400 text-sm py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      )}
    </div>
  );
}
