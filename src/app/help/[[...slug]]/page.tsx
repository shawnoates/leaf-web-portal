import { helpSource } from "@/lib/help-source";
import { helpMdxComponents } from "@/components/help-mdx";
import { notFound } from "next/navigation";
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from "fumadocs-ui/page";
import type { Metadata } from "next";

interface HelpPageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  return helpSource.generateParams();
}

export async function generateMetadata(
  props: HelpPageProps
): Promise<Metadata> {
  const { slug } = await props.params;
  const page = helpSource.getPage(slug);

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
  const page = helpSource.getPage(slug);

  if (!page) {
    notFound();
  }

  const MDXBody = page.data.body;

  return (
    <DocsPage toc={page.data.toc}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXBody components={helpMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}
