"use client";

import CalendarLandingPage, {
  type LandingConfig,
} from "@/components/CalendarLandingPage";

const config: LandingConfig = {
  profileName: "Lincoln Place Residents",
  profilePhoto:
    "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&q=80",
  brandColor: "#0f766e",
  followerCount: 82,
  ctaTitle: "Bring Your Building to Life",
  ctaSubtitle:
    "Create a free calendar for your apartment building. Host bowling nights, pickup games, happy hours, and dinners — neighbors RSVP in one tap.",
  ctaButtonLabel: "Create Your Building Calendar",
  // Comped Pro membership only applies to rep-invited RM claims, NOT to
  // self-serve signups from this marketing page. Don't promise "Free
  // forever" to visitors we can't actually deliver it to.
  ctaFootnote: "Free to get started · No credit card required",
  scrollPopupTitle: "A calendar for your building",
  scrollPopupSubtitle: "Free for residents — set up in 60 seconds",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free calendar for your building",
  plans: [
    {
      id: "1",
      title: "Bowling Night at Frames",
      daysFromNow: 5,
      time: "7:30 PM",
      description:
        "Two lanes reserved for residents. Beer, shoes, and bragging rights — bring your A-game (or just your friends).",
      image:
        "https://images.unsplash.com/photo-1545056453-f0359c3df6db?w=800&q=80",
      hostName: "Devon",
      attendeeCount: 14,
      location: "Frames Bowling Lounge",
    },
    {
      id: "2",
      title: "Pickup Pickleball",
      daysFromNow: 9,
      time: "6:00 PM",
      description:
        "Weekly resident pickleball at the public courts down the block. Paddles available to borrow — all skill levels welcome.",
      image:
        "https://images.unsplash.com/photo-1618551763300-dc7eb8ce3560?w=800&q=80",
      hostName: "Priya",
      attendeeCount: 9,
      location: "Lincoln Park Courts",
    },
    {
      id: "3",
      title: "Basketball Pickup at the Park",
      daysFromNow: 12,
      time: "11:00 AM",
      description:
        "Saturday morning runs at the park courts. Half-court, full-court, depends who shows. First-come, first-team.",
      image:
        "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80",
      hostName: "Marcus",
      attendeeCount: 11,
      location: "Lincoln Park Basketball Courts",
    },
    {
      id: "4",
      title: "Happy Hour at The Quarter",
      daysFromNow: 16,
      time: "5:30 PM",
      description:
        "$5 drafts, $7 wines, and half-off apps. We've got the back booth — come for a drink, stay for dinner.",
      image:
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
      hostName: "Sara",
      attendeeCount: 18,
      location: "The Quarter, 2 blocks away",
    },
    {
      id: "5",
      title: "Resident Dinner at Bocca",
      daysFromNow: 23,
      time: "7:00 PM",
      description:
        "Family-style Italian at the corner spot. Group menu, shared plates, BYOB. Cap at 16 — reserve your seat early.",
      image:
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
      hostName: "Devon",
      attendeeCount: 12,
      location: "Bocca Trattoria",
    },
    {
      id: "6",
      title: "Rooftop Sunset Mixer",
      daysFromNow: 30,
      time: "6:30 PM",
      description:
        "Meet the neighbors on the roof deck. Drinks, light bites, and skyline views. Hosted by the residents' committee.",
      image:
        "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800&q=80",
      hostName: "Priya",
      attendeeCount: 22,
      location: "Building Rooftop",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Sunday Brunch Crawl",
      description:
        "Hit two or three local brunch spots in a morning. Bottomless mimosas optional, friendships guaranteed.",
      category: "Food & Drink",
      image:
        "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80",
    },
    {
      id: "i2",
      title: "Trivia Night at the Pub",
      description:
        "Team up with your floor for trivia night at the neighborhood pub. Winner buys the next round.",
      category: "Social",
      image:
        "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&q=80",
    },
    {
      id: "i3",
      title: "Morning Run Club",
      description:
        "Easy 3-mile loop along the river. Coffee at the corner café after. All paces welcome.",
      category: "Fitness",
      image:
        "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80",
    },
    {
      id: "i4",
      title: "Movie Night in the Lounge",
      description:
        "Popcorn, projector, and a residents' vote on what to watch. Comfy clothes encouraged.",
      category: "Chill",
      image:
        "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80",
    },
  ],
  dealsHeader: "Local Deals",
  deals: [
    {
      id: "d1",
      businessName: "Bocca Trattoria",
      title: "20% off dinner, Mon–Thu",
      description: "Show the code at the table. Dine-in only.",
      address: "127 Lincoln Ave · 2 blocks away",
      promoCode: "LEAFBOCCA",
      dealType: "public",
      imageUrl:
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    },
    {
      id: "d2",
      businessName: "The Quarter",
      title: "$5 drafts after 9pm",
      description: "Weeknights only. Cash or card. Happy hour vibes.",
      address: "44 Park St · across the street",
      promoCode: "LEAFQUARTER",
      dealType: "public",
      imageUrl:
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
    },
    {
      id: "d3",
      businessName: "Frames Bowling",
      title: "Free shoes Wed & Sun",
      description: "Show the code at the counter when checking lanes.",
      address: "210 River Rd · 8 min walk",
      promoCode: "LEAFFRAMES",
      dealType: "public",
      imageUrl:
        "https://images.unsplash.com/photo-1545056453-f0359c3df6db?w=800&q=80",
    },
    {
      id: "d4",
      businessName: "Lincoln Park Café",
      title: "Buy one coffee, get one free",
      description: "Right now only — limited to ten redemptions in the next hour.",
      address: "12 Lincoln Park N · 1 block",
      dealType: "exclusive",
      redeemWindowMinutes: 60,
      imageUrl:
        "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    },
    {
      id: "d5",
      businessName: "Riverbend Fitness",
      title: "First class free",
      description: "Yoga, HIIT, or spin — your pick. New members only.",
      address: "300 River Rd · 6 min walk",
      promoCode: "LEAFRIVER",
      dealType: "public",
      imageUrl:
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80",
    },
    {
      id: "d6",
      businessName: "Park Slope Bookshop",
      title: "10% off all books",
      description: "Independent shop. Code works in-store and online.",
      address: "88 5th Ave · 5 min walk",
      promoCode: "LEAFREAD",
      dealType: "public",
      imageUrl:
        "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&q=80",
    },
  ],
};

export default function ApartmentPage() {
  return <CalendarLandingPage config={config} />;
}
