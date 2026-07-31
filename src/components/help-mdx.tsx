import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

// Fumadocs' default MDX components (proper heading anchors, code blocks,
// callouts, cards, etc.) with room for brand-specific overrides.
// Visual styling is handled by the scoped prose rules in help.css.
export function getHelpMdxComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
