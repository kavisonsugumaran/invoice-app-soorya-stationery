# Tech Stack Decisions

Decided during planning conversation with Claude, prior to build start. Recorded here
so the reasoning isn't lost when this moves into Cowork / Claude Code.

## Why Next.js (not separate React + Express)

- Folds frontend and API routes into a single deployable project
- Deploys as one unit on Vercel — no separate backend host to pay for or manage
- Keeps everything in one language/framework for a solo freelancer to maintain

## Why Tailwind CSS

- Invoice UI is mostly forms, tables, and totals — Tailwind's utility classes are
  fast for this without a separate stylesheet per component

## Why PostgreSQL via Neon (not SQLite)

- This is a live web app, not the offline desktop scenario — needs a real
  persistent, concurrent-safe database
- Neon's free tier is serverless Postgres that works natively with Vercel
  deployments, no server to manage

## Why Prisma

- Type-safe queries, easy migrations, straightforward for Claude Code to extend
  the schema later (e.g. when inventory management is added in a future phase)

### Pinned to Prisma 6.x, not 7 (as of scaffold, 2026-07-21)

`npm install prisma @prisma/client` installs 7.x by default, but Prisma 7 removed
support for `url` in the `datasource` block in `schema.prisma` — it now requires a
`prisma.config.ts` file plus a driver adapter instead of reading `DATABASE_URL`
directly from the schema. That breaks the existing `prisma/schema.prisma` in this
repo and the `.env`-based `migrate dev` / `migrate deploy` workflow described below.

Rather than restructure the schema and introduce adapter packages, `prisma` and
`@prisma/client` are pinned to **6.19.3** (last major compatible with this
schema-driven, `.env`-based setup). Confirmed `npx prisma generate` runs cleanly
against the unmodified schema at this version.

If upgrading to Prisma 7 later, it's a deliberate migration (schema changes +
`prisma.config.ts` + adapter package), not a routine `npm install` bump.

## Why pdfkit (not Puppeteer / headless Chrome)

- Puppeteer needs far more memory and execution time than Vercel's free-tier
  serverless functions comfortably allow
- pdfkit is lightweight and fast — appropriate for a simple, clean invoice layout
- `@react-pdf/renderer` is an acceptable alternative if a more component-based
  PDF layout approach is preferred later

## Why Vercel

- Native, first-class Next.js hosting
- Free tier is very likely sufficient for a single client's invoice volume
- Automatic SSL and custom domain support

## Budget Reference

Client proposal quoted LKR 21,000/year (~$60-65 USD/year at ~335 LKR/USD, July 2026
rate) for hosting + domain combined. This stack should land at or near $0/month
hosting cost (Vercel free tier + Neon free tier), with the domain (~$10-12/year)
as the main real cost. Re-check Vercel/Neon free tier limits if the client's
invoice volume grows significantly.

## Setup Commands (starting point)

```bash
npx create-next-app@latest pos-invoice-app --typescript --tailwind --app
cd pos-invoice-app
npm install prisma @prisma/client pdfkit
npm install -D @types/pdfkit
npx prisma init
```

Add to `package.json` scripts so Prisma client generates on every install
(needed for Vercel builds):

```json
"scripts": {
  "postinstall": "prisma generate"
}
```

## Deployment Steps

1. Create a free project at neon.tech, copy the connection string into
   `DATABASE_URL` (local `.env.local` and Vercel project env vars).
2. Connect the GitHub repo to Vercel.
3. Run `npx prisma migrate dev` locally to create tables; use
   `npx prisma migrate deploy` for production migrations.
4. Point the purchased domain (Namecheap/Cloudflare) at Vercel via custom
   domain settings — Vercel issues SSL automatically.
