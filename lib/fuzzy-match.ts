/**
 * Approximate substring search: the minimum number of single-character edits
 * (insert/delete/substitute) needed to turn `query` into some substring of
 * `text`. Classic Levenshtein DP variant — the first row is seeded with
 * zeros instead of increasing indices, so a match is free to start at any
 * position in `text` rather than only at its beginning.
 */
function approxSubstringDistance(text: string, query: string): number {
  const n = text.length;
  const m = query.length;
  let prevRow = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    const currRow = new Array(n + 1).fill(0);
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      currRow[j] =
        query[i - 1] === text[j - 1]
          ? prevRow[j - 1]
          : 1 + Math.min(prevRow[j - 1], prevRow[j], currRow[j - 1]);
    }
    prevRow = currRow;
  }

  return Math.min(...prevRow);
}

/** Lower is a closer match; 0 means `query` appears in `text` exactly. */
export function fuzzyScore(text: string, query: string): number {
  return approxSubstringDistance(text.toLowerCase(), query.trim().toLowerCase());
}

/**
 * Standard whole-string Levenshtein distance — how many single-character
 * edits turn `a` into `b`. Unlike fuzzyScore/approxSubstringDistance (which
 * looks for one string inside the other), this compares two whole words
 * head-to-tail — the right metric for "how close is this dictionary
 * suggestion to what was actually typed."
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);

  for (let i = 1; i <= m; i++) {
    const currRow = new Array(n + 1).fill(0);
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      currRow[j] =
        a[i - 1] === b[j - 1]
          ? prevRow[j - 1]
          : 1 + Math.min(prevRow[j - 1], prevRow[j], currRow[j - 1]);
    }
    prevRow = currRow;
  }

  return prevRow[n];
}

// Roughly one typo tolerated per 4 characters typed — enough to absorb a
// transposed or substituted letter without matching unrelated short queries.
function toleranceFor(queryLength: number): number {
  return Math.max(1, Math.floor(queryLength / 4));
}

/** Typo-tolerant version of `text.includes(query)` — also matches close misspellings. */
export function fuzzyIncludes(text: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (text.toLowerCase().includes(trimmed.toLowerCase())) return true;
  return fuzzyScore(text, trimmed) <= toleranceFor(trimmed.length);
}
