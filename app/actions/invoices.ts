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
  dateOfDelivery: string;
  placeOfSupply: string;
  modeOfPayment: string;
  additionalInfo: string;
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
const DEFAULT_INVOICE_UNIT_CODE = "SRY";
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
    if (item.quantity > 10_000) {
      return `Quantity for "${item.name}" must be 10,000 or less.`;
    }
  }

  if (input.taxEnabled) {
    if (!Number.isFinite(input.taxPercent) || input.taxPercent < 0 || input.taxPercent > 100) {
      return "Tax percent must be between 0 and 100.";
    }
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

  const businessSettings = await prisma.businessSettings.findUnique({
    where: { id: "default" },
    select: { invoiceUnitCode: true },
  });
  const unitCode = (businessSettings?.invoiceUnitCode || DEFAULT_INVOICE_UNIT_CODE).slice(
    0,
    INVOICE_UNIT_CODE_MAX_LEN
  );

  const yearMonth = invoiceYearMonthPrefix();
  const prefix = `${yearMonth}_${unitCode}_`;

  const monthCount = await prisma.invoice.count({
    where: { invoiceNo: { startsWith: prefix } },
  });

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sequence = monthCount + 1 + attempt;
    const invoiceNo = `${prefix}${String(sequence).padStart(INVOICE_SERIAL_DIGITS, "0")}`;

    try {
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNo,
          customerId: customer?.id ?? null,
          createdByUserId: auth.user.id,
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
      });

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

    await prisma.invoice.update({ where: { id: invoiceId }, data: { status } });
    return { success: true };
  } catch {
    return { success: false, error: "Could not update invoice status." };
  }
}

// The only sanctioned way to reverse a PAID invoice — updateInvoiceStatus()
// above still hard-blocks PAID -> UNPAID unconditionally. Gated behind
// re-entering the current admin's own password (not just being logged in as
// admin) since this reverses a state the rest of the app treats as terminal.
export async function revertInvoiceToUnpaid(
  invoiceId: string,
  adminPassword: string
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const admin = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!admin) {
    return { success: false, error: "Could not verify admin password." };
  }

  const passwordMatches = await bcrypt.compare(adminPassword, admin.passwordHash);
  if (!passwordMatches) {
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
