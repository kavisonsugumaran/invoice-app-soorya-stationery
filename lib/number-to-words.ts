const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
] as const;

function convertThreeDigits(n: number): string {
  let str = "";
  if (n >= 100) {
    str += `${ONES[Math.floor(n / 100)]} Hundred `;
    n %= 100;
  }
  if (n >= 20) {
    str += `${TENS[Math.floor(n / 10)]} `;
    n %= 10;
    if (n > 0) str += `${ONES[n]} `;
  } else if (n > 0) {
    str += `${ONES[n]} `;
  }
  return str;
}

// Largest value the Trillion..Hundred tiers below can render correctly
// (each tier must stay under 1000 for convertThreeDigits to work).
const MAX_SUPPORTED = 999_999_999_999_999;

export function numberToWords(value: number): string {
  const num = Math.floor(value);
  if (num === 0) return "Zero";
  if (!Number.isFinite(num) || num > MAX_SUPPORTED) {
    return num.toLocaleString("en-US");
  }

  const trillions = Math.floor(num / 1_000_000_000_000);
  const billions = Math.floor((num % 1_000_000_000_000) / 1_000_000_000);
  const millions = Math.floor((num % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((num % 1_000_000) / 1000);
  const remainder = num % 1000;

  let result = "";
  if (trillions) result += `${convertThreeDigits(trillions)}Trillion `;
  if (billions) result += `${convertThreeDigits(billions)}Billion `;
  if (millions) result += `${convertThreeDigits(millions)}Million `;
  if (thousands) result += `${convertThreeDigits(thousands)}Thousand `;
  if (remainder) result += convertThreeDigits(remainder);

  return result.trim();
}

export function amountToWords(amount: number): string {
  const rupees = Math.floor(amount);
  const cents = Math.round((amount - rupees) * 100);

  if (cents > 0) {
    return `Rupees ${numberToWords(rupees)} and Cents ${numberToWords(cents)} Only`;
  }
  return `Rupees ${numberToWords(rupees)} Only`;
}
