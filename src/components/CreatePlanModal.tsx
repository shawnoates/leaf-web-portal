"use client";

import { useState, useEffect, useRef } from "react";
import Parse from "@/lib/parse-client";
import VenueSearch from "@/components/VenueSearch";
import {
  Calendar,
  Check,
  ImagePlus,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";

interface Venue {
  name: string;
  address: string;
  placeId: string;
}

export interface CreatePlanPrefill {
  title?: string;
  description?: string;
  venue?: { name: string; address: string } | null;
  date?: string;
  time?: string;
  capacity?: string;
  imageUrl?: string | null;
}

interface CreatePlanModalProps {
  calendarId: string;
  calendars?: { objectId: string; name: string }[];
  tier: string;
  prefill?: CreatePlanPrefill | null;
  hideVenueDefault?: boolean;
  editMode?: boolean;
  eventGroupId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreatePlanModal({ calendarId, calendars, tier, prefill, hideVenueDefault, editMode, eventGroupId, onClose, onCreated }: CreatePlanModalProps) {
  const [selectedCalendarId, setSelectedCalendarId] = useState(calendarId);
  const [hideVenue, setHideVenue] = useState(hideVenueDefault ?? true);
  const [title, setTitle] = useState(prefill?.title || "");
  const [description, setDescription] = useState(prefill?.description || "");
  const [venueQuery, setVenueQuery] = useState(prefill?.venue?.name || "");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(
    prefill?.venue ? { name: prefill.venue.name, address: prefill.venue.address, placeId: "" } : null
  );
  const [date, setDate] = useState(prefill?.date || "");
  const [time, setTime] = useState(prefill?.time || "");
  const [capacity, setCapacity] = useState(prefill?.capacity || "");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(prefill?.imageUrl || null);
  const [hostNote, setHostNote] = useState("");
  const [isHosted, setIsHosted] = useState(true);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [unsplashPhotos, setUnsplashPhotos] = useState<{ id: string; url: string; thumbUrl: string; alt: string; photographerName: string; photographerUrl: string }[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);

  // If prefill has an image URL, fetch and convert to base64 (once on mount)
  const prefillImageLoaded = useRef(false);
  useEffect(() => {
    if (prefill?.imageUrl && !prefillImageLoaded.current) {
      prefillImageLoaded.current = true;
      setLoadingImage(true);
      fetch(prefill.imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            setImageBase64(result.split(",")[1]);
            setImagePreview(result);
            setLoadingImage(false);
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {
          // Keep the URL preview even if base64 conversion fails
          setLoadingImage(false);
        });
    }
  }, [prefill?.imageUrl]);

  // Fetch Unsplash photo suggestions when title changes
  useEffect(() => {
    if (!title.trim()) {
      setUnsplashPhotos([]);
      return;
    }
    setUnsplashLoading(true);
    const timer = setTimeout(async () => {
      try {
        const results = await Parse.Cloud.run("searchUnsplashPhotos", {
          query: title.trim(),
        });
        setUnsplashPhotos(results || []);
      } catch {
        setUnsplashPhotos([]);
      } finally {
        setUnsplashLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [title]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result.split(",")[1]);
      setSelectedImageUrl(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleCreate() {
    if (!title || !date) return;
    if (!editMode && isHosted && !imageBase64 && !prefill?.imageUrl && !selectedImageUrl) {
      alert("Please upload a cover image for your plan.");
      return;
    }
    setCreating(true);
    try {
      if (editMode && eventGroupId) {
        await Parse.Cloud.run("updatePlanDetails", {
          eventGroupId,
          title,
          description,
          date: `${date}T${time || "12:00"}:00`,
          time: time || null,
          imageBase64: imageBase64 || undefined,
          imageUrl: !imageBase64 ? (selectedImageUrl || prefill?.imageUrl || undefined) : undefined,
          venue: selectedVenue ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId } : null,
          capacity: capacity ? parseInt(capacity) : null,
          hostNote: hostNote.trim() || undefined,
        });
      } else {
        await Parse.Cloud.run("createManualPlan", {
          calendarId: selectedCalendarId,
          title,
          description,
          venue: selectedVenue ? { name: selectedVenue.name, address: selectedVenue.address, placeId: selectedVenue.placeId } : null,
          date: `${date}T${time || "12:00"}:00`,
          time: time || null,
          capacity: capacity ? parseInt(capacity) : null,
          isHosted,
          imageBase64: imageBase64 || undefined,
          imageUrl: !imageBase64 ? (selectedImageUrl || prefill?.imageUrl || undefined) : undefined,
          hostNote: isHosted && hostNote.trim() ? hostNote.trim() : undefined,
          hideVenueUntilRsvp: hideVenue,
        });
      }
      setSuccess(true);
      onCreated();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : editMode ? "Failed to update plan" : "Failed to create plan";
      alert(message);
    } finally {
      setCreating(false);
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const maxDate =
    tier === "starter"
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => { if (!creating) onClose(); }} />
      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b border-zinc-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">{editMode ? "Edit Plan" : "New Plan"}</h2>
          <button
            onClick={() => { if (!creating) onClose(); }}
            className="p-1.5 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {success && (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg text-sm">
              <Check className="w-4 h-4" /> {editMode ? "Plan updated!" : "Plan created successfully!"}
            </div>
          )}

          {/* Calendar selector (only when multiple calendars, hidden in edit mode) */}
          {!editMode && calendars && calendars.length > 1 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Calendar</label>
              <select
                value={selectedCalendarId}
                onChange={(e) => setSelectedCalendarId(e.target.value)}
                className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 bg-transparent"
              >
                {calendars.map((cal) => (
                  <option key={cal.objectId} value={cal.objectId}>{cal.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Plan type toggle (hidden in edit mode) */}
          {!editMode && <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-3">Plan Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => setIsHosted(true)}
                className={`flex-1 border rounded-lg p-3 text-left transition-all ${
                  isHosted ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-sm font-medium">Upcoming Plan</span>
                </div>
                <p className="text-xs text-zinc-500">You host it, members RSVP</p>
              </button>
              <button
                onClick={() => setIsHosted(false)}
                className={`flex-1 border rounded-lg p-3 text-left transition-all ${
                  !isHosted ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-sm font-medium">Plan Idea</span>
                </div>
                <p className="text-xs text-zinc-500">Members can host this idea</p>
              </button>
            </div>
          </div>}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-b border-zinc-300 py-2 text-lg font-light focus:outline-none focus:border-zinc-900"
              placeholder="Plan title"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
              placeholder="What's this plan about?"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">
              Cover Image {isHosted && <span className="text-red-400">*</span>}
            </label>
            {imagePreview || selectedImageUrl ? (
              <div className="relative w-full h-36 rounded-lg overflow-hidden">
                <img src={imagePreview || selectedImageUrl || ""} alt="Preview" className="w-full h-full object-cover" />
                {loadingImage && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <button
                  onClick={() => { setImagePreview(null); setImageBase64(null); setSelectedImageUrl(null); }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-200 rounded-lg cursor-pointer hover:border-zinc-400 transition-colors">
                <ImagePlus className="w-6 h-6 text-zinc-300 mb-2" />
                <span className="text-xs text-zinc-400">Click to upload an image</span>
                <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              </label>
            )}

            {/* Photo suggestions from Unsplash */}
            {(unsplashLoading || unsplashPhotos.length > 0) && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Photo suggestions</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {unsplashLoading && [0, 1, 2, 3].map((i) => (
                    <div key={`skel-${i}`} className="min-w-[120px] h-[80px] bg-zinc-100 rounded-lg animate-pulse shrink-0" />
                  ))}
                  {!unsplashLoading && unsplashPhotos.map((photo) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => {
                        setSelectedImageUrl(selectedImageUrl === photo.url ? null : photo.url);
                        setImagePreview(null);
                        setImageBase64(null);
                      }}
                      className={`min-w-[120px] max-w-[120px] h-[80px] shrink-0 rounded-lg overflow-hidden border-2 transition-all relative ${
                        selectedImageUrl === photo.url
                          ? "border-zinc-900 shadow-lg"
                          : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      {selectedImageUrl === photo.url && (
                        <div className="absolute top-1 right-1 bg-zinc-900 text-white rounded-full p-0.5 z-10">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <img src={photo.thumbUrl} className="w-full h-full object-cover" alt={photo.alt} />
                    </button>
                  ))}
                </div>
                {(() => {
                  const selected = unsplashPhotos.find(p => p.url === selectedImageUrl);
                  if (!selected) return null;
                  return (
                    <p className="text-[10px] text-zinc-400">
                      Photo by{" "}
                      <a href={`${selected.photographerUrl}?utm_source=leaf&utm_medium=referral`} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">
                        {selected.photographerName}
                      </a>
                      {" / "}
                      <a href="https://unsplash.com/?utm_source=leaf&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600">
                        Unsplash
                      </a>
                    </p>
                  );
                })()}
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Venue</label>
            <VenueSearch
              value={venueQuery}
              onChange={setVenueQuery}
              onSelect={(v) => { setSelectedVenue(v); setVenueQuery(v.name); }}
              className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
            />
            {selectedVenue && (
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {selectedVenue.address}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
                max={maxDate}
                className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
              />
              {tier === "starter" && (
                <p className="text-[10px] text-amber-600 mt-1">Starter: 2 weeks ahead max</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Capacity (optional)</label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full border-b border-zinc-300 py-2 text-sm font-light focus:outline-none focus:border-zinc-900 max-w-[120px]"
              placeholder="—"
              min="1"
            />
          </div>

          {isHosted && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">Host Note (optional)</label>
              <textarea
                value={hostNote}
                onChange={(e) => setHostNote(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full border border-zinc-200 rounded-lg p-3 text-sm font-light focus:outline-none focus:border-zinc-400 resize-none"
                placeholder="A note for attendees (visible in the plan)"
              />
            </div>
          )}

          {/* Venue privacy toggle */}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-xs font-medium text-zinc-700">Hide venue until RSVP</p>
              <p className="text-[10px] text-zinc-400">Only show neighborhood on public page</p>
            </div>
            <button
              type="button"
              onClick={() => setHideVenue(!hideVenue)}
              className={`relative w-10 h-5 rounded-full transition-colors ${hideVenue ? "bg-zinc-900" : "bg-zinc-200"}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${hideVenue ? "left-5" : "left-0.5"}`} />
            </button>
          </div>

          <button
            onClick={handleCreate}
            disabled={!title || !date || creating || (!editMode && isHosted && !imageBase64 && !prefill?.imageUrl && !selectedImageUrl)}
            className="w-full bg-zinc-900 text-white py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {creating ? (editMode ? "Saving..." : "Creating...") : editMode ? "Save Changes" : isHosted ? "Create Upcoming Plan" : "Create Plan Idea"}
          </button>
        </div>
      </div>
    </div>
  );
}
