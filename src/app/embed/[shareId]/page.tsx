"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Parse from "@/lib/parse-client";
import { Users, Calendar, ArrowUpRight, Loader2 } from "lucide-react";

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
    weekday: "long",
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
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-24 px-6">
        <Calendar className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm text-zinc-500">
          {error || "Calendar not found."}
        </p>
      </div>
    );
  }

  const orgUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/org/${data.shareId}`;

  if (data.plans.length === 0) {
    return (
      <div className="px-6 py-24 text-center space-y-4">
        <Calendar className="w-12 h-12 text-zinc-300 mx-auto" />
        <h3 className="text-xl font-light">No upcoming plans yet</h3>
        <p className="text-zinc-400 text-sm">
          Check back soon for new events.
        </p>
        <a
          href={orgUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 hover:text-zinc-600 inline-block mt-2"
        >
          View full calendar
        </a>
        <PoweredByLeaf />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6">
      {/* Stream Header */}
      <div className="pt-8 pb-4 border-b border-zinc-100">
        <p className="text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-bold">
          Upcoming Plans
        </p>
      </div>

      {/* Plans Stream */}
      <div className="py-12 space-y-24">
        {data.plans.map((plan, index) => (
          <article
            key={plan.id}
            className={`group flex flex-col md:flex-row gap-8 md:gap-12 md:items-center ${
              index % 2 !== 0 ? "md:flex-row-reverse" : ""
            }`}
          >
            {/* Image */}
            <a
              href={orgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full md:w-3/5 aspect-[16/10] overflow-hidden bg-zinc-100 shadow-sm block"
            >
              {plan.image ? (
                <img
                  src={plan.image}
                  alt={plan.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Calendar className="w-16 h-16 text-zinc-300" />
                </div>
              )}
            </a>

            {/* Details */}
            <div className="w-full md:w-2/5 space-y-6">
              <div className="space-y-2">
                <p className="text-[11px] tracking-[0.3em] uppercase font-bold text-zinc-400">
                  {plan.date} &bull; {plan.time}
                </p>
                <h3 className="text-3xl font-light tracking-tight group-hover:italic transition-all">
                  {plan.title}
                </h3>
                <div className="pt-2">
                  <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-900 font-bold flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: data.brandColor }}
                    />
                    Hosted by {plan.hostName}
                  </p>
                </div>
              </div>

              <p className="text-zinc-500 leading-relaxed font-light text-lg line-clamp-3">
                {plan.description}
              </p>

              <div className="pt-2 flex flex-col gap-6">
                {/* Attendee count */}
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white">
                    <Users className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                  <span className="text-[10px] tracking-widest uppercase font-bold text-zinc-400">
                    {plan.attendeeCount} Attending
                  </span>
                </div>

                {/* CTA */}
                <a
                  href={orgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white px-6 py-3 text-xs uppercase tracking-widest font-medium transition-opacity hover:opacity-90 flex items-center justify-center gap-2 w-fit"
                  style={{ backgroundColor: data.brandColor }}
                >
                  View Details <ArrowUpRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      <PoweredByLeaf />
    </div>
  );
}

function PoweredByLeaf() {
  return (
    <div className="text-center py-6 border-t border-zinc-100">
      <a
        href="https://os.joinleaf.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[10px] tracking-[0.3em] uppercase text-zinc-300 hover:text-zinc-400 transition-colors"
      >
        Powered by Leaf
      </a>
    </div>
  );
}
