// Ported from leaf-appcode/Leaflet/SwiftUI ViewModels/Common View Models/StreakStatsVM.swift
// Keep this list in sync with the iOS app's StreakQuote.quotes.

export interface StreakQuote {
  author: string;
  quote: string;
}

export const STREAK_QUOTES: StreakQuote[] = [
  { author: "Helen Keller", quote: "Alone we can do so little; together we can do so much." },
  { author: "Mattie Stepanek", quote: "Unity is strength... when there is teamwork and collaboration, wonderful things can be achieved." },
  { author: "Henry Ford", quote: "Coming together is a beginning, staying together is progress, and working together is success." },
  { author: "Martin Luther King Jr.", quote: "We may have all come on different ships, but we're in the same boat now." },
  { author: "Ryunosuke Satoro", quote: "Individually, we are one drop. Together, we are an ocean." },
  { author: "Peter Drucker", quote: "The best way to predict the future is to create it together." },
  { author: "Margaret J. Wheatley", quote: "There is no power for change greater than a community discovering what it cares about." },
  { author: "Phil Jackson", quote: "The strength of the team is each individual member. The strength of each member is the team." },
  { author: "Vala Afshar", quote: "We are not a team because we work together. We are a team because we respect, trust, and care for each other." },
  { author: "John Heywood", quote: "Many hands make light work." },
  { author: "Henry Ford", quote: "If everyone is moving forward together, then success takes care of itself." },
  { author: "Edward Everett Hale", quote: "Coming together is a beginning; keeping together is progress; working together is success." },
  { author: "H.E. Luccock", quote: "No one can whistle a symphony. It takes a whole orchestra to play it." },
  { author: "Bang Gae", quote: "Teamwork makes the dream work." },
  { author: "Amy Poehler", quote: "Find a group of people who challenge and inspire you; spend a lot of time with them, and it will change your life." },
  { author: "African Proverb", quote: "If you want to go fast, go alone. If you want to go far, go together." },
  { author: "Aristotle", quote: "The whole is greater than the sum of its parts." },
  { author: "Idowu Koyenikan", quote: "There is immense power when a group of people with similar interests gets together to work toward the same goals." },
  { author: "Louisa May Alcott", quote: "It takes two flints to make a fire." },
  { author: "Sonia Johnson", quote: "Coming together with those who share common attitudes is one of the chief ways we reaffirm the values we hold." },
  { author: "James Cash Penney", quote: "The best teamwork comes from men who are working independently toward one goal in unison." },
  { author: "J.K. Rowling", quote: "We are only as strong as we are united, as weak as we are divided." },
  { author: "Michael Jordan", quote: "Talent wins games, but teamwork and intelligence win championships." },
  { author: "Steve Jobs", quote: "Great things in business are never done by one person. They're done by a team of people." },
  { author: "Napoleon Hill", quote: "It is literally true that you can succeed best and quickest by helping others to succeed." },
  { author: "Andrew Carnegie", quote: "Teamwork is the ability to work together toward a common vision. The ability to direct individual accomplishments toward organizational objectives. It is the fuel that allows common people to attain uncommon results." },
  { author: "Mahatma Gandhi", quote: "The best way to find yourself is to lose yourself in the service of others." },
  { author: "Robert Orben", quote: "If you can laugh together, you can work together." },
  { author: "Vincent van Gogh", quote: "Great things are not done by impulse but by a series of small things brought together." },
  { author: "Babe Ruth", quote: "The way a team plays as a whole determines its success. You may have the greatest bunch of individual stars in the world, but if they don't play together, the club won't be worth a dime." },
  { author: "Bill Bethel", quote: "A successful team is a group of many hands and one mind." },
  { author: "Booker T. Washington", quote: "If you want to lift yourself up, lift up someone else." },
  { author: "Benjamin Franklin", quote: "We must all hang together or most assuredly we shall all hang separately." },
  { author: "Simon Sinek", quote: "A team is not a group of people who work together. A team is a group of people who trust each other." },
];

export function getRandomStreakQuote(): StreakQuote {
  return STREAK_QUOTES[Math.floor(Math.random() * STREAK_QUOTES.length)];
}
