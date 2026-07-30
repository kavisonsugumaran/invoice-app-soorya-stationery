// Stub for the "server-only" package in tests. The real package throws when
// imported outside a Next.js Server Component bundle — a false positive here
// since Vitest runs plain Node, not Next's build pipeline. Aliased in
// vitest.config.ts.
export {};
