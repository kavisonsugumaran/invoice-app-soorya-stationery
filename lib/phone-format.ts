export const PHONE_LENGTH = 10;

/** Canonical storage format — digits only, no length cap (defensive against malformed/legacy data). */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formats a stored phone number for display, e.g. "0771234567" -> "077 123 4567". */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = normalizePhone(value);
  if (digits.length !== PHONE_LENGTH) return value;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
