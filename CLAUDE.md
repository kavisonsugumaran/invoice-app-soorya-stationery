# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

**KadeBill** — a POS invoice generator built for a real client, **Soorya Stationers** (a Colombo, Sri Lanka stationery shop). Core scope (v1): create invoices with line items and optional VAT, save/list/view them, track paid/unpaid status, manage a lightweight customer directory, and print onto the shop's existing **pre-printed dot-matrix continuous stationery** — this last part drives a chunk of the architecture (see below). Full scope and out-of-scope items are in `README.md`.

## Commands

```bash
npm run dev              # start dev server (localhost:3000)
npm run build             # production build
npm run lint               # eslint

npx prisma db push       # sync schema.prisma to the DB (no migration files — this project uses db push, not migrate)
npx prisma db seed         # wipe and reseed Invoice/InvoiceItem/Customer/BusinessSettings with demo data (prisma/seed.ts)
npx prisma generate        # regenerate Prisma Client (also runs automatically via postinstall)
npx tsc --noEmit          # typecheck (there is no separate `npm run typecheck` script)
```

There is no automated test suite (no Jest/Vitest/Playwright configured in the project). Verify changes by running the dev server and exercising the flow in a browser.

### Database

Two separate databases, switched via env file:
- `.env` — local Postgres (`postgresql://...@localhost:5432/pos_invoice_dev`), used by `npm run dev`.
- `.env.production` — Neon (hosted Postgres), only read when running a local production build (`next build && next start`). **Not** automatically used by Vercel deploys — Vercel's `DATABASE_URL` must be set separately in the Vercel project's environment variables, since `.env*` files are gitignored and never reach the build server.

`prisma` and `@prisma/client` are intentionally pinned to `6.19.3`, not the current major. Prisma 7 requires a `prisma.config.ts` + driver adapter and drops reading `DATABASE_URL` straight from `schema.prisma`'s `datasource` block, which this project relies on. Don't bump past 6.x without doing that migration deliberately (see `docs/TECH_STACK_DECISIONS.md`).

## Architecture

**Every mutation is a Server Action, not a Route Handler** — there is no `app/api/`. Actions live in `app/actions/{invoices,customers,settings}.ts`, are called directly from client components (not via `<form action={...}>`), and return a `{ success: true, ... } | { success: false, error: string }` object rather than throwing or calling `redirect()`. Callers branch on `result.success` and handle navigation themselves via `useRouter()`. Follow this pattern for new mutations rather than introducing Route Handlers or server-side redirects.

**Read path**: Server Components (pages) call plain async functions in `lib/{invoices,customers,dashboard,settings}.ts` (thin Prisma query wrappers) and pass the data down as props to client components. There's no client-side data-fetching layer (no SWR/React Query) — pages re-fetch fresh on every navigation.

**Money math is centralized in `lib/invoice-math.ts`** (`round2`, `computeLineTotal`, `computeInvoiceTotals`) and reused by the create-invoice Server Action, the live form preview, and both print renderers. Never reimplement line-total/subtotal/tax rounding inline — several call sites already got de-duplicated into this module once.

**Invoice numbers** are generated server-side in `app/actions/invoices.ts` as `YYMMM_QQQQ_XXXXX` (e.g. `26JUL_SRY_00004`), per Sri Lanka's Gazette Extraordinary No. 2481/22 (effective 2026-07-01) — `YY`+`MMM` (uppercase month, no separator between them), then `BusinessSettings.invoiceUnitCode` (business/branch code, defaults `"SRY"`, falls back if the row is missing), then a 5-digit zero-padded serial. Always computed in the `Asia/Colombo` timezone (not server-local time), with a **per-month** counter (not per-day — the prefix is year+month, so the serial resets each calendar month) and the same retry-on-unique-conflict loop as before (handles concurrent saves from multiple terminals). Invoices created before this change keep their old `INV-YYYYMMDD-NN` numbers — this only affects generation going forward, never a retroactive rename.

**Customers auto-dedupe by phone number**: `upsertCustomer()` in `app/actions/invoices.ts` looks up an existing customer by phone when an invoice is created and updates name/address/TIN on that record instead of creating a duplicate. Phone is the de-dup key, not name.

