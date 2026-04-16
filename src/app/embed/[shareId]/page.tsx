"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import { Users, Calendar, MapPin, Loader2 } from "lucide-react";

// --- Types ---

interface Plan {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
  image: string;
  hostName: string;
  attendeeCount: number;
  location: { name: string; address: string } | null;
}

interface EmbedData {
  name: string;
  brandColor: string;
  shareId: string;
  plans: Plan[];
}

// --- Helpers ---

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// --- Component ---

export default function EmbedCalendarPage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await Parse.Cloud.run("getOrgCalendarPage", {
        shareId,
      });

      if (result.isInactive) {
        setError("This calendar is currently inactive.");
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plans: Plan[] = (result.plans || []).map((p: any) => ({
        id: p.objectId,
        title: p.title || "Untitled Plan",
        date: p.expiryDate ? formatDate(p.expiryDate) : "",
        time: p.expiryDate ? formatTime(p.expiryDate) : "",
        description: p.description || "",
        image: p.image || "",
        hostName: p.host?.name || "Community Member",
        attendeeCount: p.rsvpCount || 0,
        location: p.location
          ? { name: p.location.name || "", address: p.location.address || "" }
          : null,
      }));

      setData({
        name: result.name || "Calendar",
        brandColor: result.orgBrandColor || "#18181b",
        shareId,
        plans,
      });
    } catch {
      setError("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [shareId]);

  useEffect(() => {
    if (shareId) fetchData();
  }, [shareId, fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 px-4">
        <Calendar className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
        <p className="text-sm text-zinc-500">
          {error || "Calendar not found."}
        </p>
      </div>
    );
  }

  const orgUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/org/${data.shareId}`;

  if (data.plans.length === 0) {
    return (
      <div className="px-4 py-8">
        <div className="text-center py-8">
          <Calendar className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-500">No upcoming events</p>
          <a
            href={orgUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-zinc-600 mt-2 inline-block"
          >
            View calendar on Leaf
          </a>
        </div>
        <PoweredByLeaf />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-3">
      {data.plans.map((plan) => (
        <a
          key={plan.id}
          href={orgUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3 p-3 border border-zinc-100 rounded-xl hover:border-zinc-200 hover:shadow-sm transition-all group cursor-pointer"
        >
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
            {plan.image ? (
              <img
                src={plan.image}
                alt={plan.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-zinc-300" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm tracking-tight truncate group-hover:text-zinc-700">
              {plan.title}
            </h3>
            <p
              className="text-xs font-bold uppercase tracking-wider mt-0.5"
              style={{ color: data.brandColor }}
            >
              {plan.date} &middot; {plan.time}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
              {plan.location && (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{plan.location.name}</span>
                </span>
              )}
              <span className="flex items-center gap-1 shrink-0">
                <Users className="w-3 h-3" />
                {plan.attendeeCount}
              </span>
            </div>
          </div>
        </a>
      ))}
      <PoweredByLeaf />
    </div>
  );
}

function PoweredByLeaf() {
  return (
    <div className="text-center pt-2 pb-1">
      <a
        href="https://os.joinleaf.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] tracking-wider uppercase text-zinc-300 hover:text-zinc-400 transition-colors"
      >
        Powered by Leaf
      </a>
    </div>
  );
}
