"use server";

import { prisma } from "@/lib/prisma";
import { findCustomerByPhone } from "@/lib/customers";
import { requireUser, requireAdmin } from "@/lib/auth-guard";
import { tinError, emailError } from "@/lib/validation";
import { normalizePhone } from "@/lib/phone-format";

export type CustomerFormInput = {
  name: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
};

export type CreateCustomerResult = { success: true; id: string } | { success: false; error: string };
export type UpdateCustomerResult = { success: true } | { success: false; error: string };
export type DeleteCustomerResult = { success: true } | { success: false; error: string };

function validate(input: CustomerFormInput): string | null {
  if (!input.name.trim()) {
    return "Customer name is required.";
  }
  const emailValidationError = emailError(input.email);
  if (emailValidationError) {
    return emailValidationError;
  }
  const taxIdError = tinError(input.taxId);
  if (taxIdError) {
    return taxIdError;
  }
  return null;
}

export async function createCustomer(input: CustomerFormInput): Promise<CreateCustomerResult> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const validationError = validate(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const phone = normalizePhone(input.phone);
  if (phone) {
    const existing = await findCustomerByPhone(phone);
    if (existing) {
      return {
        success: false,
        error: `A customer with this phone number already exists: ${existing.name}.`,
      };
    }
  }

  const customer = await prisma.customer.create({
    data: {
      name: input.name.trim(),
      phone: phone || null,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
      taxId: input.taxId.trim() || null,
    },
  });

  return { success: true, id: customer.id };
}

export async function updateCustomer(
  id: string,
  input: CustomerFormInput
): Promise<UpdateCustomerResult> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const validationError = validate(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const phone = normalizePhone(input.phone);
  if (phone) {
    const existing = await findCustomerByPhone(phone, id);
    if (existing) {
      return {
        success: false,
        error: `Another customer already uses this phone number: ${existing.name}.`,
      };
    }
  }

  await prisma.customer.update({
    where: { id },
    data: {
      name: input.name.trim(),
      phone: phone || null,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
      taxId: input.taxId.trim() || null,
    },
  });

  return { success: true };
}

export async function deleteCustomer(id: string): Promise<DeleteCustomerResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  try {
    await prisma.customer.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "Could not delete customer." };
  }
}