### The dot-matrix pre-printed form system

This is the most non-obvious part of the codebase. The shop prints onto **physical pre-printed stationery** (their logo/boxes/labels are already on the paper) using a dot-matrix printer — the app only needs to print the *variable* data (dates, customer info, line items, totals) positioned to land in the blank spaces on that paper.

- `public/pre-printed-invoice-form.jpg` — an actual photo of the real stationery. It's shown as an on-screen-only background image for visual accuracy; it is **never** part of what actually prints (hidden via `print:hidden` CSS), since the real paper already has it. As of the 2026-07 paper revision, the printer stopped pre-printing "TAX INVOICE" and the "Tax Invoice No." label — that area is now a blank box on the paper, so the app prints both (plus the invoice number) itself, but **only when VAT is applied** (`taxEnabled`); a plain non-VAT invoice leaves it blank, matching the paper.
- `lib/dot-matrix-layout.ts` — `DM_LAYOUT` defines every field's position as a **percentage of the page** (not pixels), measured against the reference photo. `DM_PAGE_WIDTH_MM`/`DM_PAGE_HEIGHT_MM` assume 9.5"×11" continuous fanfold stationery (241.3mm × 279mm — wider than US Letter because of the tractor-feed hole strips on both edges). If you touch these coordinates, verify against the actual photo, not guesswork — several past miscalibrations came from eyeballing a screenshot instead of the source image.
- `components/invoice-print/DotMatrixInvoice.tsx` — renders the real invoice data as absolutely-positioned text (`Field` component) at those coordinates, optionally with the reference photo behind it (`showBackgroundImage`). Text fields that can be arbitrarily long use `truncateWidthMm` (single-line ellipsis — for item table cells, which have no room to wrap without colliding with the next row) or `maxWidthMm` (wraps, for the Additional Information box which has blank space below it). Any new free-text field needs one of these or it will silently overflow off the page.
- `components/invoice-print/DotMatrixCalibrationSheet.tsx` — prints crosshair marks (not real data) at every `DM_LAYOUT` position, for physically calibrating a real printer against real paper.
- Per-business fine-tuning offsets (`dmOffsetXMm`, `dmOffsetYMm`, `dmFontSizePt`, `dmItemRowMm`) live on `BusinessSettings` and are editable at `/settings`; `/settings/print-test` prints the calibration sheet. These offsets apply *on top of* the base `DM_LAYOUT` percentages — a wrong value here silently shifts every field on every invoice (this has bitten testing before: a leftover manual-test value in `dmOffsetXMm` shifted every field 3mm before being noticed).
- `components/invoices/InvoicePreviewPanel.tsx` toggles between this "Pre-printed Form" view and a separate full-color "Digital Copy" (`components/invoice-form/InvoicePreview.tsx`, a from-scratch styled recreation used for emailing/digital-only records). Both read from the same invoice data; only the rendering differs.

### Data model notes (`prisma/schema.prisma`)

- `Invoice.customerId` is optional and `ON DELETE SET NULL` — deleting a customer never deletes their invoices, it just unlinks them.
- `Invoice` carries the Sri Lankan VAT tax-invoice fields (`dateOfDelivery`, `placeOfSupply`, `modeOfPayment`, `additionalInfo`) and `InvoiceItem.reference` beyond what a typical invoice schema needs — these exist specifically to match the fields on the physical pre-printed form.
- `taxEnabled`/`taxPercent` are per-invoice, not inherited live from `BusinessSettings.defaultTax` (that field is just a suggested default for the form).

## Design tokens

Theme colors are CSS custom properties in `app/globals.css` (`--color-primary`, `--color-surface`, `--color-success`/`warning`/`danger` + `-muted` variants, `--color-sidebar-*`), consumed via Tailwind v4's `@theme inline`. The app is light-mode only (dark-mode media query support was deliberately removed). Customer/item avatar colors are a separate deterministic palette in `lib/avatar-colors.ts` (hash-of-name → color), not part of the theme tokens.
