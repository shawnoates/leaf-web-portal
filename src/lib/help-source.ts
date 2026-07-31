import { loader } from "fumadocs-core/source";

// Phase 1: Seed article data
// In future phases, this will be auto-generated from MDX files via fumadocs-mdx config
const files = [
  {
    type: "page" as const,
    path: "index.mdx",
    url: "/help",
    data: {
      title: "Welcome to Leaf Help",
      description: "Find answers to your questions about using Leaf calendars, hosting plans, RSVPs, organizations, and more.",
    },
  },
  // Getting Started
  {
    type: "page" as const,
    path: "getting-started/creating-a-calendar.mdx",
    url: "/help/getting-started/creating-a-calendar",
    data: {
      title: "Creating Your First Calendar",
      description: "Step-by-step guide to set up a calendar in Leaf and start planning with your community.",
    },
  },
  {
    type: "page" as const,
    path: "getting-started/inviting-people.mdx",
    url: "/help/getting-started/inviting-people",
    data: {
      title: "Inviting People to Your Calendar",
      description: "Learn how to invite friends, family, or community members to your Leaf calendar.",
    },
  },
  {
    type: "page" as const,
    path: "getting-started/understanding-the-dashboard.mdx",
    url: "/help/getting-started/understanding-the-dashboard",
    data: {
      title: "Understanding Your Dashboard",
      description: "A tour of the Leaf dashboard and how to navigate your calendars.",
    },
  },
  // Hosting
  {
    type: "page" as const,
    path: "hosting/creating-a-plan.mdx",
    url: "/help/hosting/creating-a-plan",
    data: {
      title: "Creating a Plan",
      description: "How to create and set up a new event or gathering in Leaf.",
    },
  },
  {
    type: "page" as const,
    path: "hosting/managing-rsvps.mdx",
    url: "/help/hosting/managing-rsvps",
    data: {
      title: "Managing RSVPs",
      description: "View and manage who's attending your plans, and send reminders.",
    },
  },
  {
    type: "page" as const,
    path: "hosting/editing-or-canceling-a-plan.mdx",
    url: "/help/hosting/editing-or-canceling-a-plan",
    data: {
      title: "Editing or Canceling a Plan",
      description: "How to make changes to a plan or cancel it.",
    },
  },
  {
    type: "page" as const,
    path: "hosting/plan-chat.mdx",
    url: "/help/hosting/plan-chat",
    data: {
      title: "Using Plan Chat",
      description: "Collaborate with attendees using the plan discussion thread.",
    },
  },
  // Organizations
  {
    type: "page" as const,
    path: "organizations/what-is-an-organization.mdx",
    url: "/help/organizations/what-is-an-organization",
    data: {
      title: "What Is an Organization?",
      description: "Learn how organizations work and when to create one.",
    },
  },
  {
    type: "page" as const,
    path: "organizations/adding-and-removing-members.mdx",
    url: "/help/organizations/adding-and-removing-members",
    data: {
      title: "Adding and Removing Members",
      description: "Manage who has access to your organization and its calendars.",
    },
  },
  {
    type: "page" as const,
    path: "organizations/roles-and-permissions.mdx",
    url: "/help/organizations/roles-and-permissions",
    data: {
      title: "Roles and Permissions",
      description: "Understand the different roles in an organization and what each can do.",
    },
  },
  // Calendars & RSVPs
  {
    type: "page" as const,
    path: "calendars-and-rsvps/how-rsvp-works.mdx",
    url: "/help/calendars-and-rsvps/how-rsvp-works",
    data: {
      title: "How RSVP Works",
      description: "Understand RSVPs and how to respond to invitations.",
    },
  },
  {
    type: "page" as const,
    path: "calendars-and-rsvps/calendar-sync.mdx",
    url: "/help/calendars-and-rsvps/calendar-sync",
    data: {
      title: "Syncing with Google Calendar",
      description: "Add Leaf plans to your Google Calendar automatically.",
    },
  },
  {
    type: "page" as const,
    path: "calendars-and-rsvps/notifications.mdx",
    url: "/help/calendars-and-rsvps/notifications",
    data: {
      title: "Push Notifications",
      description: "Learn about notifications and how to manage them.",
    },
  },
  // Billing
  {
    type: "page" as const,
    path: "billing/subscriptions-and-plans.mdx",
    url: "/help/billing/subscriptions-and-plans",
    data: {
      title: "Subscriptions and Plans",
      description: "Understand Leaf subscription tiers and what each includes.",
    },
  },
  {
    type: "page" as const,
    path: "billing/payment-methods.mdx",
    url: "/help/billing/payment-methods",
    data: {
      title: "Payment Methods",
      description: "Add and manage payment methods for your subscription.",
    },
  },
  // Account
  {
    type: "page" as const,
    path: "account/notification-settings.mdx",
    url: "/help/account/notification-settings",
    data: {
      title: "Notification Settings",
      description: "Customize when and how you receive notifications from Leaf.",
    },
  },
  {
    type: "page" as const,
    path: "account/deleting-your-account.mdx",
    url: "/help/account/deleting-your-account",
    data: {
      title: "Deleting Your Account",
      description: "Learn how to permanently delete your Leaf account.",
    },
  },
  // FAQ
  {
    type: "page" as const,
    path: "faq.mdx",
    url: "/help/faq",
    data: {
      title: "Frequently Asked Questions",
      description: "Quick answers to common questions about Leaf.",
    },
  },
];

export const helpSource = loader({
  baseUrl: "/help",
  source: {
    files,
  },
});
