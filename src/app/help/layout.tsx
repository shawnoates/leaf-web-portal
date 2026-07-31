import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { helpSource } from "@/lib/help-source";
import "fumadocs-ui/css/neutral.css";
import "@/app/help/help.css";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout tree={helpSource.pageTree} nav={{ title: "Help Center" }}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
