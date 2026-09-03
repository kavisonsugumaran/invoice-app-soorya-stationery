/**
 * Max item rows that fit one physical 5.5in x 5.5in small-bill sheet (the
 * Jollimark blank stock) — see SmallBillPrint.tsx's fixed ruled grid, which
 * is sized against this same number. Shared with
 * app/actions/invoices.ts's createSmallBill(), which uses it to decide when
 * a bill needs to become more than one: past this many items, the excess is
 * created as a genuinely separate Invoice row with its own sequential bill
 * number (E0XX), not a second print page of the same bill — a physical
 * sheet can't literally grow taller than one page, and per product
 * decision a bill that spills onto a second sheet is a new bill for the
 * same customer, not a continuation.
 */
export const SMALL_BILL_ITEMS_PER_PAGE = 12;
