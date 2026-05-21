"use client";

import CalendarLandingPage, {
  type LandingConfig,
} from "@/components/CalendarLandingPage";

const config: LandingConfig = {
  profileName: "Landmark Cevicheria",
  profilePhoto:
    "https://static.spotapps.co/spots/cb/428476d97046fabf5dfff4fb5e2a5f/full",
  brandColor: "#b45309",
  followerCount: 246,
  navLabel: "Restaurant",
  plansHeader: "What's On at Landmark",
  ideasHeader: "Book the Space",
  ideasTitle: "Host your night here",
  ctaTitle: "Turn Your Restaurant Into a Calendar",
  ctaSubtitle:
    "One room, every kind of night. Tastings, classes, live music, brunches, private dinners — let regulars follow along and tap to RSVP.",
  ctaButtonLabel: "Create Your Restaurant Calendar",
  scrollPopupTitle: "A calendar for your restaurant",
  scrollPopupSubtitle: "Free for restaurants and bars — set up in 60 seconds",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free calendar for your restaurant",
  plans: [
    {
      id: "1",
      title: "Mezcal Flight Night",
      daysFromNow: 3,
      time: "7:30 PM",
      description:
        "Guided flight of five mezcals from one of Brooklyn's deepest selections. Smoked almonds, tasting notes, and stories from the agave fields.",
      image:
        "https://static.spotapps.co/spots/92/4bfaa8f4c240e29650546f1185a603/full",
      hostName: "Mateo",
      attendeeCount: 16,
      location: "Bar & Mezcal Lounge",
    },
    {
      id: "2",
      title: "Ceviche Masterclass with Chef Rosa",
      daysFromNow: 8,
      time: "2:00 PM",
      description:
        "Hands-on class at the kitchen counter. Three styles of Peruvian ceviche, leche de tigre techniques, and a pisco sour to start. Apron included.",
      image:
        "https://static.spotapps.co/spots/d7/1a69519bee4b0993b2b84f66cc8a7e/full",
      hostName: "Chef Rosa",
      attendeeCount: 12,
      location: "Open Kitchen Counter",
    },
    {
      id: "3",
      title: "Sunday Patio Brunch",
      daysFromNow: 12,
      time: "11:30 AM",
      description:
        "Bottomless mimosas, huevos rancheros, and ceviche brunch plates on the back patio. Sun, plants, and slow Sundays.",
      image:
        "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80",
      hostName: "Sara",
      attendeeCount: 34,
      location: "Back Patio",
    },
    {
      id: "4",
      title: "Live Latin Jazz Friday",
      daysFromNow: 18,
      time: "8:00 PM",
      description:
        "Trio takes the patio: upright bass, nylon guitar, and percussion. No cover, full dinner menu, reservations strongly recommended.",
      image:
        "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/31/89/5a/a3/brooklyn-s-next-big-latin.jpg?w=900&h=500&s=1",
      hostName: "Daniela",
      attendeeCount: 42,
      location: "Back Patio",
    },
    {
      id: "5",
      title: "Pisco Sour Cocktail Workshop",
      daysFromNow: 25,
      time: "6:30 PM",
      description:
        "Take over the bar for an evening. Build three Peruvian classics — Pisco Sour, Chilcano, and Capitán — with our head bartender.",
      image:
        "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80",
      hostName: "Diego",
      attendeeCount: 14,
      location: "Bar & Mezcal Lounge",
    },
    {
      id: "6",
      title: "Chef's Table Tasting Menu",
      daysFromNow: 32,
      time: "7:00 PM",
      description:
        "Eight courses of Peruvian-Mexican fusion served at the fireplace. Optional mezcal and natural wine pairings. Twelve seats only.",
      image:
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
      hostName: "Chef Rosa",
      attendeeCount: 12,
      location: "Fireplace Lounge",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Birthday Buyout — Fireplace Lounge",
      description:
        "Reserve the lounge for the night. Custom menu, dedicated bartender, and your own playlist on the speakers.",
      category: "Private Events",
      image:
        "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80",
    },
    {
      id: "i2",
      title: "Día de los Muertos Pop-Up",
      description:
        "Themed prix-fixe night with marigolds, sugar skulls, and a mezcal flight built around the holiday.",
      category: "Seasonal",
      image:
        "https://images.unsplash.com/photo-1572731535619-3a1d6f905049?w=800&q=80",
    },
    {
      id: "i3",
      title: "Corporate Happy Hour",
      description:
        "Buyout the patio for your team. Passed bites, two-cocktail tickets per guest, easy invoicing for the office.",
      category: "Corporate",
      image:
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
    },
    {
      id: "i4",
      title: "Rehearsal Dinner",
      description:
        "Family-style Peruvian sharing menu in the main dining room. Up to 40, with toasts welcome.",
      category: "Weddings",
      image:
        "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=800&q=80",
    },
  ],
};

export default function RestaurantPage() {
  return <CalendarLandingPage config={config} />;
}
