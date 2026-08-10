"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import { computeInvoiceTotals, computeLineTotal } from "@/lib/invoice-math";
import { findProductByExactName } from "@/lib/products";
import { createProductWithReference } from "@/app/actions/products";
import { requireUser, requireAdmin } from "@/lib/auth-guard";
import { tinError } from "@/lib/validation";
import { normalizePhone } from "@/lib/phone-format";

export type InvoiceItemInput = {
  reference: string;
  name: string;
  price: number;
  quantity: number;
  /** Set when the item was picked from the product autocomplete — links to that catalog entry. */
  productId?: string;
};

export type BillToInput = {
  name: string;
  phone: string;
  address: string;
  taxId: string;
  /** Set when the customer was picked from the autocomplete — updates that exact record instead of matching by phone. */
  customerId?: string;
};

export type CreateInvoiceInput = {
  items: InvoiceItemInput[];
  taxEnabled: boolean;
  taxPercent: number;
  billTo: BillToInput;
  /** Invoice issuance date. Defaults to now (create) / left unchanged (update) if omitted. */
  date?: string;
  dateOfDelivery: string;
  placeOfSupply: string;
  modeOfPayment: string;
  additionalInfo: string;
  /**
   * TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md):
   * when true, skips Gazette-format numbering entirely and uses oldInvoiceNo
   * (typed in by the client to match their handwritten paper copy) as the
   * invoice number directly, so backfilling old handwritten invoices never
   * advances the real counter new invoices rely on. Remove this flag (and
   * its handling below) once the backfill is finished.
   */
  isOldInvoice?: boolean;
  /**
   * TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md):
   * required when isOldInvoice is true. Used verbatim as the invoice number
   * (a single create attempt, not the retry-and-increment Gazette loop) —
   * client enters it directly rather than getting an auto-assigned
   * placeholder to be corrected in the DB later. Remove alongside
   * isOldInvoice once the backfill is finished.
   */
  oldInvoiceNo?: string;
};

export type CreateInvoiceResult =
  | { success: true; id: string; invoiceNo: string }
  | { success: false; error: string };

const INVOICE_TIME_ZONE = "Asia/Colombo";

// Invoice number format per Gazette Extraordinary No. 2481/22 (effective
// 2026-07-01): YYMMM_QQQQ_XXXXX — YY+MMM (year + uppercase month) with no
// separator between them, then the business's unit/branch code, then a
// zero-padded serial. The counter resets monthly (the prefix is YYMMM, not
// a full date), unlike the old per-day INV-YYYYMMDD-NN scheme this replaces.
const DEFAULT_INVOICE_UNIT_CODE = "SST";
const INVOICE_UNIT_CODE_MAX_LEN = 10; // keeps the total well under the gazette's 40-char cap
const INVOICE_SERIAL_DIGITS = 5;

function invoiceYearMonthPrefix(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: INVOICE_TIME_ZONE,
    year: "2-digit",
    month: "short",
  }).formatToParts(new Date());

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.year}${lookup.month.toUpperCase()}`;
}

/**
 * The highest numeric serial already in use among invoiceNo values starting
 * with `prefix` (0 if none exist). Deliberately not a row count — a count
 * only matches the highest serial when there are no gaps, which doesn't hold
 * once anything (like the temporary Aug 2026 floor) deliberately introduces one.
 */
async function highestExistingSerial(prefix: string): Promise<number> {
  const existing = await prisma.invoice.findMany({
    where: { invoiceNo: { startsWith: prefix } },
    select: { invoiceNo: true },
  });

  let max = 0;
  for (const { invoiceNo } of existing) {
    const serial = Number.parseInt(invoiceNo.slice(prefix.length), 10);
    if (Number.isFinite(serial) && serial > max) {
      max = serial;
    }
  }
  return max;
}

function validate(input: CreateInvoiceInput): string | null {
  // Purchaser details are only mandatory for VAT tax invoices (compliance
  // requirement) — a plain non-VAT sale can be recorded without them.
  if (input.taxEnabled && (!input.billTo?.name || !input.billTo.name.trim())) {
    return "Bill To name is required when VAT is applied.";
  }

  const purchaserTinError = tinError(input.billTo?.taxId ?? "");
  if (purchaserTinError) {
    return `Purchaser's TIN: ${purchaserTinError}`;
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return "At least one item is required.";
  }

  for (const item of input.items) {
    if (!item.name || !item.name.trim()) {
      return "Every item must have a name.";
    }
    if (item.name.length > 80) {
      return `Item name "${item.name.slice(0, 20)}..." must be 80 characters or fewer.`;
    }
    if (item.reference.length > 20) {
      return `Reference for "${item.name}" must be 20 characters or fewer.`;
    }
    if (!Number.isFinite(item.price) || item.price <= 0) {
      return `Price for "${item.name}" must be a positive number.`;
    }
    if (item.price > 1_000_000) {
      return `Price for "${item.name}" must be 1,000,000 or less.`;
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return `Quantity for "${item.name}" must be a positive number.`;
    }
    if (item.quantity > 999_999) {
      return `Quantity for "${item.name}" must be 999,999 or less.`;
    }
  }

  if (input.taxEnabled) {
    if (!Number.isFinite(input.taxPercent) || input.taxPercent < 0 || input.taxPercent > 100) {
      return "Tax percent must be between 0 and 100.";
    }
  }

  // TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md).
  if (input.isOldInvoice) {
    const trimmed = (input.oldInvoiceNo ?? "").trim();
    if (!trimmed) {
      return "Invoice number is required for a backfilled paper invoice.";
    }
    if (trimmed.length > 40) {
      return "Invoice number must be 40 characters or fewer.";
    }
  }

  if (input.date && Number.isNaN(Date.parse(input.date))) {
    return "Invoice date is invalid.";
  }

  if (input.dateOfDelivery && Number.isNaN(Date.parse(input.dateOfDelivery))) {
    return "Date of delivery is invalid.";
  }

  if (input.additionalInfo.length > 200) {
    return "Additional information must be 200 characters or fewer.";
  }

  return null;
}

