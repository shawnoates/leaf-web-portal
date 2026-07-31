import { helpSource } from "@/lib/help-source";
import { notFound } from "next/navigation";
import { DocsPage, DocsBody } from "fumadocs-ui/page";
import type { Metadata } from "next";

interface HelpPageProps {
  params: Promise<{ slug?: string[] }>;
}

function getHelpPage(slug?: string[]) {
  if (!slug || slug.length === 0) {
    // For the root /help path, return the first page (index)
    const pages = helpSource.getPages();
    return pages[0] || null;
  }
  return helpSource.getPage(slug);
}

export async function generateStaticParams() {
  return helpSource
    .getPages()
    .map((page) => ({
      slug: page.url.split("/").filter(Boolean),
    }));
}

export async function generateMetadata(
  props: HelpPageProps
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = getHelpPage(slug);

  if (!page) {
    return {};
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}

export default async function HelpPage(props: HelpPageProps) {
  const { slug } = await props.params;
  const page = getHelpPage(slug);

  if (!page) {
    notFound();
  }

  return (
    <DocsPage>
      <DocsBody>
        <h1 className="font-light tracking-tight text-5xl mb-6">
          {page.data.title}
        </h1>
        {page.data.description && (
          <p className="text-lg text-zinc-600 mb-6">
            {page.data.description}
          </p>
        )}
      </DocsBody>
    </DocsPage>
  );
}
