"use client";

import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    __googleMapsCallback?: () => void;
  }
}

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: { description: string; placeId: string }) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
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

export default function CityAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "e.g., Austin, TX",
  className = "",
  required = false,
}: CityAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSelected, setHasSelected] = useState(!!value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadGoogleMaps().then(() => {
      if (window.google) {
        autocompleteRef.current = new window.google.maps.places.AutocompleteService();
      }
    });
  }, []);

  // Close dropdown on outside click
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
      { input, types: ["locality", "sublocality", "administrative_area_level_3"] },
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setHasSelected(false);
    fetchSuggestions(val);
  };

  const handleSelect = (prediction: google.maps.places.AutocompletePrediction) => {
    onChange(prediction.description);
    onSelect({ description: prediction.description, placeId: prediction.place_id });
    setHasSelected(true);
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

  const showError = value.length > 0 && !hasSelected;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
        placeholder={placeholder}
        required={required}
        className={className}
      />
      {showError && (
        <p className="text-xs text-amber-600 mt-1">Please select a city from the suggestions</p>
      )}
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 bg-white border border-zinc-200 shadow-lg mt-1 max-h-60 overflow-y-auto">
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
              <span className="text-zinc-400 ml-1">{s.structured_formatting.secondary_text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
