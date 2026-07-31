import { createFromSource } from "fumadocs-core/search/server";
import { helpSource } from "@/lib/help-source";

// Orama-based search over the Help Center content (title, description,
// headings, and full body via each page's structuredData). In-memory,
// no external service.
export const { GET } = createFromSource(helpSource);
