import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/lib/dal";
import { checkSpelling } from "./spellcheck";

vi.mock("@/lib/dal", () => ({
  getCurrentUser: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetCurrentUser.mockResolvedValue({
    id: "user-1",
    username: "staff",
    name: "Staff",
    role: "USER",
  });
});

describe("checkSpelling", () => {
  it("rejects when there is no authenticated user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const result = await checkSpelling("pencol");

    expect(result).toEqual({ word: "pencol", suggestion: null });
  });

  it("returns no suggestion for a correctly spelled word", async () => {
    const result = await checkSpelling("pencil");
    expect(result.suggestion).toBeNull();
  });

  it("suggests a correction for a common typo", async () => {
    const result = await checkSpelling("pencol");
    expect(result.suggestion).toBe("pencil");
  });

  it("suggests a correction for a transposed-letter typo", async () => {
    const result = await checkSpelling("buisness");
    expect(result.suggestion).toBe("business");
  });

  it("matches the capitalization of what was typed", async () => {
    const result = await checkSpelling("Pencol");
    expect(result.suggestion).toBe("Pencil");
  });

  it("does not check words shorter than 3 characters", async () => {
    const result = await checkSpelling("hi");
    expect(result.suggestion).toBeNull();
  });

  it("does not check non-alphabetic input like product codes", async () => {
    const result = await checkSpelling("A4");
    expect(result.suggestion).toBeNull();
  });

  it("does not 'correct' a lowercase word that's only dictionary-listed capitalized (e.g. a trademark)", async () => {
    // Regression: "biro" was getting auto-"corrected" to the unrelated real
    // word "giro" because the dictionary only recognizes "Biro" capitalized.
    const result = await checkSpelling("biro");
    expect(result.suggestion).toBeNull();
  });

  it("would otherwise flag a brand name the dictionary doesn't recognize at all", async () => {
    // "Apsara" isn't in any general English dictionary in any casing, so
    // without a known-words override it gets flagged like any other typo.
    const result = await checkSpelling("apsara");
    expect(result.suggestion).not.toBeNull();
  });

  it("trusts a word already used in the product catalog, regardless of the dictionary", async () => {
    const result = await checkSpelling("apsara", ["Apsara"]);
    expect(result.suggestion).toBeNull();
  });

  it("matches known words case-insensitively", async () => {
    const result = await checkSpelling("APSARA", ["apsara"]);
    expect(result.suggestion).toBeNull();
  });
});
