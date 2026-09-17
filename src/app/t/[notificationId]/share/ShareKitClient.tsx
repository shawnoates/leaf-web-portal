"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Download } from "lucide-react";
import { siFacebook, siInstagram, siThreads, siTiktok, siX } from "simple-icons";
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
// all, so the only one-tap path is the OS share sheet with the image attached
// — the host picks the app from the sheet and it opens with the image in the
// composer. X, Threads, LinkedIn and Facebook do have intents — text and a
// link, never an image, which is why those buttons copy the caption first and
// the image travels via the link's own preview. The intents are universal
// links rendered as plain anchors in the same tab: that is the form iOS
// hands to the installed app instead of a browser tab. Nothing about the
// hand-off works from window.open.
type Brand = { path: string; hex: string };

type Target = {
  id: string;
  label: string;
  hint: string;
  brand: Brand;
  kind: "sheet" | "intent";
  href?: (caption: string, url: string) => string;
};

// simple-icons dropped LinkedIn under its brand guidelines; the "in" mark on
// a 24-grid, as the older releases shipped it.
const LINKEDIN: Brand = {
  hex: "0A66C2",
  path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};

const TARGETS: Target[] = [
  {
    id: "instagram",
    label: "Instagram",
    hint: "Story or post · pick Instagram on the share sheet and it opens with the image",
    brand: siInstagram,
    kind: "sheet",
  },
  {
    id: "tiktok",
    label: "TikTok",
    hint: "Pick TikTok on the share sheet and it opens with the image",
    brand: siTiktok,
    kind: "sheet",
  },
  {
    id: "x",
    label: "X",
    hint: "Opens the X app with the caption and link",
    brand: siX,
    kind: "intent",
    href: (caption, url) =>
      `https://x.com/intent/post?text=${encodeURIComponent(caption.replace(url, "").trim())}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "threads",
    label: "Threads",
    hint: "Opens the Threads app with the caption and link",
    brand: siThreads,
    kind: "intent",
    href: (caption) => `https://www.threads.com/intent/post?text=${encodeURIComponent(caption)}`,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    hint: "Opens the LinkedIn app with the link · caption is on your clipboard",
    brand: LINKEDIN,
    kind: "intent",
    href: (_caption, url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: "facebook",
    label: "Facebook",
    hint: "Opens the Facebook app with the link · caption is on your clipboard",
    brand: siFacebook,
    kind: "intent",
    href: (_caption, url) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

function BrandMark({ brand }: { brand: Brand }) {
  return (
    <span
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: `#${brand.hex}` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#fff">
        <path d={brand.path} />
      </svg>
    </span>
  );
}

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

  async function copyText(text: string, quiet = false): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
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

  // The image as a File, fetched ahead of the tap. Safari only lets
  // navigator.share run inside the tap's own activation window, and awaiting
  // a fetch (plus the clipboard) in the handler blew through it — the share
  // threw, and every Instagram tap landed on the "save it by hand" fallback.
  // With the file in hand, the tap goes straight to the sheet.
  // Keyed by URL so a tap right after switching tabs can't share the previous
  // format's card.
  const [fetched, setFetched] = useState<{ url: string; file: File } | null>(null);
  const imageFile = fetched && fetched.url === imageUrl ? fetched.file : null;
  useEffect(() => {
    if (!pack || !imageUrl) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(imageUrl, { signal: controller.signal });
        if (!res.ok) return;
        const blob = await res.blob();
        const file = new File([blob], fileNameFor(format, pack.phase), { type: blob.type || "image/png" });
        setFetched({ url: imageUrl, file });
      } catch {
        // A photo host without CORS: the tap falls back to opening the image.
      }
    })();
    return () => controller.abort();
  }, [pack, imageUrl, format]);

  // The one-tap path for Instagram and TikTok: hand the OS share sheet the
  // image as a file; the host picks the app and it opens in the composer.
  // Something goes to the clipboard as well, because most targets ignore
  // `text` when files are present — and WHAT goes follows the format tab. A
  // story's link has to be a link sticker, and the sticker takes a URL and
  // nothing else, so pasting the caption into it fails (which is exactly what
  // the first version told hosts to do). A post has no sticker; there the
  // caption, link included, is the thing to paste. A recap photo has no tab
  // and goes out with the caption. The clipboard write is started, not
  // awaited, so the share call is still the tap's.
  async function shareWithImage(targetId: string) {
    if (!pack || !imageUrl) return;
    const linkOnly = format === "story" && !usingRecapPhoto;
    setBusy(targetId);
    setNotice(null);
    const clipboard = copyText(linkOnly ? pack.shareUrl : caption, true);
    try {
      if (!imageFile) throw new Error("image");
      await navigator.share({ files: [imageFile], text: caption });
      stamp("share");
      setNotice(
        linkOnly
          ? "Link copied — add a link sticker and paste. The caption's above if you want it too."
          : "Caption copied — paste it in.",
      );
    } catch (e) {
      // Cancelled is not an error. No file (a photo host without CORS) or a
      // refused share falls back to opening the image so they can save it.
      if (e instanceof Error && e.name === "AbortError") return;
      window.open(imageUrl, "_blank", "noopener");
      setNotice("Couldn't attach the image directly — it's open in a new tab. Press and hold to save it, then post.");
    } finally {
      await clipboard;
      setBusy(null);
    }
  }

  // Intents navigate as anchors (see TARGETS); this just seeds the clipboard
  // on the way out. Not awaited, or the navigation would leave first.
  function noteIntent() {
    void copyText(caption, true);
    stamp("share");
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
              onClick={() => copyText(caption)}
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
              const rowClass =
                "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 disabled:hover:bg-white disabled:opacity-60";
              const body = (
                <>
                  <BrandMark brand={t.brand} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-zinc-900">
                      {busy === t.id ? "Opening…" : t.label}
                    </span>
                    <span className="block text-[12px] text-zinc-500">
                      {disabled
                        ? "On your phone: save the image, copy the caption, post from the app"
                        : sheet && !imageFile
                          ? "Getting the image ready…"
                          : t.hint}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={t.id}>
                  {sheet || !t.href ? (
                    <button
                      type="button"
                      disabled={disabled || busy !== null}
                      onClick={() => shareWithImage(t.id)}
                      className={rowClass}
                    >
                      {body}
                    </button>
                  ) : (
                    <a href={t.href(caption, pack.shareUrl)} onClick={noteIntent} className={rowClass}>
                      {body}
                    </a>
                  )}
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
              On a story, a link has to be a sticker — with Story selected, the
              link alone is copied, so add a link sticker and paste. With Post
              selected, the caption is copied. The card carries a QR code too,
              for anyone who&rsquo;d rather scan.
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
