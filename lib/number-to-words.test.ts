import { describe, expect, it } from "vitest";
import { numberToWords, amountToWords } from "./number-to-words";

describe("numberToWords", () => {
  it("handles zero and small numbers", () => {
    expect(numberToWords(0)).toBe("Zero");
    expect(numberToWords(5)).toBe("Five");
    expect(numberToWords(19)).toBe("Nineteen");
    expect(numberToWords(20)).toBe("Twenty");
    expect(numberToWords(100)).toBe("One Hundred");
  });

  it("handles thousands", () => {
    expect(numberToWords(1000)).toBe("One Thousand");
    expect(numberToWords(234567)).toBe("Two Hundred Thirty Four Thousand Five Hundred Sixty Seven");
  });

  // Regression coverage: this previously broke above ~999 million, producing
  // "undefined" in the middle of the string once the millions tier itself
  // exceeded 999 (see convertThreeDigits, which only handles 0-999 per tier).
  it("handles millions, billions, and trillions without producing 'undefined'", () => {
    expect(numberToWords(1_000_000)).toBe("One Million");
    expect(numberToWords(1_234_567)).toBe(
      "One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven"
    );
    expect(numberToWords(1_000_000_000)).toBe("One Billion");
    expect(numberToWords(1_000_000_000_000)).toBe("One Trillion");

    const result = numberToWords(999_999_999_999_999);
    expect(result).not.toContain("undefined");
    expect(result).toBe(
      "Nine Hundred Ninety Nine Trillion Nine Hundred Ninety Nine Billion " +
        "Nine Hundred Ninety Nine Million Nine Hundred Ninety Nine Thousand " +
        "Nine Hundred Ninety Nine"
    );
  });

  it("falls back to a plain formatted number beyond MAX_SUPPORTED instead of breaking", () => {
    const result = numberToWords(1_000_000_000_000_000);
    expect(result).not.toContain("undefined");
    expect(result).toBe("1,000,000,000,000,000");
  });
});

describe("amountToWords", () => {
  it("formats whole amounts without a cents clause", () => {
    expect(amountToWords(100)).toBe("Rupees One Hundred Only");
    expect(amountToWords(0)).toBe("Rupees Zero Only");
  });

  it("formats amounts with cents", () => {
    expect(amountToWords(100.5)).toBe("Rupees One Hundred and Cents Fifty Only");
  });
});
