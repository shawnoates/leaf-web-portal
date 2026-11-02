"use client";

/**
 * "Copy host link" for one plan idea (leaflets-server idea-host-invite.js,
 * createIdeaHostLink). The owner sends the link themselves; whoever opens it,
 * verifies a phone and taps Host it becomes the host. Each tap makes a fresh
 * link, which replaces the one before it.
 */

import { useState } from "react";
import { Check, Link2, Loader2 } from "lucide-react";
import Parse from "@/lib/parse-client";

export default function CopyHostLinkButton({
  ideaId,
  className = "",
  label = "Copy host link",
}: {
  ideaId: string;
  className?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "busy" | "copied">("idle");
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function copy() {
    if (state === "busy") return;
    setState("busy");
    setError(null);
    try {
      const r = (await Parse.Cloud.run("createIdeaHostLink", { ideaId })) as { url: string };
      setUrl(r.url);
      try {
        await navigator.clipboard.writeText(r.url);
      } catch {
        // Clipboard can be blocked (permissions, an in-app browser); the link
        // stays on screen to copy by hand.
      }
      setState("copied");
      window.setTimeout(() => setState((s) => (s === "copied" ? "idle" : s)), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t make a link — try again.");
      setState("idle");
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={copy}
        disabled={state === "busy"}
        className={`inline-flex items-center gap-1.5 disabled:opacity-60 ${className}`}
      >
        {state === "busy" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : state === "copied" ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Link2 className="w-3.5 h-3.5" />
        )}
        {state === "copied" ? "Link copied" : label}
      </button>
      {url && (
        <p className="mt-1 text-[11px] text-zinc-400 break-all select-all">
          {url} · Send it to the person who&rsquo;ll host. A new link replaces this one.
        </p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
