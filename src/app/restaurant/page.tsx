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
  navLabel: "Calendar",
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
      attendeeCount: 6,
      location: "Bar & Mezcal Lounge",
    },
    {
      id: "2",
      title: "Ceviche Tasting Crawl",
      daysFromNow: 8,
      time: "2:00 PM",
      description:
        "Order every ceviche on the menu and rank them as a table. Bring a friend who's never tried one. Leche de tigre shots optional but encouraged.",
      image:
        "https://static.spotapps.co/spots/d7/1a69519bee4b0993b2b84f66cc8a7e/full",
      hostName: "Camila",
      attendeeCount: 6,
      location: "Main Dining Room",
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
      attendeeCount: 8,
      location: "Back Patio",
    },
    {
      id: "4",
      title: "Friday Latin Night Out",
      daysFromNow: 18,
      time: "8:00 PM",
      description:
        "Long table on the patio. Pisco cocktails, picadas to share, and the buzz of a busy Friday night. No agenda — just a good crew.",
      image:
        "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/31/89/5a/a3/brooklyn-s-next-big-latin.jpg?w=900&h=500&s=1",
      hostName: "Daniela",
      attendeeCount: 7,
      location: "Back Patio",
    },
    {
      id: "5",
      title: "Pisco Sour Showdown",
      daysFromNow: 25,
      time: "6:30 PM",
      description:
        "Order every pisco cocktail on the menu — Sour, Chilcano, Capitán — and rank them blind around the table. Loser buys the next round.",
      image:
        "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&q=80",
      hostName: "Diego",
      attendeeCount: 5,
      location: "Bar & Mezcal Lounge",
    },
    {
      id: "6",
      title: "Eight-Course Birthday Dinner",
      daysFromNow: 32,
      time: "7:00 PM",
      description:
        "Eight of us, the eight-course tasting menu, and optional pisco-mezcal pairings. Long dinner by the fireplace for Sofia's birthday. RSVP a week out so the kitchen can plan.",
      image:
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
      hostName: "Sofia",
      attendeeCount: 8,
      location: "Fireplace Lounge",
    },
  ],
  planIdeas: [],
};

export default function RestaurantPage() {
  return <CalendarLandingPage config={config} />;
}
