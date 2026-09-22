// Wrangler's "Text" module rule (see wrangler.toml [[rules]]) inlines .md/.html
// files as plain strings at build time — these declarations tell TypeScript
// what that import resolves to.

declare module "*.md" {
  const content: string;
  export default content;
}

declare module "*.html" {
  const content: string;
  export default content;
}
