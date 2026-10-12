// Neighborhood landing config — plain data, kept out of page.tsx for the
// same reason as apartment/config.ts (named exports from page modules
// don't reliably survive the RSC transform when imported elsewhere).

import type { LandingConfig } from "@/components/CalendarLandingPage";

export const config: LandingConfig = {
  profileName: "Maple Heights Neighbors",
  profilePhoto:
    "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=400&q=80",
  brandColor: "#15803d",
  followerCount: 147,
  ctaTitle: "Bring Your Neighborhood Together",
  ctaSubtitle:
    "Create a free calendar for your neighborhood. Host block parties, porch concerts, potlucks, and cleanup days — neighbors RSVP in one tap.",
  ctaButtonLabel: "Create Your Neighborhood Calendar",
  ctaFootnote: "Free to get started · No credit card required",
  scrollPopupTitle: "A calendar for your neighborhood",
  scrollPopupSubtitle: "Free for neighbors — set up in 60 seconds",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free calendar for your neighborhood",
  plans: [
    {
      id: "1",
      title: "Maple Street Block Party",
      daysFromNow: 4,
      time: "3:00 PM",
      description:
        "The street's closed off from Oak to Elm. Grills, a bounce house for the kids, and a DJ on the Hendersons' porch. Bring a side to share.",
      image:
        "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&q=80",
      hostName: "Tasha",
      attendeeCount: 63,
      location: "Maple St, between Oak & Elm",
    },
    {
      id: "2",
      title: "Saturday Farmers Market Meetup",
      daysFromNow: 6,
      time: "9:30 AM",
      description:
        "Meet at the coffee cart, then wander the stalls together. Great way to put faces to the names on the group chat.",
      image:
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80",
      hostName: "Luis",
      attendeeCount: 24,
      location: "Maple Heights Farmers Market",
    },
    {
      id: "3",
      title: "Riverside Park Cleanup",
      daysFromNow: 10,
      time: "10:00 AM",
      description:
        "Gloves, bags, and grabbers provided. Two hours, then free bagels on us. Kids and dogs welcome.",
      image:
        "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=800&q=80",
      hostName: "Grace",
      attendeeCount: 31,
      location: "Riverside Park, north entrance",
    },
    {
      id: "4",
      title: "Porch Concert Series",
      daysFromNow: 13,
      time: "6:30 PM",
      description:
        "Three local bands on three porches, one block apart. Bring a lawn chair and stroll between sets.",
      image:
        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&q=80",
      hostName: "Ben",
      attendeeCount: 48,
      location: "Birch Ave porches",
    },
    {
      id: "5",
      title: "Potluck in the Park",
      daysFromNow: 19,
      time: "5:00 PM",
      description:
        "Spread out blankets under the big oak. Bring a dish from your family's kitchen — we'll label everything for allergies.",
      image:
        "https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=800&q=80",
      hostName: "Tasha",
      attendeeCount: 37,
      location: "Maple Heights Commons",
    },
    {
      id: "6",
      title: "Neighborhood Trivia Night",
      daysFromNow: 26,
      time: "7:30 PM",
      description:
        "Teams by street. Loser street hosts next month's coffee morning. Bragging rights are permanent.",
      image:
        "https://images.unsplash.com/photo-1671116810331-894618e447b8?w=800&q=80",
      hostName: "Luis",
      attendeeCount: 29,
      location: "The Elm Tap Room",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Community Stoop Sale",
      description:
        "Everyone sets out a table on the same Saturday. Declutter, haggle, and meet the folks three doors down.",
      category: "Community",
      image:
        "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&q=80",
    },
    {
      id: "i2",
      title: "Community Garden Workday",
      description:
        "Plant, weed, and water together. Take home whatever's ripe.",
      category: "Outdoors",
      image:
        "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
    },
    {
      id: "i3",
      title: "Dog Park Meetup",
      description:
        "Same time every Sunday. The dogs make friends first, the owners catch up.",
      category: "Social",
      image:
        "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800&q=80",
    },
    {
      id: "i4",
      title: "Morning Run Club",
      description:
        "Easy 5K loop through the neighborhood. Coffee on Maple after. All paces welcome.",
      category: "Fitness",
      image:
        "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&q=80",
    },
  ],
  dealsHeader: "Nearby deals for Maple Heights",
  deals: [
    {
      id: "d1",
      businessName: "Maple Street Coffee",
      title: "Buy one coffee, get one free",
      description: "Show the code at the counter. One redemption per neighbor.",
      address: "210 Maple St · 2 min walk",
      promoCode: "LEAFMAPLE",
      dealType: "public",
      interestCount: 38,
      imageUrl:
        "https://images.unsplash.com/photo-1635902981695-4bb5b00f5713?w=800&q=80",
    },
    {
      id: "d2",
      businessName: "Nonna's Kitchen",
      title: "20% off dinner, Mon–Thu",
      description: "Show the code at the table. Dine-in only.",
      address: "45 Oak Ave · 4 min walk",
      promoCode: "LEAFNONNA",
      dealType: "public",
      interestCount: 26,
      imageUrl:
        "https://images.unsplash.com/photo-1565895405227-31cffbe0cf86?w=800&q=80",
    },
    {
      id: "d3",
      businessName: "The Elm Tap Room",
      title: "$5 drafts on trivia night",
      description: "Tuesdays only. Mention Maple Heights at the bar.",
      address: "18 Elm St · 5 min walk",
      promoCode: "LEAFELM",
      dealType: "public",
      interestCount: 19,
      imageUrl:
        "https://images.unsplash.com/photo-1615332579037-3c44b3660b53?w=800&q=80",
    },
    {
      id: "d4",
      businessName: "Birch Ave Books",
      title: "10% off all books",
      description: "Independent shop. Code works in-store and online.",
      address: "88 Birch Ave · 6 min walk",
      promoCode: "LEAFBIRCH",
      dealType: "public",
      interestCount: 11,
      imageUrl:
        "https://images.unsplash.com/photo-1527908290749-8c9518e0db09?w=800&q=80",
    },
  ],
};
