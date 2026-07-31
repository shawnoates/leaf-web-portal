import { helpSource } from "@/lib/help-source";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const query = (body.query || "").toLowerCase();

    if (!query || query.length < 1) {
      return Response.json({ results: [] });
    }

    const pages = helpSource.getPages();

    // Simple search: filter pages by title and description
    const results = pages
      .filter((page) => {
        const text = `${page.data.title} ${page.data.description}`.toLowerCase();
        const terms = query.split(" ");
        return terms.some((term: string) => text.includes(term));
      })
      .map((page) => ({
        id: page.url,
        url: page.url,
        title: page.data.title,
        description: page.data.description,
      }))
      .slice(0, 10); // Limit to 10 results

    return Response.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
