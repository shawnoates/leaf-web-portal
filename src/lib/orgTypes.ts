// Canonical community/organization types. Single source of truth so the org
// setup flow (/organizations/setup) and the concierge enrollment intake use
// the exact same options — keep this in sync, don't redefine elsewhere.
export const ORG_TYPES = [
  { value: "community", label: "Friends / Community", emoji: "\u{1F31F}" },
  // Neighborhood is not just a label: the server gives it the same geography,
  // audience-tag, and venue-visibility rules Leaf-run neighborhood calendars
  // get, so its starter events and plan ideas stay walkable. See
  // createOrganization's NEIGHBORHOOD_DEFAULTS.
  { value: "neighborhood", label: "Neighborhood", emoji: "\u{1F3D8}\u{FE0F}" },
  { value: "apartment_complex", label: "Apartment Complex", emoji: "\u{1F3E2}" },
  { value: "gym", label: "Gym / Fitness", emoji: "\u{1F3CB}\u{FE0F}" },
  { value: "church", label: "Church", emoji: "⛪" },
  { value: "school", label: "School / University", emoji: "\u{1F393}" },
  { value: "company", label: "Company", emoji: "\u{1F3E2}" },
  { value: "brick_and_mortar", label: "Brick & Mortar", emoji: "\u{1F3EA}" },
  { value: "consumer_brand", label: "Consumer Brand", emoji: "\u{1F4E6}" },
  { value: "other", label: "Other", emoji: "\u{1F4CC}" },
];
