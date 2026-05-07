// Mirrors the message shape written to Firebase RTDB by the iOS app
// (see leaf-appcode/Leaflet/Firebase/FirMessage.swift). Only the fields the
// web client renders or sends are listed; the rest are tolerated as unknown.
export interface FirMessage {
  message_id: string;
  from: string;
  text?: string;
  timestamp?: number;
  type?: string;
  imageUrl?: string;

  // locationSuggestion fields
  suggestedLocationId?: string;
  suggestedLocationName?: string;
  suggestedLocationAddress?: string;
  suggestedLocationImageUrl?: string;

  // checkIn / reservation
  locationId?: string;

  // readyToSplit
  receiptId?: string;

  // Other type-specific fields are present but unused on web — they fall
  // through to the generic "Open in app" fallback card.
  [key: string]: unknown;
}

export interface UserLite {
  objectId: string;
  name: string;
  profilePictureUrl?: string;
}
