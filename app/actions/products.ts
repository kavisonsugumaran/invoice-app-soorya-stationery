"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { findProductByExactName } from "@/lib/products";
import { requireUser, requireAdmin } from "@/lib/auth-guard";

export type ProductCreateInput = {
  name: string;
  price: number;
};

export type ProductPriceUpdateInput = {
  price: number;
};

export type CreateProductResult =
  | { success: true; id: string; reference: string }
  | { success: false; error: string };
export type UpdateProductResult = { success: true } | { success: false; error: string };
export type DeleteProductResult = { success: true } | { success: false; error: string };

function validatePrice(price: number): string | null {
  if (!Number.isFinite(price) || price <= 0) {
    return "Price must be a positive number.";
  }
  if (price > 1_000_000) {
    return "Price must be 1,000,000 or less.";
  }
  return null;
}

/**
 * Product reference numbers are always system-generated (P-0001, P-0002, ...),
 * never typed by hand — shop staff won't know them up front. Mirrors the
 * count + retry-on-unique-conflict shape used for invoiceNo generation in
 * app/actions/invoices.ts, so it's exported for reuse from there too.
 */
export async function createProductWithReference(data: {
  name: string;
  price: number;
}): Promise<{ id: string; reference: string }> {
  const count = await prisma.product.count();

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const sequence = count + 1 + attempt;
    const reference = `P-${String(sequence).padStart(4, "0")}`;

    try {
      const product = await prisma.product.create({
        data: { reference, name: data.name, price: data.price },
      });
      return { id: product.id, reference: product.reference };
    } catch (error) {
      const isUniqueConflict =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!isUniqueConflict) {
        throw error;
      }
      // Another product grabbed this reference concurrently; retry with the next sequence.
    }
  }

  throw new Error("Could not generate a unique product reference.");
}

export async function createProduct(input: ProductCreateInput): Promise<CreateProductResult> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const name = input.name.trim();
  if (!name) {
    return { success: false, error: "Product name is required." };
  }
  if (name.length > 80) {
    return { success: false, error: "Product name must be 80 characters or fewer." };
  }

  const priceError = validatePrice(input.price);
  if (priceError) {
    return { success: false, error: priceError };
  }

  const existing = await findProductByExactName(name);
  if (existing) {
    return {
      success: false,
      error: `A product with this name already exists: ${existing.name} (${existing.reference}).`,
    };
  }

  const product = await createProductWithReference({ name, price: input.price });
  return { success: true, id: product.id, reference: product.reference };
}

// Intentionally accepts only { price } — reference and name are a product's
// permanent identity and can never be edited here, enforced server-side (not
// just UI-disabled), same defense-in-depth style as the PAID-is-terminal
// check in updateInvoiceStatus.
export async function updateProduct(
  id: string,
  input: ProductPriceUpdateInput
): Promise<UpdateProductResult> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const priceError = validatePrice(input.price);
  if (priceError) {
    return { success: false, error: priceError };
  }

  try {
    await prisma.product.update({ where: { id }, data: { price: input.price } });
    return { success: true };
  } catch {
    return { success: false, error: "Could not update product." };
  }
}

export async function deleteProduct(id: string): Promise<DeleteProductResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    await prisma.product.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "Could not delete product." };
  }
}
