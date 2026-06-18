"use client";

import { use, useEffect, useState } from "react";
import Parse from "@/lib/parse-client";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  Loader2,
  MapPin,
  Tag,
  Clock,
  AlertTriangle,
  XCircle,
} from "lucide-react";

interface Redemption {
  token: string;
  status: "scheduled" | "reminded" | "redeemed" | "expired" | "failed";
  scheduledFor: string | null;
  redemptionMode: "geofence" | "qr" | "both" | "none";
  redeemRadiusMeters: number;
  redeemWindowMinutes: number;
  redeemedAt: string | null;
  deal: {
    objectId: string;
    title: string;
    description: string | null;
    terms: string | null;
    promoCode: string | null;
    imageUrl: string | null;
    imageAttribution: { displayName: string | null; uri: string | null } | null;
  } | null;
  business: {
    objectId: string;
    name: string;
    formattedAddress: string | null;
    phone: string | null;
  } | null;
}

interface RedeemResult {
  ok: boolean;
  status: string;
  reason?: string;
  distanceMeters?: number;
  promoCode?: string | null;
}

export default function RedeemPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [redemption, setRedemption] = useState<Redemption | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    Parse.Cloud.run("getDealRedemption", { token })
      .then((r: Redemption) => {
        setRedemption(r);
        if (r.status === "redeemed") {
          setResult({ ok: true, status: "redeemed" });
        }
        if (r.redemptionMode === "qr") setShowQr(true);
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [token]);

  const redeemWithGeo = () => {
    if (!navigator.geolocation) {
      setShowQr(true);
      return;
    }
    setRedeeming(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r: RedeemResult = await Parse.Cloud.run("redeemDeal", {
            token,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            method: "geofence",
          });
          setResult(r);
        } catch (e) {
          setResult({
            ok: false,
            status: "failed",
            reason: e instanceof Error ? e.message : "Redemption failed",
          });
        } finally {
          setRedeeming(false);
        }
      },
      (err) => {
        setRedeeming(false);
        if (err.code === err.PERMISSION_DENIED) {
          setShowQr(true);
        } else {
          setResult({
            ok: false,
            status: "failed",
            reason: `Couldn't get your location: ${err.message}`,
          });
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  // QR cashier-initiated redeem fallback. Cashier reads the QR which encodes
  // the same token; tapping the button here completes the redemption without
  // a distance check (window only).
  const redeemViaQr = async () => {
    setRedeeming(true);
    try {
      const r: RedeemResult = await Parse.Cloud.run("redeemDeal", {
        token,
        method: "qr",
      });
      setResult(r);
    } catch (e) {
      setResult({
        ok: false,
        status: "failed",
        reason: e instanceof Error ? e.message : "Redemption failed",
      });
    } finally {
      setRedeeming(false);
    }
  };

  if (loadError) {
    return (
      <Centered>
        <XCircle className="w-12 h-12 text-red-500" />
        <h1 className="text-xl font-semibold mt-4">Link not found</h1>
        <p className="text-sm text-zinc-500 mt-2 text-center">{loadError}</p>
      </Centered>
    );
  }
  if (!redemption) {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </Centered>
    );
  }

  const scheduled = redemption.scheduledFor
    ? new Date(redemption.scheduledFor)
    : null;
  const inWindow =
    scheduled !== null &&
    Math.abs(Date.now() - scheduled.getTime()) <=
      redemption.redeemWindowMinutes * 60 * 1000;
  const tooEarly =
    scheduled !== null &&
    Date.now() < scheduled.getTime() - redemption.redeemWindowMinutes * 60 * 1000;
  const expired =
    scheduled !== null &&
    Date.now() > scheduled.getTime() + redemption.redeemWindowMinutes * 60 * 1000;

  if (result?.ok && result.status === "redeemed") {
    return (
      <Centered>
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
          <Check className="w-10 h-10 text-emerald-700" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Redeemed ✓</h1>
        <p className="text-sm text-zinc-500 mt-2 text-center max-w-xs">
          Show this screen to the cashier at{" "}
          {redemption.business?.name ?? "the business"}.
        </p>
        <div className="mt-6 bg-white border border-zinc-200 rounded-xl p-5 max-w-sm w-full">
          <p className="text-[10px] tracking-wider uppercase font-bold text-zinc-500">
            {redemption.business?.name ?? "Local business"}
          </p>
          <p className="text-lg font-medium mt-1">{redemption.deal?.title}</p>
          {(result.promoCode || redemption.deal?.promoCode) && (
            <div className="mt-3 inline-block bg-zinc-900 text-white px-3 py-1.5 rounded font-mono text-sm">
              {result.promoCode || redemption.deal?.promoCode}
            </div>
          )}
          {typeof result.distanceMeters === "number" && (
            <p className="text-[11px] text-zinc-400 mt-3">
              Verified at {Math.round(result.distanceMeters)}m from the business
            </p>
          )}
        </div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 flex items-center justify-center">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm w-full max-w-md overflow-hidden">
        {redemption.deal?.imageUrl ? (
          <>
            <div className="aspect-[4/3] bg-zinc-100">
              <img
                src={redemption.deal.imageUrl}
                alt={redemption.deal.title}
                className="w-full h-full object-cover"
              />
            </div>
            {redemption.deal.imageAttribution?.displayName && (
              <p className="px-6 pt-2 text-[10px] text-zinc-400 leading-tight">
                Photo:{" "}
                {redemption.deal.imageAttribution.uri ? (
                  <a
                    href={redemption.deal.imageAttribution.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-zinc-600"
                  >
                    {redemption.deal.imageAttribution.displayName}
                  </a>
                ) : (
                  redemption.deal.imageAttribution.displayName
                )}{" "}
                / Google
              </p>
            )}
          </>
        ) : (
          <div className="aspect-[4/3] bg-zinc-100 flex items-center justify-center">
            <Tag className="w-12 h-12 text-zinc-300" />
          </div>
        )}

        <div className="p-6 space-y-4">
          <div>
            <p className="text-[10px] tracking-wider uppercase font-bold text-zinc-500">
              {redemption.business?.name ?? "Local Business"}
            </p>
            <h1 className="text-xl font-semibold tracking-tight mt-1">
              {redemption.deal?.title}
            </h1>
            {redemption.deal?.description && (
              <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
                {redemption.deal.description}
              </p>
            )}
            {redemption.deal?.terms && (
              <p className="text-xs text-zinc-400 mt-2 italic">
                {redemption.deal.terms}
              </p>
            )}
          </div>

          {redemption.business?.formattedAddress && (
            <div className="flex items-start gap-2 text-sm text-zinc-700">
              <MapPin className="w-4 h-4 mt-0.5 text-zinc-400 shrink-0" />
              <span>{redemption.business.formattedAddress}</span>
            </div>
          )}

          {scheduled && (
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>
                Scheduled for{" "}
                {scheduled.toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          {tooEarly && (
            <Banner tone="info">
              Come back closer to your scheduled time. You have ±
              {redemption.redeemWindowMinutes} minutes to redeem at the
              business.
            </Banner>
          )}
          {expired && (
            <Banner tone="error">
              This window has closed. You can&apos;t redeem this deal anymore.
            </Banner>
          )}
          {result && !result.ok && (
            <Banner tone="error">
              <strong>Couldn&apos;t redeem.</strong>{" "}
              {result.reason || result.status}
            </Banner>
          )}

          {inWindow && !result?.ok && (
            <div className="space-y-2">
              {!showQr && (
                <button
                  onClick={redeemWithGeo}
                  disabled={redeeming}
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300 text-white text-sm font-bold uppercase tracking-widest px-4 py-3 rounded-lg"
                >
                  {redeeming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  I&apos;m at the business — Redeem
                </button>
              )}
              {showQr && (
                <div className="space-y-3 text-center">
                  <p className="text-xs text-zinc-500">
                    Show this code to the cashier
                  </p>
                  <div className="inline-block border-2 border-zinc-900 p-2 bg-white">
                    <QRCodeSVG value={token} size={180} level="M" />
                  </div>
                  <button
                    onClick={redeemViaQr}
                    disabled={redeeming}
                    className="w-full inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white text-sm font-bold uppercase tracking-widest px-4 py-3 rounded-lg"
                  >
                    {redeeming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Mark redeemed (cashier)
                  </button>
                </div>
              )}
              {!showQr && (
                <button
                  onClick={() => setShowQr(true)}
                  className="w-full text-xs text-zinc-500 underline hover:text-zinc-900"
                >
                  Location not working? Show QR code instead
                </button>
              )}
            </div>
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

function Banner({
  tone,
  children,
}: {
  tone: "info" | "error";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "bg-red-50 border border-red-200 text-red-700"
      : "bg-amber-50 border border-amber-200 text-amber-900";
  const Icon = tone === "error" ? XCircle : AlertTriangle;
  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg text-sm ${cls}`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
