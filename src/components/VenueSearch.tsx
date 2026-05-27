"use client";

import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    __googleMapsCallback?: () => void;
  }
}

interface Venue {
  name: string;
  address: string;
  placeId: string;
}

interface VenueSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (venue: Venue) => void;
  placeholder?: string;
  className?: string;
  /**
   * When true, on first mount with a non-empty `value`, run a Places
   * autocomplete query for that string and auto-select the top match.
   * Used to upgrade a free-text venue name (e.g. from a marketplace prefill)
   * into a real Place with placeId without forcing the user to click.
   */
  autoResolveInitial?: boolean;
}

let googleMapsLoading = false;
let googleMapsLoaded = false;

function loadGoogleMaps(): Promise<void> {
  if (googleMapsLoaded) return Promise.resolve();
  if (googleMapsLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (googleMapsLoaded) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  googleMapsLoading = true;
  return new Promise((resolve) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      console.warn("Google Maps API key not set");
      googleMapsLoading = false;
      resolve();
      return;
    }
    // If Google Maps is already loaded (e.g., by CityAutocomplete), skip
    if (window.google?.maps?.places) {
      googleMapsLoaded = true;
      googleMapsLoading = false;
      resolve();
      return;
    }
    window.__googleMapsCallback = () => {
      googleMapsLoaded = true;
      googleMapsLoading = false;
      resolve();
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=__googleMapsCallback`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

export default function VenueSearch({
  value,
  onChange,
  onSelect,
  placeholder = "Search for a venue...",
  className = "",
  autoResolveInitial = false,
}: VenueSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Hold latest onSelect + initial value in refs so the mount-only effect below
  // doesn't capture stale closures and doesn't need to re-run on every render.
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  const initialValueRef = useRef(value);
  const autoResolvedRef = useRef(false);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (!window.google) return;
      autocompleteRef.current = new window.google.maps.places.AutocompleteService();
      // PlacesService needs a div (or map) element
      const div = document.createElement("div");
      placesRef.current = new window.google.maps.places.PlacesService(div);

      // Auto-resolve the prefilled value to a real Place so we capture placeId
      // (and a normalized address) without the user having to click a suggestion.
      const initial = initialValueRef.current.trim();
      if (autoResolveInitial && !autoResolvedRef.current && initial.length >= 2) {
        autoResolvedRef.current = true;
        autocompleteRef.current.getPlacePredictions(
          { input: initial, types: ["establishment"] },
          (predictions, status) => {
            if (
              status !== google.maps.places.PlacesServiceStatus.OK ||
              !predictions ||
              predictions.length === 0
            ) {
              return;
            }
            const best = predictions[0];
            onSelectRef.current({
              name: best.structured_formatting.main_text,
              address: best.structured_formatting.secondary_text || "",
              placeId: best.place_id,
            });
          },
        );
      }
    });
  }, [autoResolveInitial]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchSuggestions = useCallback((input: string) => {
    if (!autocompleteRef.current || input.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    autocompleteRef.current.getPlacePredictions(
      { input, types: ["establishment"] },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
          setShowDropdown(true);
          setSelectedIndex(-1);
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      }
    );
  }, []);

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    const venueName = prediction.structured_formatting.main_text;
    const address = prediction.structured_formatting.secondary_text || "";
    onChange(venueName);
    onSelect({ name: venueName, address, placeId: prediction.place_id });
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            fetchSuggestions(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
            else if (value.trim().length >= 2) fetchSuggestions(value);
          }}
          placeholder={placeholder}
          className={className}
        />
      </div>
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 bg-white border border-zinc-200 shadow-lg mt-1 max-h-60 overflow-y-auto rounded-lg">
          {suggestions.map((s, i) => (
            <li
              key={s.place_id}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                i === selectedIndex ? "bg-zinc-100" : "hover:bg-zinc-50"
              }`}
            >
              <span className="font-medium">{s.structured_formatting.main_text}</span>
              <span className="text-zinc-400 ml-1 text-xs">{s.structured_formatting.secondary_text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
