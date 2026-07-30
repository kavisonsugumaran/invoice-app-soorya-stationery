"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-guard";

export type DotMatrixCalibrationInput = {
  dmOffsetXMm: number;
  dmOffsetYMm: number;
  dmFontSizePt: number;
  dmItemRowMm: number;
};

export type UpdateCalibrationResult = { success: true } | { success: false; error: string };

function validate(input: DotMatrixCalibrationInput): string | null {
  const values = [input.dmOffsetXMm, input.dmOffsetYMm, input.dmFontSizePt, input.dmItemRowMm];
  if (values.some((v) => !Number.isFinite(v))) {
    return "All calibration values must be numbers.";
  }
  if (input.dmFontSizePt <= 0) {
    return "Font size must be greater than 0.";
  }
  if (input.dmItemRowMm <= 0) {
    return "Item row height must be greater than 0.";
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
