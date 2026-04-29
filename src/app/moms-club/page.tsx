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
        "https://images.unsplash.com/photo-1607081692251-3eef061ba2bb?w=800&q=80",
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
        "https://images.unsplash.com/photo-1518309568569-43dd824f6b4d?w=800&q=80",
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
        "https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=800&q=80",
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
        "https://images.unsplash.com/photo-1597163399355-a39d31fbed4d?w=800&q=80",
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
        "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
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
        "https://images.unsplash.com/photo-1492725764893-90b379c2b6e7?w=800&q=80",
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
        "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=800&q=80",
    },
    {
      id: "i2",
      title: "Park Picnic Playdate",
      description:
        "Pack a picnic, bring the kids, claim a shady spot. Easy summer hangout for the whole crew.",
      category: "Social",
      image:
        "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&q=80",
    },
    {
      id: "i3",
      title: "Breastfeeding Support Group",
      description:
        "Lactation consultant Q&A and peer support. Feed, chat, and get answers.",
      category: "Support",
      image:
        "https://images.unsplash.com/photo-1542884748-2b87b36c6b90?w=800&q=80",
    },
    {
      id: "i4",
      title: "Mom & Me Story Time",
      description:
        "Library story hour for babies and toddlers. Free, walkable, and stroller-friendly.",
      category: "Kids",
      image:
        "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800&q=80",
    },
  ],
};

export default function MomsClubPage() {
  return <CalendarLandingPage config={config} />;
}
