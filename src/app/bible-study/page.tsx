"use client";

import CalendarLandingPage, {
  type LandingConfig,
} from "@/components/CalendarLandingPage";

const config: LandingConfig = {
  profileName: "Gateway Community Church",
  profilePhoto: "https://randomuser.me/api/portraits/men/52.jpg",
  brandColor: "#b45309",
  followerCount: 428,
  navLabel: "Church",
  plansHeader: "Upcoming Gatherings",
  ctaTitle: "Build Your Church Community",
  ctaSubtitle:
    "Create a free calendar for your church. Coordinate services, small groups, and outreach — all in one place your community can access.",
  ctaButtonLabel: "Create Your Church Calendar",
  scrollPopupTitle: "Run your church's calendar",
  scrollPopupSubtitle: "Free for churches of any size",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free church calendar",
  plans: [
    {
      id: "1",
      title: "Sunday Service",
      daysFromNow: 4,
      time: "9:30 AM",
      description:
        "Worship, teaching from Pastor Mark, and communion together. Coffee and fellowship in the lobby afterward. Kids' programs available for all ages.",
      image:
        "https://images.unsplash.com/photo-1522158637959-30385a09e0da?w=800&q=80",
      hostName: "Pastor Mark",
      attendeeCount: 240,
      location: "Main Sanctuary",
    },
    {
      id: "2",
      title: "Wednesday Bible Study: Book of John",
      daysFromNow: 7,
      time: "7:00 PM",
      description:
        "Week 4 of our 12-week study through the Gospel of John. Bring your Bible, a notebook, and an open heart. Childcare provided.",
      image:
        "https://images.unsplash.com/photo-1611242254711-3f3e21033e4b?w=800&q=80",
      hostName: "Pastor Mark",
      attendeeCount: 32,
      location: "Fellowship Hall",
    },
    {
      id: "3",
      title: "Men's Breakfast",
      daysFromNow: 12,
      time: "7:00 AM",
      description:
        "Pancakes, coffee, and a short devotional. A great way to start your Saturday with brothers in faith. All men welcome — bring a friend.",
      image:
        "https://images.unsplash.com/photo-1701280316378-d12dc6d9306a?w=800&q=80",
      hostName: "David",
      attendeeCount: 18,
      location: "Fellowship Hall",
    },
    {
      id: "4",
      title: "Women's Connect Group",
      daysFromNow: 18,
      time: "6:30 PM",
      description:
        "A safe space for women to gather, share, and grow together. This month we're discussing the book \"Adorned\" by Nancy Wolgemuth.",
      image:
        "https://images.unsplash.com/photo-1590650046871-92c887180603?w=800&q=80",
      hostName: "Sarah",
      attendeeCount: 24,
      location: "Room 201",
    },
    {
      id: "5",
      title: "Youth Night",
      daysFromNow: 25,
      time: "6:00 PM",
      description:
        "Games, worship, teaching, and pizza. For students grades 6–12. Friends always welcome — bring someone new.",
      image:
        "https://images.unsplash.com/photo-1569617084133-26942bb441f2?w=800&q=80",
      hostName: "Jordan",
      attendeeCount: 45,
      location: "Youth Center",
    },
    {
      id: "6",
      title: "Community Service Day",
      daysFromNow: 38,
      time: "9:00 AM",
      description:
        "Serving our neighbors at the local food bank and community garden. Lunch provided. Family-friendly — bring the kids to serve alongside you.",
      image:
        "https://images.unsplash.com/photo-1758599669406-d5179ccefcb9?w=800&q=80",
      hostName: "Pastor Mark",
      attendeeCount: 60,
      location: "Riverside Food Bank",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Marriage Enrichment Workshop",
      description:
        "A Saturday focused on strengthening marriages. Practical teaching, group discussion, and a date night to close.",
      category: "Workshop",
      image:
        "https://images.unsplash.com/photo-1542338347-4fff3276af78?w=800&q=80",
    },
    {
      id: "i2",
      title: "Prayer & Worship Night",
      description:
        "An evening of corporate prayer and worship. Open mic for testimonies, extended worship sets, and time to seek God together.",
      category: "Worship",
      image:
        "https://images.unsplash.com/photo-1570786032462-2efc3ca8fccd?w=800&q=80",
    },
    {
      id: "i3",
      title: "Food Bank Volunteering",
      description:
        "Pack and distribute meals at our partner food bank. Two-hour shift. Great for groups, families, or solo volunteers.",
      category: "Service",
      image:
        "https://images.unsplash.com/photo-1593113616828-6f22bca04804?w=800&q=80",
    },
    {
      id: "i4",
      title: "New Member Welcome Lunch",
      description:
        "Lunch with the pastors and ministry leaders. Hear our story, share yours, and find your place in the community.",
      category: "Welcome",
      image:
        "https://images.unsplash.com/photo-1721180672597-beddd124205a?w=800&q=80",
    },
  ],
};

export default function BibleStudyPage() {
  return <CalendarLandingPage config={config} />;
}
