"use server";

import dictionary from "dictionary-en";
import nspell from "nspell";
import { requireUser } from "@/lib/auth-guard";
import { levenshtein } from "@/lib/fuzzy-match";

// The dictionary is a few hundred KB — parsed once per server process and
// reused across requests, never shipped to the browser (that's the point of
// running this as a Server Action instead of a client-side spellchecker).
let speller: ReturnType<typeof nspell> | null = null;
function getSpeller() {
  if (!speller) speller = nspell(dictionary);
  return speller;
}

// Only auto-apply a suggestion that's genuinely close to what was typed —
// nspell's top suggestion for a word it doesn't recognize at all (e.g. a
// brand name or product code) can be wildly different, and silently
// replacing "Biro" with some unrelated dictionary word would be worse than
// leaving an unrecognized word untouched.
const MAX_CONFIDENT_DISTANCE = 2;
const MIN_WORD_LENGTH = 3;

export type SpellCheckResult = { word: string; suggestion: string | null };

/**
 * Checks one word against an English dictionary; returns a correction only
 * when confident. `knownWords` are words already used elsewhere in the
 * product catalog (brand names, domain terms like "Apsara") — those are
 * trusted outright and never flagged, dictionary or not, since a general
 * English dictionary has no way to know a local stationery brand.
 */
export async function checkSpelling(
  word: string,
  knownWords: string[] = []
): Promise<SpellCheckResult> {
  const auth = await requireUser();
  if (!auth.ok) return { word, suggestion: null };

  const trimmed = word.trim();
  if (trimmed.length < MIN_WORD_LENGTH || !/^[a-zA-Z]+$/.test(trimmed)) {
    return { word: trimmed, suggestion: null };
  }

  if (knownWords.some((known) => known.toLowerCase() === trimmed.toLowerCase())) {
    return { word: trimmed, suggestion: null };
  }

  const spell = getSpeller();
  // Some dictionary entries only exist in their capitalized form — trademarks
  // and proper nouns like "Biro" — so a lowercase "biro" would otherwise look
  // unrecognized and get "corrected" to an unrelated real word (e.g. "giro").
  // Regular words are already case-insensitive in the dictionary itself
  // (nspell normalizes "PENCIL"/"Pencil"/"pencil" alike), so this only
  // matters for that proper-noun case.
  const titleCased = trimmed[0].toUpperCase() + trimmed.slice(1).toLowerCase();
  if (spell.correct(trimmed) || spell.correct(titleCased)) {
    return { word: trimmed, suggestion: null };
  }

  const [topSuggestion] = spell.suggest(trimmed);
  if (!topSuggestion || levenshtein(trimmed.toLowerCase(), topSuggestion.toLowerCase()) > MAX_CONFIDENT_DISTANCE) {
    return { word: trimmed, suggestion: null };
  }

  // Match the casing of what was typed (e.g. "Pencol" -> "Pencil", not "pencil").
  const suggestion =
    trimmed[0] === trimmed[0].toUpperCase()
      ? topSuggestion[0].toUpperCase() + topSuggestion.slice(1)
      : topSuggestion;

  return { word: trimmed, suggestion };
}
