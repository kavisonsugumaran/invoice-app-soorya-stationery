"use server";

import { prisma } from "@/lib/prisma";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import { computeInvoiceTotals, computeLineTotal } from "@/lib/invoice-math";
import { findProductByExactName } from "@/lib/products";
import { createProductWithReference } from "@/app/actions/products";
import { requireUser, requireAdmin } from "@/lib/auth-guard";

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

function todayDatePrefix(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: INVOICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const lookup = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${lookup.year}${lookup.month}${lookup.day}`;
}

function validate(input: CreateInvoiceInput): string | null {
  // Purchaser details are only mandatory for VAT tax invoices (compliance
  // requirement) — a plain non-VAT sale can be recorded without them.
  if (input.taxEnabled && (!input.billTo?.name || !input.billTo.name.trim())) {
    return "Bill To name is required when VAT is applied.";
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
  const phone = billTo.phone.trim();
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
 * Resolves each invoice item to a catalog Product, creating or updating it as
 * needed, and returns the item data ready to attach to the invoice. Price
 * edits on a linked product propagate to the catalog; editing the name
 * instead of using the autocomplete just leaves productId unset, so it
 * resolves via exact-name match or creates a fresh product — never silently
 * overwrites the original one. Run sequentially (not Promise.all) so two
 * brand-new items in the same invoice don't race the reference counter.
 */
async function resolveInvoiceItems(items: InvoiceItemInput[]) {
  const resolved = [];
  for (const item of items) {
    const name = item.name.trim();
    let product: { id: string; reference: string } | null = null;

    if (item.productId) {
      try {
        const updated = await prisma.product.update({
          where: { id: item.productId },
          data: { price: item.price },
        });
        product = { id: updated.id, reference: updated.reference };
      } catch (error) {
        const notFound =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
        if (!notFound) throw error;
        // Selected product no longer exists; fall through to the name-match/create path below.
      }
    }

    if (!product) {
      const existing = await findProductByExactName(name);
      if (existing) {
        if (existing.price !== item.price) {
          await prisma.product.update({ where: { id: existing.id }, data: { price: item.price } });
        }
        product = { id: existing.id, reference: existing.reference };
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

  const datePrefix = todayDatePrefix();
  const prefix = `INV-${datePrefix}-`;

  const todayCount = await prisma.invoice.count({
    where: { invoiceNo: { startsWith: prefix } },
  });

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sequence = todayCount + 1 + attempt;
    const invoiceNo = `${prefix}${String(sequence).padStart(2, "0")}`;

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
