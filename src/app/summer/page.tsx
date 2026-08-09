"use client";

import CalendarLandingPage, {
  type LandingConfig,
} from "@/components/CalendarLandingPage";

const config: LandingConfig = {
  profileName: "Matt's Summer '26",
  profilePhoto: "https://randomuser.me/api/portraits/men/32.jpg",
  brandColor: "#2563eb",
  followerCount: 47,
  ctaTitle: "Plan Your Summer with Friends",
  ctaSubtitle:
    "Create your own free summer calendar. Share plans, invite friends, and make it happen.",
  ctaButtonLabel: "Create Your Summer Calendar",
  scrollPopupTitle: "Summer plans, sorted",
  scrollPopupSubtitle: "Create your own free calendar",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free summer calendar",
  plans: [
    {
      id: "1",
      title: "Rooftop Sunset Cocktails",
      daysFromNow: 7,
      time: "7:00 PM",
      description:
        "Grab a drink and watch the sun set over the Manhattan skyline from a Williamsburg rooftop. Craft cocktails, good music, and great company.",
      image:
        "https://images.unsplash.com/photo-1556831732-7178ea98d74f?w=800&q=80",
      hostName: "Matt",
      attendeeCount: 12,
      location: "Williamsburg, Brooklyn",
    },
    {
      id: "2",
      title: "Central Park Volleyball",
      daysFromNow: 14,
      time: "10:00 AM",
      description:
        "Saturday morning pickup volleyball on the Great Lawn. All skill levels welcome — we'll split into teams. Bring water and sunscreen!",
      image:
        "https://images.unsplash.com/photo-1659090491025-1e6202433871?w=800&q=80",
      hostName: "Maya",
      attendeeCount: 8,
      location: "Great Lawn, Central Park",
    },
    {
      id: "3",
      title: "Brooklyn Bridge Sunset Walk",
      daysFromNow: 25,
      time: "6:30 PM",
      description:
        "Walk across the Brooklyn Bridge at golden hour, then grab ice cream in DUMBO. Perfect for catching up with friends old and new.",
      image:
        "https://images.unsplash.com/photo-1477882244523-716124bf91a1?w=800&q=80",
      hostName: "Matt",
      attendeeCount: 15,
      location: "Brooklyn Bridge",
    },
    {
      id: "4",
      title: "Comedy Night at the Cellar",
      daysFromNow: 38,
      time: "8:00 PM",
      description:
        "Live standup at one of NYC's most iconic comedy clubs. We've got a group reservation — expect surprise headliners and a lot of laughs.",
      image:
        "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&q=80",
      hostName: "Jake",
      attendeeCount: 6,
      location: "Comedy Cellar, Greenwich Village",
    },
    {
      id: "5",
      title: "Beach Day at Rockaway",
      daysFromNow: 52,
      time: "9:00 AM",
      description:
        "Full beach day at Rockaway Beach. Waves, boardwalk tacos, spikeball, and good vibes. We'll claim a spot early — look for the Leaf flag.",
      image:
        "https://images.unsplash.com/photo-1519338381761-c7523edc1f46?w=800&q=80",
      hostName: "Sarah",
      attendeeCount: 20,
      location: "Rockaway Beach, Queens",
    },
    {
      id: "6",
      title: "Outdoor Movie Night",
      daysFromNow: 66,
      time: "7:30 PM",
      description:
        "Bring a blanket and join us for a classic film under the stars at Brooklyn Bridge Park. Popcorn and snacks provided.",
      image:
        "https://images.unsplash.com/photo-1658195952756-892740657893?w=800&q=80",
      hostName: "Matt",
      attendeeCount: 10,
      location: "Brooklyn Bridge Park",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Kayaking on the Hudson",
      description:
        "Paddle along the Hudson River with skyline views. No experience needed — guided group session.",
      category: "Adventure",
      image:
        "https://images.unsplash.com/photo-1782864841071-4f98c7d0a5ce?w=800&q=80",
    },
    {
      id: "i2",
      title: "Smorgasburg Food Tour",
      description:
        "Sample the best street food vendors at Brooklyn's legendary outdoor food market.",
      category: "Food & Drink",
      image:
        "https://images.unsplash.com/photo-1662714212971-059415b0c4d1?w=800&q=80",
    },
    {
      id: "i3",
      title: "Jazz in the Park",
      description:
        "Catch a free live jazz set in one of NYC's parks. Bring a picnic blanket and enjoy the vibes.",
      category: "Music",
      image:
        "https://images.unsplash.com/photo-1561394742-4f9ab68d1a42?w=800&q=80",
    },
    {
      id: "i4",
      title: "Pottery Workshop",
      description:
        "Hands-on pottery class in a cozy Brooklyn studio. Make a mug, bowl, or whatever inspires you.",
      category: "Creative",
      image:
        "https://images.unsplash.com/photo-1607556671927-78a6605e290b?w=800&q=80",
    },
  ],
};

export default function SummerPage() {
  return <CalendarLandingPage config={config} />;
}