async function upsertCustomer(billTo: BillToInput) {
  const name = billTo.name.trim();
  const phone = normalizePhone(billTo.phone);
  const address = billTo.address.trim();
  const taxId = billTo.taxId.trim();

  // No purchaser details given (allowed for non-VAT invoices) — leave the
  // invoice unlinked to any customer rather than creating one with a blank name.
  if (!name) {
    return null;
  }

  // Customer was picked from the autocomplete — update that exact record with
  // whatever the form currently holds (the user may have edited fields after selecting).
  if (billTo.customerId) {
    try {
      return await prisma.customer.update({
        where: { id: billTo.customerId },
        data: { name, phone: phone || null, address: address || null, taxId: taxId || null },
      });
    } catch (error) {
      const notFound =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
      if (!notFound) throw error;
      // Selected customer no longer exists; fall through to the phone-match/create path below.
    }
  }

  if (phone) {
    const existing = await prisma.customer.findFirst({ where: { phone } });
    if (existing) {
      const needsUpdate =
        name !== existing.name ||
        (address && address !== existing.address) ||
        (taxId && taxId !== existing.taxId);
      if (needsUpdate) {
        return prisma.customer.update({
          where: { id: existing.id },
          data: {
            name,
            address: address || existing.address,
            taxId: taxId || existing.taxId,
          },
        });
      }
      return existing;
    }
  }

  return prisma.customer.create({
    data: { name, phone: phone || null, address: address || null, taxId: taxId || null },
  });
}

/**
 * Resolves each invoice item to a catalog Product, creating one as needed,
 * and returns the item data ready to attach to the invoice. A catalog
 * product's price is never overwritten by an invoice edit — matching a
 * linked product (or an exact name match) only reuses it when the price is
 * unchanged; any price deviation is treated as a distinct product and gets
 * its own new reference, same as editing the name does. Run sequentially
 * (not Promise.all) so two brand-new items in the same invoice don't race
 * the reference counter.
 */
async function resolveInvoiceItems(items: InvoiceItemInput[]) {
  const resolved = [];
  for (const item of items) {
    const name = item.name.trim();
    let product: { id: string; reference: string } | null = null;

    if (item.productId) {
      const linked = await prisma.product.findUnique({ where: { id: item.productId } });
      if (linked) {
        product =
          linked.price === item.price
            ? { id: linked.id, reference: linked.reference }
            : await createProductWithReference({ name, price: item.price });
      }
      // else: selected product no longer exists; fall through to the name-match/create path below.
    }

    if (!product) {
      const existing = await findProductByExactName(name);
      if (existing) {
        product =
          existing.price === item.price
            ? { id: existing.id, reference: existing.reference }
            : await createProductWithReference({ name, price: item.price });
      } else {
        product = await createProductWithReference({ name, price: item.price });
      }
    }

    resolved.push({
      reference: product.reference,
      name,
      price: item.price,
      quantity: item.quantity,
      lineTotal: computeLineTotal(item),
      productId: product.id,
    });
  }
  return resolved;
}

