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
        "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=80",
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
        "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80",
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
        "https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80",
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
        "https://images.unsplash.com/photo-1585699324551-f6c309eedeca?w=800&q=80",
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
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
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
        "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80",
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
        "https://images.unsplash.com/photo-1472745942893-4b9f730c7668?w=800&q=80",
    },
    {
      id: "i2",
      title: "Smorgasburg Food Tour",
      description:
        "Sample the best street food vendors at Brooklyn's legendary outdoor food market.",
      category: "Food & Drink",
      image:
        "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
    },
    {
      id: "i3",
      title: "Jazz in the Park",
      description:
        "Catch a free live jazz set in one of NYC's parks. Bring a picnic blanket and enjoy the vibes.",
      category: "Music",
      image:
        "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&q=80",
    },
    {
      id: "i4",
      title: "Pottery Workshop",
      description:
        "Hands-on pottery class in a cozy Brooklyn studio. Make a mug, bowl, or whatever inspires you.",
      category: "Creative",
      image:
        "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800&q=80",
    },
  ],
};

export default function SummerPage() {
  return <CalendarLandingPage config={config} />;
}
