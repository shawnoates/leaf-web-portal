"use client";

import CalendarLandingPage, {
  type LandingConfig,
} from "@/components/CalendarLandingPage";

const config: LandingConfig = {
  profileName: "ATL Run Club",
  profilePhoto: "https://randomuser.me/api/portraits/women/44.jpg",
  brandColor: "#dc2626",
  followerCount: 312,
  navLabel: "Run Club",
  plansHeader: "Upcoming Runs",
  ctaTitle: "Build Your Run Club",
  ctaSubtitle:
    "Create a free calendar for your run club. Schedule routes, track RSVPs, and grow your crew.",
  ctaButtonLabel: "Create Your Run Club Calendar",
  scrollPopupTitle: "Start your own run club",
  scrollPopupSubtitle: "Free calendar for crews",
  scrollPopupButton: "Get Started — Free",
  bottomCtaText: "Create a free run club calendar",
  plans: [
    {
      id: "1",
      title: "Sunday Long Run — Piedmont Park",
      daysFromNow: 5,
      time: "7:00 AM",
      description:
        "8-mile loop through Piedmont Park and the Beltline. Pace groups for 8:00, 9:00, and 10:00 minute miles. Coffee and bagels at the finish.",
      image:
        "https://images.unsplash.com/photo-1645238426817-8c3e7d1396cf?w=800&q=80",
      hostName: "Jordan",
      attendeeCount: 34,
      location: "Piedmont Park, 14th St Entrance",
    },
    {
      id: "2",
      title: "Tuesday Track Workout",
      daysFromNow: 8,
      time: "6:30 PM",
      description:
        "Speed work at Grady Stadium. 6x800m repeats with 400m recovery. Coach Dani will lead warmup and cooldown. All paces welcome.",
      image:
        "https://images.unsplash.com/photo-1582893523490-dd68ebc7884e?w=800&q=80",
      hostName: "Dani",
      attendeeCount: 18,
      location: "Grady High School Track",
    },
    {
      id: "3",
      title: "BeltLine Tempo Run",
      daysFromNow: 16,
      time: "6:00 PM",
      description:
        "5-mile tempo run on the Eastside Trail. Steady effort, sustainable pace. Perfect for race prep. Hangout at Ponce City Market after.",
      image:
        "https://images.unsplash.com/photo-1759084488037-c0457596ea60?w=800&q=80",
      hostName: "Marcus",
      attendeeCount: 22,
      location: "Eastside BeltLine Trail",
    },
    {
      id: "4",
      title: "Saturday 5K + Brunch",
      daysFromNow: 26,
      time: "8:00 AM",
      description:
        "Casual 5K through Inman Park, then brunch at Café Bartolotti. The run is the warmup — the brunch is the event.",
      image:
        "https://images.unsplash.com/photo-1535567465397-7523840f2ae9?w=800&q=80",
      hostName: "Ashley",
      attendeeCount: 41,
      location: "Inman Park",
    },
    {
      id: "5",
      title: "Stone Mountain Trail Run",
      daysFromNow: 40,
      time: "9:00 AM",
      description:
        "6-mile trail loop with serious elevation. Trail shoes recommended. We'll regroup at the summit for views and group photo.",
      image:
        "https://images.unsplash.com/photo-1623390003553-4fa3f9fceb89?w=800&q=80",
      hostName: "Tasha",
      attendeeCount: 15,
      location: "Stone Mountain Park",
    },
    {
      id: "6",
      title: "Beer Mile Social",
      daysFromNow: 55,
      time: "5:30 PM",
      description:
        "The annual ATLRC Beer Mile. 4 beers, 4 laps, all the chaos. Spectators welcome. Costumes encouraged. Trophy for the winner.",
      image:
        "https://images.unsplash.com/photo-1758272133713-52c6bb9f74f0?w=800&q=80",
      hostName: "Marcus",
      attendeeCount: 28,
      location: "Westside Park",
    },
  ],
  planIdeas: [
    {
      id: "i1",
      title: "Hill Repeats at Cabbagetown",
      description:
        "Brutal but worth it. 8 repeats up the steepest street in ATL. Bring water and ego.",
      category: "Workout",
      image:
        "https://images.unsplash.com/photo-1602248349498-3cdaf3600cf8?w=800&q=80",
    },
    {
      id: "i2",
      title: "Sunrise Run + Coffee",
      description:
        "Easy 4 miles before the city wakes up. End at a local roaster for coffee and pastries.",
      category: "Recovery",
      image:
        "https://images.unsplash.com/photo-1594882645126-14020914d58d?w=800&q=80",
    },
    {
      id: "i3",
      title: "Stadium Stairs Workout",
      description:
        "Cross-training at Bobby Dodd Stadium. Stairs, hill sprints, and core work. 45 minutes of pain.",
      category: "Workout",
      image:
        "https://images.unsplash.com/photo-1776799734087-a39d3d62c1ba?w=800&q=80",
    },
    {
      id: "i4",
      title: "Race Training Plan Kickoff",
      description:
        "12-week half marathon plan. Group meets weekly. Coach-led, beginner friendly.",
      category: "Training",
      image:
        "https://images.unsplash.com/photo-1540539234-c14a20fb7c7b?w=800&q=80",
    },
  ],
};

export default function RunClubPage() {
  return <CalendarLandingPage config={config} />;
}
