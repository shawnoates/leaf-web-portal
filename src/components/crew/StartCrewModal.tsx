"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import StartCrewForm from "@/components/crew/StartCrewForm";

/** Start a crew from inside the dashboard: the /friends form in a sheet. */
export default function StartCrewModal({ onClose, onOpenCrew }: { onClose: () => void; onOpenCrew: (crewId: string) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Start a crew" className="fm fixed inset-0 z-50 flex items-end justify-center bg-black/60 font-fm-sans sm:items-center" onClick={onClose}>
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto text-fm-ink" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-fm-line bg-fm-surface text-fm-ink hover:bg-fm-card">
          <X size={20} aria-hidden />
        </button>
        <StartCrewForm onOpenCrew={onOpenCrew} />
      </div>
    </div>
  );
}
