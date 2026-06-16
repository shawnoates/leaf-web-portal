"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Parse from "@/lib/parse-client";
import {
  Building2,
  Check,
  Copy,
  Loader2,
  MessageSquareShare,
  XCircle,
} from "lucide-react";

type Status = "claimed" | "pending";

interface SplitterResult {
  status: Status;
  shareId?: string;
  calendarName?: string;
  buildingName?: string;
  formattedAddress?: string;
  rmName?: string;
  claimUrl?: string;
}

export default function BuildingSplitterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [result, setResult] = useState<SplitterResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Parse.Cloud.run("getBuildingFromToken", { token })
      .then((r: SplitterResult) => {
        if (r.status === "claimed" && r.shareId) {
          router.replace(`/org/${r.shareId}`);
          return;
        }
        setResult(r);
      })
      .catch((e: Error) => setError(e.message));
  }, [token, router]);

  if (error) {
    return (
      <Centered>
        <XCircle className="w-12 h-12 text-red-500" />
        <h1 className="text-xl font-semibold mt-4">Link not found</h1>
        <p className="text-sm text-zinc-500 mt-2 text-center max-w-xs">
          {error}
        </p>
        <p className="text-xs text-zinc-400 mt-4 text-center max-w-xs">
          If a rep gave you this link, ask them to resend.
        </p>
      </Centered>
    );
  }

  if (!result || result.status === "claimed") {
    // While redirecting to /org/<shareId>
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </Centered>
    );
  }

  // status === "pending"
  const claimUrl = result.claimUrl ?? "";
  const buildingName = result.buildingName || "This building";
  const rmName = result.rmName;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(claimUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const smsBody =
    `Hey${rmName ? ` ${rmName}` : ""} — a Leaf rep set up a free shared calendar for ${buildingName}. ` +
    `Takes 30 seconds to claim: ${claimUrl}`;
  const smsHref = `sms:?&body=${encodeURIComponent(smsBody)}`;

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 flex items-center justify-center">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm w-full max-w-md overflow-hidden">
        <div
          style={{
            background:
              "linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)",
          }}
          className="px-6 py-7 text-white"
        >
          <div className="text-[11px] tracking-[0.25em] uppercase font-semibold opacity-85 inline-flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            Leaf · Shared calendar
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight mt-3">
            {buildingName}&apos;s calendar is pending
          </h1>
          <p className="text-sm font-light opacity-95 leading-relaxed mt-3">
            We&apos;re waiting on
            {rmName ? <> <strong>{rmName}</strong> (your building manager)</> : <> the building manager</>}
            {" "}to claim it. Want to help?
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-zinc-700 leading-relaxed">
            Text or copy this link to your building manager. Once they claim
            (30 seconds), this same page will take you straight to the live
            calendar.
          </p>

          <a
            href={smsHref}
            className="w-full inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold uppercase tracking-widest px-4 py-3 rounded-lg"
          >
            <MessageSquareShare className="w-4 h-4" />
            Text the manager
          </a>

          <button
            onClick={copy}
            className="w-full inline-flex items-center justify-center gap-2 bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-900 text-sm font-bold uppercase tracking-widest px-4 py-3 rounded-lg"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" />
                Link copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy claim link
              </>
            )}
          </button>

          <div className="pt-3 border-t border-zinc-100">
            <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">
              The link
            </p>
            <p className="text-xs text-zinc-700 mt-1 break-all font-mono">
              {claimUrl}
            </p>
          </div>

          {result.formattedAddress && (
            <p className="text-xs text-zinc-400 pt-2">
              {result.formattedAddress}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6">
      {children}
    </div>
  );
}
