import type { MDXComponents } from "mdx/types";

export const helpMdxComponents: MDXComponents = {
  h1: ({ children }) => (
    <h1 className="font-light tracking-tight text-4xl md:text-5xl mt-8 mb-4">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-light tracking-tight text-3xl md:text-4xl mt-6 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-light tracking-tight text-xl md:text-2xl mt-4 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-zinc-600 leading-relaxed my-4">
      {children}
    </p>
  ),
  a: ({ children, href }) => (
    <a href={href} className="text-zinc-900 underline hover:text-zinc-700">
      {children}
    </a>
  ),
};
