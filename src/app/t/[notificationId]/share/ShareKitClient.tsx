"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Download, Share2 } from "lucide-react";
import Parse from "@/lib/parse-client";

export type SharePack = {
  notificationId: string;
  planId: string;
  taskId: string | null;
  staff: boolean;
  phase: "before" | "after";
  title: string;
  whenLabel: string | null;
  neighborhood: string | null;
  calendarName: string | null;
  dateISO: string | null;
  checklistUrl: string;
  going: number;
  postImageUrl: string;
  storyImageUrl: string;
  caption: string;
  shareUrl: string;
  shareKitUrl: string | null;
  /** The host's own attendance photos, after the night, staff seats only. */
  recapPhotos: string[];
};

type Format = "post" | "story";
type Action = "copy" | "image" | "share";

// What each network can actually take from a web page. This table is the
// honest part of the feature: Instagram and TikTok expose no web intent at
// all, so the only one-tap path is the OS share sheet with the image attached.
// X, Threads, LinkedIn and Facebook do have intents — text and a link, never
// an image, which is why those buttons copy the caption first and the image
// travels via the link's own preview.
type Target = {
  id: string;
  label: string;
  hint: string;
  kind: "sheet" | "intent";
  href?: (caption: string, url: string) => string;
};

const TARGETS: Target[] = [
  {
    id: "instagram",
    label: "Instagram",
    hint: "Story or post · opens the share sheet with the image",
    kind: "sheet",
  },
  {
    id: "tiktok",
    label: "TikTok",
    hint: "Opens the share sheet with the image",
    kind: "sheet",
  },
  {
    id: "x",
    label: "X",
    hint: "Opens a post with the caption and link",
    kind: "intent",
    href: (caption, url) =>
      `https://x.com/intent/post?text=${encodeURIComponent(caption.replace(url, "").trim())}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "threads",
    label: "Threads",
    hint: "Opens a post with the caption and link",
    kind: "intent",
    href: (caption) => `https://www.threads.net/intent/post?text=${encodeURIComponent(caption)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    hint: "Opens a post with the link · caption is on your clipboard",
    kind: "intent",
    href: (_caption, url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    hint: "Opens a post with the link · caption is on your clipboard",
    kind: "intent",
    href: (_caption, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

function fileNameFor(format: Format, phase: SharePack["phase"]): string {
  return `leaf-${phase === "after" ? "recap" : "plan"}-${format}.png`;
}

export default function ShareKitClient({
  notificationId,
  initial,
  initialError,
}: {
  notificationId: string;
  initial: SharePack | null;
  initialError: string | null;
}) {
  const pack = initial;
  const [format, setFormat] = useState<Format>("story");
  const [caption, setCaption] = useState(pack?.caption ?? "");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  // After the night, a roster host picks one of the photos they uploaded.
  const [photoIdx, setPhotoIdx] = useState(0);

  // Feature-detected after mount: navigator doesn't exist during SSR and
  // rendering by it on the server would mismatch on hydration.
  useEffect(() => {
    try {
      const probe = new File([new Uint8Array(1)], "probe.png", { type: "image/png" });
      setCanShareFiles(
        typeof navigator !== "undefined"
          && typeof navigator.share === "function"
          && typeof navigator.canShare === "function"
          && navigator.canShare({ files: [probe] }),
      );
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  const stamp = useCallback(
    (action: Action) => {
      // Fire and forget. A dropped analytics write must never take a button
      // down with it. Intent only — see recordHostTaskShare.
      Parse.Cloud.run("recordHostTaskShare", {
        taskId: pack?.taskId ?? null,
        notificationId,
        action,
      }).catch(() => {});
    },
    [pack?.taskId, notificationId],
  );

  // The image being shared right now: after the night with photos, the chosen
  // photo; otherwise the composited card in the chosen format.
  const usingRecapPhoto = Boolean(pack && pack.phase === "after" && pack.recapPhotos.length > 0);
  const imageUrl = useMemo(() => {
    if (!pack) return null;
    if (usingRecapPhoto) return pack.recapPhotos[Math.min(photoIdx, pack.recapPhotos.length - 1)];
    return format === "story" ? pack.storyImageUrl : pack.postImageUrl;
  }, [pack, usingRecapPhoto, photoIdx, format]);

  async function copyCaption(quiet = false): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(caption);
      if (!quiet) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      stamp("copy");
      return true;
    } catch {
      return false;
    }
  }

  // The one-tap path for Instagram and TikTok: fetch the image, hand it to
  // the OS share sheet as a file. The caption goes to the clipboard first
  // because most targets ignore `text` when files are present.
  async function shareWithImage(targetId: string) {
    if (!pack || !imageUrl) return;
    setBusy(targetId);
    setNotice(null);
    try {
      await copyCaption(true);
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error("image");
      const blob = await res.blob();
      const file = new File([blob], fileNameFor(format, pack.phase), { type: blob.type || "image/png" });
      await navigator.share({ files: [file], text: caption });
      stamp("share");
      setNotice("Caption's on your clipboard — paste it in, and add a link sticker on a story.");
    } catch (e) {
      // Cancelled is not an error. A blocked fetch (a photo host without CORS)
      // falls back to opening the image so they can save it by hand.
      if (e instanceof Error && e.name === "AbortError") return;
      if (imageUrl) window.open(imageUrl, "_blank", "noopener");
      setNotice("Couldn't attach the image directly — it's open in a new tab. Press and hold to save it, then post.");
    } finally {
      setBusy(null);
    }
  }

  async function openIntent(t: Target) {
    if (!pack || !t.href) return;
    await copyCaption(true);
    stamp("share");
    window.open(t.href(caption, pack.shareUrl), "_blank", "noopener");
  }

  if (!pack) {
    return (
      <main className="min-h-dvh bg-zinc-50 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-lg font-semibold text-zinc-900">No share kit here</h1>
          <p className="text-sm text-zinc-500 mt-2">{initialError || "The link may have expired."}</p>
        </div>
      </main>
    );
  }

  const after = pack.phase === "after";

  return (
    <main className="min-h-dvh bg-zinc-50">
      <div className="mx-auto w-full max-w-lg bg-white min-h-dvh sm:min-h-0 sm:my-8 sm:rounded-2xl sm:shadow-sm sm:border sm:border-zinc-200 overflow-hidden">
        <header className="px-5 pt-5 pb-4 border-b border-zinc-100">
          <a
            href={pack.checklistUrl}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Your checklist
          </a>
          <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mt-3">
            {after ? "After the night" : "Share kit"}
          </p>
          <h1 className="text-xl font-semibold text-zinc-900 mt-1 leading-snug text-balance">
            {after ? "Show them how it went" : "Get a few more people there"}
          </h1>
          <p className="text-sm text-zinc-600 mt-2">
            {after
              ? "Post a photo from the night with the link to the next one. Optional, as always."
              : "An image, a caption and the link, ready to post. Optional, and it works: a plan with nobody on it gets called off."}
          </p>
          {pack.staff && (
            <p className="text-[12px] text-zinc-400 mt-2">
              Not part of the gig, and your pay is the same either way. The caption
              says Leaf pays you to host — keep that in.
            </p>
          )}
        </header>

        {/* Preview */}
        <section className="px-5 pt-5">
          {usingRecapPhoto ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Pick a photo
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {pack.recapPhotos.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setPhotoIdx(i)}
                    aria-pressed={i === photoIdx}
                    className={`shrink-0 rounded-lg overflow-hidden border-2 ${
                      i === photoIdx ? "border-zinc-900" : "border-transparent"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-20 w-20 object-cover" />
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2 mt-3">
                Only post a photo of people who said it&rsquo;s fine. Faces are theirs, not ours.
              </p>
            </>
          ) : (
            <div className="flex items-center gap-1 mb-3" role="tablist" aria-label="Format">
              {(["story", "post"] as Format[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={format === f}
                  onClick={() => setFormat(f)}
                  className={`text-[13px] font-medium rounded-full px-3 py-1.5 transition-colors ${
                    format === f ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {f === "story" ? "Story · 9:16" : "Post · 4:5"}
                </button>
              ))}
            </div>
          )}

          {imageUrl && (
            <div
              className={`mx-auto rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 ${
                usingRecapPhoto ? "max-w-[320px]" : format === "story" ? "max-w-[240px]" : "max-w-[300px]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={imageUrl}
                src={imageUrl}
                alt="Preview of what you'll post"
                className="w-full h-auto block"
              />
            </div>
          )}
        </section>

        {/* Caption */}
        <section className="px-5 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Caption — yours to change
          </p>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={Math.min(10, Math.max(4, Math.ceil(caption.length / 40)))}
            aria-label="Caption"
            className="w-full text-[14px] leading-relaxed text-zinc-900 bg-white border border-zinc-200 rounded-lg p-3 outline-none focus:border-zinc-400 resize-none"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => copyCaption()}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy caption"}
            </button>
            {imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => stamp("image")}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Save image
              </a>
            )}
          </div>
        </section>

        {/* Targets */}
        <section className="px-5 pt-6 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Post to
          </p>
          <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
            {TARGETS.map((t) => {
              const sheet = t.kind === "sheet";
              const disabled = sheet && !canShareFiles;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={disabled || busy !== null}
                    onClick={() => (sheet ? shareWithImage(t.id) : openIntent(t))}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 disabled:hover:bg-white disabled:opacity-60"
                  >
                    <span className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center shrink-0">
                      <Share2 className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-zinc-900">
                        {busy === t.id ? "Opening…" : t.label}
                      </span>
                      <span className="block text-[12px] text-zinc-500">
                        {disabled
                          ? "On your phone: save the image, copy the caption, post from the app"
                          : t.hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {notice && (
            <p className="text-[13px] text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 mt-3">
              {notice}
            </p>
          )}
          {!after && (
            <p className="text-[12px] text-zinc-400 mt-3 leading-relaxed">
              On a story, a link has to be a sticker — the link is copied with the
              caption, so add a link sticker and paste. The card shows the address
              too, for anyone who&rsquo;d rather type it.
            </p>
          )}
        </section>

        <footer className="px-5 py-6 text-center">
          <p className="text-[12px] text-zinc-400">
            Nothing is posted from Leaf. Everything sends from your own apps.
          </p>
        </footer>
      </div>
    </main>
  );
}
