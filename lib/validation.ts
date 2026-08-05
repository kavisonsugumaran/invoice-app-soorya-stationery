export const TIN_LENGTH = 9;
const TIN_PATTERN = /^\d{9}$/;

/** TIN is optional everywhere it's used — only validated when a value is present. */
export function tinError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!TIN_PATTERN.test(trimmed)) {
    return "TIN must be exactly 9 digits.";
  }
  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email is optional everywhere it's used — only validated when a value is present. */
export function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid email address.";
  }
  return null;
}
