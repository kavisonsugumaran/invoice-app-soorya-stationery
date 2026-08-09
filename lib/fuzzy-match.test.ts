import { describe, expect, it } from "vitest";
import { fuzzyIncludes, fuzzyScore } from "./fuzzy-match";

describe("fuzzyIncludes", () => {
  it("matches an exact substring regardless of case", () => {
    expect(fuzzyIncludes("Business Card Printing", "business")).toBe(true);
    expect(fuzzyIncludes("Business Card Printing", "Card")).toBe(true);
  });

  it("matches a transposed-letter typo", () => {
    expect(fuzzyIncludes("Business Card Printing", "buisness")).toBe(true);
  });

  it("matches a single substituted letter", () => {
    expect(fuzzyIncludes("Paper", "Paber")).toBe(true);
  });

  it("matches a missing letter", () => {
    expect(fuzzyIncludes("Flyer Printing", "Flyer Prnting")).toBe(true);
  });

  it("does not match an unrelated word", () => {
    expect(fuzzyIncludes("Business Card Printing", "Envelope")).toBe(false);
  });

  it("does not match on an empty query", () => {
    expect(fuzzyIncludes("Business Card Printing", "")).toBe(false);
    expect(fuzzyIncludes("Business Card Printing", "   ")).toBe(false);
  });

  it("stays strict for very short queries — only a one-letter slip", () => {
    expect(fuzzyIncludes("Pen", "Pin")).toBe(true);
    expect(fuzzyIncludes("Pen", "Cup")).toBe(false);
  });
});

describe("fuzzyScore", () => {
  it("scores an exact substring as 0", () => {
    expect(fuzzyScore("Business Card Printing", "Card")).toBe(0);
  });

  it("ranks a closer typo lower than a more different one", () => {
    const closeTypo = fuzzyScore("Business Card Printing", "buisness");
    const fartherTypo = fuzzyScore("Business Card Printing", "buisnesss xyz");
    expect(closeTypo).toBeLessThan(fartherTypo);
  });
});
