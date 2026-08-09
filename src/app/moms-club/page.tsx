"use client";

import CalendarLandingPage, {
  type LandingConfig,
} from "@/components/CalendarLandingPage";

const config: LandingConfig = {
  profileName: "Brooklyn Moms Club",
  profilePhoto: "https://randomuser.me/api/portraits/women/65.jpg",
  brandColor: "#db2777",
  followerCount: 156,
  navLabel: "Moms Club",
  plansHeader: "Upcoming Meetups",
  ctaTitle: "Build Your Mom Village",
  ctaSubtitle:
    "Create a free calendar for your moms group. Coordinate playdates, support circles, and nights out — without the group chat chaos.",
  ctaButtonLabel: "Create Your Moms Calendar",
  scrollPopupTitle: "Build your mom village",
  scrollPopupSubtitle: "Free calendar for moms groups",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free moms group calendar",
  plans: [
    {
      id: "1",
      title: "Stroller Walk in Prospect Park",
      daysFromNow: 3,
      time: "10:00 AM",
      description:
        "Easy 2-mile loop with coffee stops. Great way to meet other moms in the neighborhood. All ages welcome — strollers, carriers, or no kids at all.",
      image:
        "https://images.unsplash.com/photo-1773573924969-33c2ba2d7707?w=800&q=80",
      hostName: "Rachel",
      attendeeCount: 14,
      location: "Prospect Park, Grand Army Plaza",
    },
    {
      id: "2",
      title: "Mom & Baby Yoga",
      daysFromNow: 7,
      time: "11:00 AM",
      description:
        "Gentle yoga class designed for postpartum bodies, with babies welcome. Bring a blanket for baby. Trained instructor, judgment-free zone.",
      image:
        "https://images.unsplash.com/photo-1714646793234-9e58a9ccfddb?w=800&q=80",
      hostName: "Priya",
      attendeeCount: 9,
      location: "Park Slope Yoga Studio",
    },
    {
      id: "3",
      title: "Coffee Catch-up (Kids Welcome)",
      daysFromNow: 12,
      time: "9:30 AM",
      description:
        "Casual hangout at a kid-friendly cafe. Snacks for the littles, real coffee for us. Drop in for as long as you can stay.",
      image:
        "https://images.unsplash.com/photo-1653762378429-8030175fda56?w=800&q=80",
      hostName: "Jess",
      attendeeCount: 19,
      location: "Little Cupcake Bakeshop",
    },
    {
      id: "4",
      title: "Playground Meetup",
      daysFromNow: 21,
      time: "3:30 PM",
      description:
        "After-nap playground hang. Toddlers play, moms chat. Snacks shared. Bring sunscreen and patience.",
      image:
        "https://images.unsplash.com/photo-1638339972126-fbf92a92dd74?w=800&q=80",
      hostName: "Maya",
      attendeeCount: 22,
      location: "Carroll Park Playground",
    },
    {
      id: "5",
      title: "Mom's Night Out (No Kids!)",
      daysFromNow: 33,
      time: "7:30 PM",
      description:
        "Wine, dinner, adult conversation. Get a sitter — you've earned it. Reservation made for 12 at a Cobble Hill spot.",
      image:
        "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?w=800&q=80",
      hostName: "Rachel",
      attendeeCount: 12,
      location: "Henry Public, Cobble Hill",
    },
    {
      id: "6",
      title: "New Mom Support Circle",
      daysFromNow: 49,
      time: "1:00 PM",
      description:
        "Safe space for moms in the first year. Share, listen, vent, laugh. Babies welcome. Snacks and tissues provided.",
      image:
        "https://images.unsplash.com/photo-1758513359379-a1ccce73b09e?w=800&q=80",
      hostName: "Jess",
      attendeeCount: 8,
      location: "Member's Apartment, Park Slope",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Music Class for Toddlers",
      description:
        "Sing, dance, and shake instruments. Great for 1–3 year olds. Group rate available.",
      category: "Kids",
      image:
        "https://images.unsplash.com/photo-1509781827353-fb95c262fc40?w=800&q=80",
    },
    {
      id: "i2",
      title: "Park Picnic Playdate",
      description:
        "Pack a picnic, bring the kids, claim a shady spot. Easy summer hangout for the whole crew.",
      category: "Social",
      image:
        "https://images.unsplash.com/photo-1767239650392-1f73d63b5652?w=800&q=80",
    },
    {
      id: "i3",
      title: "Breastfeeding Support Group",
      description:
        "Lactation consultant Q&A and peer support. Feed, chat, and get answers.",
      category: "Support",
      image:
        "https://images.unsplash.com/photo-1583710457367-47de0ea21fef?w=800&q=80",
    },
    {
      id: "i4",
      title: "Mom & Me Story Time",
      description:
        "Library story hour for babies and toddlers. Free, walkable, and stroller-friendly.",
      category: "Kids",
      image:
        "https://images.unsplash.com/photo-1758598738003-3c2ea5c8b166?w=800&q=80",
    },
  ],
};

export default function MomsClubPage() {
  return <CalendarLandingPage config={config} />;
}
