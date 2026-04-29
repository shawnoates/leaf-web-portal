"use client";

import CalendarLandingPage, {
  type LandingConfig,
} from "@/components/CalendarLandingPage";

const config: LandingConfig = {
  profileName: "Sunset Yoga Co.",
  profilePhoto: "https://randomuser.me/api/portraits/women/68.jpg",
  brandColor: "#c2410c",
  followerCount: 184,
  navLabel: "Studio",
  plansHeader: "Upcoming Classes",
  ideasHeader: "Open Practice",
  ideasTitle: "Teach a Class",
  ideasButtonLabel: "Teach This",
  ctaTitle: "Build Your Studio Community",
  ctaSubtitle:
    "Create a free calendar for your studio. Schedule classes, manage RSVPs, and keep your community in flow.",
  ctaButtonLabel: "Create Your Studio Calendar",
  scrollPopupTitle: "Run your studio's calendar",
  scrollPopupSubtitle: "Free for studios and teachers",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free studio calendar",
  plans: [
    {
      id: "1",
      title: "Morning Vinyasa Flow",
      daysFromNow: 2,
      time: "7:00 AM",
      description:
        "Start your day with breath and movement. 60-minute flow class for all levels. Mats and props provided.",
      image:
        "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80",
      hostName: "Lila",
      attendeeCount: 18,
      location: "Studio A",
    },
    {
      id: "2",
      title: "Sound Bath & Meditation",
      daysFromNow: 9,
      time: "7:30 PM",
      description:
        "Crystal singing bowls, gongs, and chimes. A 75-minute journey of deep relaxation. Bring a blanket and water.",
      image:
        "https://images.unsplash.com/photo-1593811167562-9cef47bfc4d7?w=800&q=80",
      hostName: "Kai",
      attendeeCount: 22,
      location: "Studio B",
    },
    {
      id: "3",
      title: "Outdoor Yoga in the Park",
      daysFromNow: 17,
      time: "9:00 AM",
      description:
        "Donation-based community class under the trees. Slow flow with a meditation finish. Bring your own mat.",
      image:
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&q=80",
      hostName: "Lila",
      attendeeCount: 35,
      location: "Riverside Park, Cherry Walk",
    },
    {
      id: "4",
      title: "Yin Yoga & Tea Ceremony",
      daysFromNow: 28,
      time: "6:00 PM",
      description:
        "Long, restorative holds paired with a guided tea meditation. Perfect for nervous system reset. Limited to 12.",
      image:
        "https://images.unsplash.com/photo-1599447421416-3414500d18a5?w=800&q=80",
      hostName: "Sage",
      attendeeCount: 11,
      location: "Studio A",
    },
    {
      id: "5",
      title: "Beginner's Workshop",
      daysFromNow: 42,
      time: "11:00 AM",
      description:
        "Two-hour intro to yoga foundations. Breath, alignment, and basic poses. Perfect if you've never tried before.",
      image:
        "https://images.unsplash.com/photo-1588286840104-8957b019727f?w=800&q=80",
      hostName: "Maren",
      attendeeCount: 9,
      location: "Studio B",
    },
    {
      id: "6",
      title: "Full Moon Restorative",
      daysFromNow: 60,
      time: "8:00 PM",
      description:
        "Candlelit restorative practice synced with the lunar cycle. Bolsters, blankets, and intention setting.",
      image:
        "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&q=80",
      hostName: "Sage",
      attendeeCount: 16,
      location: "Studio A",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Partner Yoga Workshop",
      description:
        "Bring a friend or partner. Two-person poses, trust exercises, lots of laughs.",
      category: "Workshop",
      image:
        "https://images.unsplash.com/photo-1518644961665-ed172691aaa1?w=800&q=80",
    },
    {
      id: "i2",
      title: "Yoga + Brunch Sunday",
      description:
        "Slow flow followed by a community potluck brunch. Members bring dishes to share.",
      category: "Social",
      image:
        "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800&q=80",
    },
    {
      id: "i3",
      title: "Breathwork Series",
      description:
        "Four-week pranayama intensive. Learn techniques for energy, calm, and focus.",
      category: "Series",
      image:
        "https://images.unsplash.com/photo-1474418397713-7ede21d49118?w=800&q=80",
    },
    {
      id: "i4",
      title: "Teacher Training Info Night",
      description:
        "Curious about becoming a yoga teacher? Q&A with our 200hr lead instructors.",
      category: "Info",
      image:
        "https://images.unsplash.com/photo-1591291621164-2c6367723315?w=800&q=80",
    },
  ],
};

export default function YogaStudioPage() {
  return <CalendarLandingPage config={config} />;
}
