# KadeBill — Project Brief

This folder is the working directory for the client project: a simple invoice-generating
POS web application. Use this file as the orientation doc when starting a Cowork or
Claude Code session in this folder.

## Client & Scope

Client approved **Scenario 2 (Web Application)** from the attached business proposal
(`docs/Business_Proposal_Invoice_POS.docx`). See that document for full commercial
terms, timeline, and payment schedule.

Current scope (v1 — no inventory management):

- Manual entry of item name, unit price, and quantity per invoice line
- Automatic line total, subtotal, and grand total calculation
- Optional tax toggle — user can turn tax on/off per invoice, with a configurable
  tax percentage (not hardcoded)
- Auto-generated invoice number and date
- Business details header (name, address, contact) configurable in settings
- Printable / downloadable PDF invoice
- Save and view invoice history
- Basic input validation (price/quantity must be numeric and positive)
- Bill To details (name/phone/address) captured per invoice, saved to a lightweight
  Customer record for reuse — not a full customer CRM
- Manual Paid/Unpaid toggle per invoice (no real payment processing)
- Dashboard with invoice totals, paid/unpaid breakdown, a monthly revenue trend, and
  a recent invoices list

Explicitly out of scope for v1: inventory/stock management, multi-user accounts,
supplier databases, coupons/discounts, multi-currency, payment gateway integration,
due-date/overdue tracking. Full future-scope list is in the proposal doc, Section 7.

## Decided Tech Stack

- **Framework:** Next.js 15 (App Router) — frontend + API routes in one project
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL, hosted on **Neon** (free tier, serverless)
- **ORM:** Prisma — starter schema in `prisma/schema.prisma`
- **PDF generation:** `pdfkit` (avoid Puppeteer-based approaches — too heavy for
  Vercel's free-tier function limits)
- **Hosting:** Vercel (frontend + API routes together, since it's all Next.js)
- **Domain registrar:** Namecheap or Cloudflare Registrar (not yet purchased)

Rationale for this stack is in `docs/TECH_STACK_DECISIONS.md`.

## Budget Constraint (important)

The client proposal quoted **~LKR 21,000/year** for hosting + domain combined.
Next.js-on-Vercel + Neon free tier should keep this at or near **$0/month** for
hosting, with only the domain as a real annual cost (~$10-12/year). Keep this in
mind before introducing any paid add-ons (e.g. don't reach for Puppeteer-based
PDF rendering, paid Vercel tiers, or a paid Postgres plan unless usage genuinely
requires it).

## Next Steps / Suggested Build Order

1. Scaffold the Next.js project (see `docs/TECH_STACK_DECISIONS.md` for the exact
   `create-next-app` command and package installs).
2. Set up Prisma with the starter schema in `prisma/schema.prisma`, connect to a
   free Neon Postgres project.
3. Build the invoice creation form (item rows, tax toggle, live totals).
4. Build the invoice save + history list + single invoice view.
5. Add PDF generation endpoint (`/api/invoices/[id]/pdf`) using pdfkit.
6. Add business settings page (name/address/contact, default tax %).
7. Deploy to Vercel, connect custom domain once purchased.

## Open Questions to Resolve Early in Build

- Exact invoice number format (e.g. `INV-0001` vs date-based like `INV-20260721-01`)
- Whether tax should support more than one rate in the UI even though only one
  is used today (would make future multi-tax-rate scope easier, but is optional now)
- Printer-friendly PDF page size (A4 is the safe default for Sri Lanka)