export async function createInvoice(
  input: CreateInvoiceInput
): Promise<CreateInvoiceResult> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const validationError = validate(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { subtotal, taxAmount, total } = computeInvoiceTotals(
    input.items,
    input.taxEnabled,
    input.taxPercent
  );

  const customer = await upsertCustomer(input.billTo);
  const resolvedItems = await resolveInvoiceItems(input.items);

  const invoiceData = (invoiceNo: string) => ({
    invoiceNo,
    customerId: customer?.id ?? null,
    createdByUserId: auth.user.id,
    date: input.date ? new Date(input.date) : new Date(),
    dateOfDelivery: input.dateOfDelivery ? new Date(input.dateOfDelivery) : null,
    placeOfSupply: input.placeOfSupply.trim() || null,
    modeOfPayment: input.modeOfPayment.trim() || null,
    additionalInfo: input.additionalInfo.trim() || null,
    taxEnabled: input.taxEnabled,
    taxPercent: input.taxEnabled ? input.taxPercent : 0,
    subtotal,
    taxAmount,
    total,
    items: { create: resolvedItems },
  });

  // TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md).
  // Client types the invoice number directly (validate() already required
  // it above) — a single create attempt, not the retry-and-increment
  // Gazette loop below, since there's no sequence to advance on conflict.
  if (input.isOldInvoice) {
    const manualInvoiceNo = input.oldInvoiceNo!.trim();
    try {
      const invoice = await prisma.invoice.create({ data: invoiceData(manualInvoiceNo) });
      return { success: true, id: invoice.id, invoiceNo: manualInvoiceNo };
    } catch (error) {
      const isUniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isUniqueConflict) {
        throw error;
      }
      return {
        success: false,
        error: `Invoice number "${manualInvoiceNo}" is already in use. Check for a typo or duplicate entry.`,
      };
    }
  }

  const businessSettings = await prisma.businessSettings.findUnique({
    where: { id: "default" },
    select: { invoiceUnitCode: true, tempInvoiceSerialFloorAugust2026: true },
  });
  const unitCode = (businessSettings?.invoiceUnitCode || DEFAULT_INVOICE_UNIT_CODE).slice(
    0,
    INVOICE_UNIT_CODE_MAX_LEN
  );

  const yearMonth = invoiceYearMonthPrefix();
  const prefix = `${yearMonth}_${unitCode}_`;

  const maxSerial = await highestExistingSerial(prefix);
  // TEMPORARY (Aug 2026 backfill — see schema.prisma's comment on this
  // field). Only takes effect where explicitly set (production), and only
  // for August — never a blanket "if the calendar says August" check.
  // Based on the highest existing serial, not a row count: the floor
  // creates a deliberate gap (18 real rows vs. serials starting at 422),
  // and a row count would stay stuck below the floor for hundreds of
  // invoices, colliding and needing one more retry each time until the
  // retry limit is exceeded and invoice creation starts failing outright.
  const floor = businessSettings?.tempInvoiceSerialFloorAugust2026;
  const baseSequence = yearMonth === "26AUG" && floor ? Math.max(maxSerial, floor - 1) : maxSerial;

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sequence = baseSequence + 1 + attempt;
    const invoiceNo = `${prefix}${String(sequence).padStart(INVOICE_SERIAL_DIGITS, "0")}`;

    try {
      const invoice = await prisma.invoice.create({ data: invoiceData(invoiceNo) });
      return { success: true, id: invoice.id, invoiceNo };
    } catch (error) {
      const isUniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isUniqueConflict) {
        throw error;
      }
      // Another invoice grabbed this number concurrently; retry with the next sequence.
    }
  }

  return { success: false, error: "Could not generate a unique invoice number. Please try again." };
}

export type UpdateInvoiceNumberResult = { success: true } | { success: false; error: string };

/**
 * TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md):
 * lets any authenticated staff member correct an invoice's invoiceNo directly
 * (e.g. a typo in a client-typed old-invoice number) — narrower than the
 * full updateInvoice(), which stays admin-only. Remove once the backfill is
 * finished and invoice numbers no longer need manual correction.
 */
