"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import Parse from "@/lib/parse-client";
import { COPY } from "@/app/me/buildingIntroCopy";

export interface BuildingIntroComposerPayload {
  firstName: string;
  calendarName: string;
  link: string;
  artifacts: ("email" | "dm" | "flyer")[];
  email?: { cc: string; subject: string; body: string; mailto: string };
  dm?: { body: string };
  flyer?: { url: string };
}

type SentEvent = "mailto_opened" | "copy_used" | "flyer_opened";

/**
 * The artifacts a `yes` earns (spec §9): one block per channel family, each
 * with the text ready to edit and the one action that sends it. Shared by the
 * post-follow modal and the /me card; the caller owns the surrounding chrome.
 */
export default function BuildingIntroComposer({
  composer,
  calendarId,
  surface,
  preview = false,
  resurfaced = false,
  accent = "#18181b",
  onDone,
}: {
  composer: BuildingIntroComposerPayload;
  calendarId: string | null;
  surface: "post_follow" | "me_card";
  preview?: boolean;
  resurfaced?: boolean;
  accent?: string;
  onDone: () => void;
}) {
  const base = { surface, calendarId, preview };
  const renderedRef = useRef(false);
  const [copied, setCopied] = useState<"email" | "dm" | null>(null);

  useEffect(() => {
    if (!resurfaced || renderedRef.current) return;
    renderedRef.current = true;
    Parse.Cloud.run("recordBuildingIntroEvent", { event: "composer_rendered", ...base }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resurfaced, calendarId]);

  function record(event: SentEvent) {
    Parse.Cloud.run("recordBuildingIntroEvent", { event, ...base }).catch(() => {});
  }

  async function copy(which: "email" | "dm", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      record("copy_used");
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      /* clipboard blocked; the text is selectable */
    }
  }

  const block = "border border-zinc-200 rounded-lg p-3 space-y-2";
  const label = "text-xs font-bold uppercase tracking-widest text-zinc-500";
  const body = "text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto select-text";
  const ghost = "text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 disabled:opacity-50";
  const solid = "inline-flex items-center gap-1.5 text-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90";

  return (
    <div className="space-y-4 text-left">
      <div>
        <h3 className="text-2xl font-light tracking-tight">{COPY.composer.title}</h3>
        <p className="text-sm text-zinc-500 mt-1">{COPY.composer.sub}</p>
      </div>

      {composer.email && (
        <div className={block}>
          <div className={label}>{COPY.composer.email.label}</div>
          <div className="text-sm font-medium text-zinc-900">{composer.email.subject}</div>
          <div className={body}>{composer.email.body}</div>
          <p className="text-xs text-zinc-500">{COPY.composer.email.hint}</p>
          <div className="flex items-center gap-4 pt-1">
            <a
              href={composer.email.mailto}
              onClick={() => record("mailto_opened")}
              className={solid}
              style={{ backgroundColor: accent }}
            >
              {COPY.composer.email.open}
            </a>
            <button
              type="button"
              className={ghost}
              onClick={() => copy("email", `${composer.email!.subject}\n\n${composer.email!.body}`)}
            >
              {copied === "email" ? COPY.composer.copied : COPY.composer.copy}
            </button>
          </div>
        </div>
      )}

      {composer.dm && (
        <div className={block}>
          <div className={label}>{COPY.composer.dm.label}</div>
          <div className={body}>{composer.dm.body}</div>
          <div className="pt-1">
            <button type="button" className={ghost} onClick={() => copy("dm", composer.dm!.body)}>
              {copied === "dm" ? COPY.composer.copied : COPY.composer.copy}
            </button>
          </div>
        </div>
      )}

      {composer.flyer && (
        <div className={block}>
          <div className={label}>{COPY.composer.flyer.label}</div>
          <p className="text-xs text-zinc-500">{COPY.composer.flyer.hint}</p>
          <a
            href={composer.flyer.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => record("flyer_opened")}
            className={`${solid} rounded`}
            style={{ backgroundColor: accent }}
          >
            {COPY.composer.flyer.open}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {composer.artifacts.length === 0 && (
        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
      )}

      <div className="text-center pt-1">
        <button type="button" onClick={onDone} className={ghost}>{COPY.composer.done}</button>
      </div>
    </div>
  );
}
