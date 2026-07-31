import type { ReactNode } from "react";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { helpSource } from "@/lib/help-source";
import "@/app/help/help-theme.css";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      // Leaf's site is light-only; force light so the Fumadocs sidebar and the
      // white content area stay consistent (no system/dark mismatch).
      theme={{ forcedTheme: "light", enabled: false }}
      search={{
        options: {
          api: "/api/help-search",
        },
      }}
    >
      <DocsLayout
        tree={helpSource.pageTree}
        nav={{ title: "Help Center" }}
        themeSwitch={{ enabled: false }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
