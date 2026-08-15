"use server";

import { put, del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";
import { tinError, emailError } from "@/lib/validation";

export type DotMatrixCalibrationInput = {
  dmOffsetXMm: number;
  dmOffsetYMm: number;
  dmFontSizePt: number;
  dmItemRowMm: number;
  dmScaleY: number;
  dmScaleX: number;
};

export type UpdateCalibrationResult = { success: true } | { success: false; error: string };

function validate(input: DotMatrixCalibrationInput): string | null {
  const values = [
    input.dmOffsetXMm,
    input.dmOffsetYMm,
    input.dmFontSizePt,
    input.dmItemRowMm,
    input.dmScaleY,
    input.dmScaleX,
  ];
  if (values.some((v) => !Number.isFinite(v))) {
    return "All calibration values must be numbers.";
  }
  if (input.dmFontSizePt <= 0) {
    return "Font size must be greater than 0.";
  }
  if (input.dmItemRowMm <= 0) {
    return "Item row height must be greater than 0.";
  }
  if (input.dmScaleY <= 0) {
    return "Y scale must be greater than 0.";
  }
  if (input.dmScaleX <= 0) {
    return "X scale must be greater than 0.";
  }
  return null;
}

export async function updateDotMatrixCalibration(
  input: DotMatrixCalibrationInput
): Promise<UpdateCalibrationResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const validationError = validate(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: { ...input },
    create: { id: "default", businessName: "Your Business", ...input },
  });

  return { success: true };
}

export type BusinessProfileInput = {
  businessName: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  taxId: string;
};

export type UpdateProfileResult = { success: true } | { success: false; error: string };

function validateProfile(input: BusinessProfileInput): string | null {
  if (!input.businessName.trim()) {
    return "Business name is required.";
  }
  const emailValidationError = emailError(input.email);
  if (emailValidationError) return emailValidationError;
  return tinError(input.taxId);
}

export async function updateBusinessProfile(input: BusinessProfileInput): Promise<UpdateProfileResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const validationError = validateProfile(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const data = {
    businessName: input.businessName.trim(),
    address: input.address.trim() || null,
    phone: input.phone.trim() || null,
    whatsapp: input.whatsapp.trim() || null,
    email: input.email.trim() || null,
    taxId: input.taxId.trim() || null,
  };

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });

  return { success: true };
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type UploadLogoResult = { success: true; logoUrl: string } | { success: false; error: string };

export async function uploadBusinessLogo(formData: FormData): Promise<UploadLogoResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { success: false, error: "Choose an image file." };
  }
  const extension = LOGO_EXTENSION_BY_TYPE[file.type];
  if (!extension) {
    return { success: false, error: "Logo must be a PNG, JPEG, or WebP image." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { success: false, error: "Logo must be smaller than 2MB." };
  }

  const existing = await prisma.businessSettings.findUnique({ where: { id: "default" } });

  let blob;
  try {
    blob = await put(`business-logo/logo.${extension}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
  } catch {
    return { success: false, error: "Could not upload logo. Try again." };
  }

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: { logoUrl: blob.url },
    create: { id: "default", businessName: "Your Business", logoUrl: blob.url },
  });

  if (existing?.logoUrl) {
    try {
      await del(existing.logoUrl);
    } catch {
      // Best-effort cleanup — a stale blob left in storage isn't user-visible.
    }
  }

  return { success: true, logoUrl: blob.url };
}

export type RemoveLogoResult = { success: true } | { success: false; error: string };

export async function removeBusinessLogo(): Promise<RemoveLogoResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const existing = await prisma.businessSettings.findUnique({ where: { id: "default" } });

  await prisma.businessSettings.upsert({
    where: { id: "default" },
    update: { logoUrl: null },
    create: { id: "default", businessName: "Your Business" },
  });

  if (existing?.logoUrl) {
    try {
      await del(existing.logoUrl);
    } catch {
      // Best-effort cleanup — a stale blob left in storage isn't user-visible.
    }
  }

  return { success: true };
}