export async function updateInvoiceNumber(
  invoiceId: string,
  newInvoiceNo: string
): Promise<UpdateInvoiceNumberResult> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const trimmed = newInvoiceNo.trim();
  if (!trimmed) {
    return { success: false, error: "Invoice number is required." };
  }
  if (trimmed.length > 40) {
    return { success: false, error: "Invoice number must be 40 characters or fewer." };
  }

  try {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { invoiceNo: trimmed },
    });
    return { success: true };
  } catch (error) {
    const isUniqueConflict =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    if (isUniqueConflict) {
      return { success: false, error: `Invoice number "${trimmed}" is already in use.` };
    }
    throw error;
  }
}

export type UpdateInvoiceResult = { success: true } | { success: false; error: string };

export async function updateInvoice(
  invoiceId: string,
  input: CreateInvoiceInput
): Promise<UpdateInvoiceResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const validationError = validate(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { subtotal, taxAmount, total } = computeInvoiceTotals(
    input.items,
    input.taxEnabled,
    input.taxPercent
  );

  const customer = await upsertCustomer(input.billTo);
  const resolvedItems = await resolveInvoiceItems(input.items);

  try {
    await prisma.$transaction([
      prisma.invoiceItem.deleteMany({ where: { invoiceId } }),
      prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          customerId: customer?.id ?? null,
          // Leaves the stored date untouched if none was submitted, rather
          // than resetting it to now — unlike createInvoice, where a missing
          // date defaults to today.
          date: input.date ? new Date(input.date) : undefined,
          dateOfDelivery: input.dateOfDelivery ? new Date(input.dateOfDelivery) : null,
          placeOfSupply: input.placeOfSupply.trim() || null,
          modeOfPayment: input.modeOfPayment.trim() || null,
          additionalInfo: input.additionalInfo.trim() || null,
          taxEnabled: input.taxEnabled,
          taxPercent: input.taxEnabled ? input.taxPercent : 0,
          subtotal,
          taxAmount,
          total,
          items: { create: resolvedItems },
        },
      }),
    ]);

    return { success: true };
  } catch {
    return { success: false, error: "Could not update invoice. Please try again." };
  }
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    const current = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { status: true },
    });
    if (!current) {
      return { success: false, error: "Invoice not found." };
    }
    if (current.status === "PAID" && status === "UNPAID") {
      return { success: false, error: "A paid invoice cannot be marked as unpaid." };
    }
    if (current.status === "CANCELLED") {
      return { success: false, error: "A cancelled invoice cannot be changed." };
    }

    await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
    return { success: true };
  } catch {
    return { success: false, error: "Could not update invoice status." };
  }
}

// Both revertInvoiceToUnpaid() and cancelInvoice() are available to any
// logged-in user (not admin-only) — the gate is this password check, not the
// role. It's checked against every active admin's password, not necessarily
// the current user's own, since the point is a staff member getting a
// manager/admin to authorize the action at the till, not the staff member
// needing to already be an admin themselves.
async function verifyAnyAdminPassword(password: string): Promise<boolean> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { passwordHash: true },
  });
  for (const admin of admins) {
    if (await bcrypt.compare(password, admin.passwordHash)) return true;
  }
  return false;
}

// The only sanctioned way to reverse a PAID invoice — updateInvoiceStatus()
// above still hard-blocks PAID -> UNPAID unconditionally.
export async function revertInvoiceToUnpaid(
  invoiceId: string,
  adminPassword: string
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!(await verifyAnyAdminPassword(adminPassword))) {
    return { success: false, error: "Incorrect password." };
  }

  const current = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true },
  });
  if (!current) {
    return { success: false, error: "Invoice not found." };
  }
  if (current.status !== "PAID") {
    return { success: false, error: "Only a paid invoice can be marked as unpaid." };
  }

  try {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "UNPAID" } });
    return { success: true };
  } catch {
    return { success: false, error: "Could not update invoice status." };
  }
}

// Cancelling is terminal (see the CANCELLED guard in updateInvoiceStatus
// above — nothing can move an invoice out of that state) and allowed from
// any non-cancelled status, paid or not — a single admin-password-confirmed
// step, no need to revert to unpaid first.
export async function cancelInvoice(
  invoiceId: string,
  adminPassword: string
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!(await verifyAnyAdminPassword(adminPassword))) {
    return { success: false, error: "Incorrect password." };
  }

  const current = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true },
  });
  if (!current) {
    return { success: false, error: "Invoice not found." };
  }
  if (current.status === "CANCELLED") {
    return { success: false, error: "This invoice is already cancelled." };
  }

  try {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED" } });
    return { success: true };
  } catch {
    return { success: false, error: "Could not cancel invoice." };
  }
}
