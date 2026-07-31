import { loader } from "fumadocs-core/source";

// Phase 0 placeholder: manually construct the source data
// In Phase 1+, this will be generated from MDX files via Fumadocs' macro/config APIs
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
];

export const helpSource = loader({
  baseUrl: "/help",
  source: {
    files,
  },
});
