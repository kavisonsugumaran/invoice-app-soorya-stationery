"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/lib/currency";
import { fuzzyIncludes, fuzzyScore } from "@/lib/fuzzy-match";
import { checkSpelling } from "@/app/actions/spellcheck";

export type ProductOption = {
  id: string;
  reference: string;
  name: string;
  price: number;
};

type ItemAutocompleteProps = {
  products: ProductOption[];
  value: string;
  disabled?: boolean;
  onChange: (name: string) => void;
  onSelect: (product: ProductOption) => void;
};

const MAX_SUGGESTIONS = 6;

type PendingCorrection = {
  /** The exact field value this suggestion was computed against — if the field
   *  moves on before it's accepted, the suggestion is stale and gets dropped. */
  snapshot: string;
  start: number;
  end: number;
  original: string;
  suggestion: string;
};

export default function ItemAutocomplete({
  products,
  value,
  disabled = false,
  onChange,
  onSelect,
}: ItemAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const [pendingCorrection, setPendingCorrection] = useState<PendingCorrection | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Tracks the latest value so an in-flight spellcheck can tell whether the
  // text it was checking is still current before offering a correction.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Derived, not synced via effect: a pending correction only counts while
  // the field still matches the exact text it was computed against — any
  // edit since then implicitly drops it, without needing to reset state.
  const activeCorrection =
    pendingCorrection && pendingCorrection.snapshot === value ? pendingCorrection : null;

  // Words already used somewhere in the product catalog (brand names, local
  // terms like "Apsara") are trusted outright — a general English dictionary
  // has no way to know those, so they'd otherwise get flagged every time.
  const knownWords = useMemo(() => {
    const words = new Set<string>();
    for (const p of products) {
      for (const word of p.name.split(/\s+/)) {
        if (word) words.add(word.toLowerCase());
      }
    }
    return [...words];
  }, [products]);

  const suggestions = useMemo(() => {
    const query = value.trim();
    if (!query) return [];
    // Typo-tolerant: a misspelled name (e.g. "buisness") still surfaces the
    // real product, so staff don't accidentally create a duplicate entry for
    // one they mistyped. Closest matches (exact substrings first) sort to the top.
    return products
      .filter((p) => fuzzyIncludes(p.name, query))
      .sort((a, b) => fuzzyScore(a.name, query) - fuzzyScore(b.name, query))
      .slice(0, MAX_SUGGESTIONS);
  }, [products, value]);

  // Catalog matches take priority (more directly useful — it's an existing
  // product) — the spelling suggestion only shows when there's nothing else.
  const showProductDropdown = isOpen && suggestions.length > 0;
  const showSpellingHint = isOpen && !showProductDropdown && activeCorrection !== null;
  const showFloating = showProductDropdown || showSpellingHint;

  // The item row lives inside an overflow-x-auto container (needed elsewhere to stop
  // long text from breaking the grid layout), which clips absolutely-positioned
  // dropdowns. Render the suggestion list through a portal instead, positioned from
  // the input's own bounding rect, so it escapes that clipping.
  useEffect(() => {
    if (!showFloating) return;

    function updatePosition() {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [showFloating]);

  // Spellchecks one word (identified by its position in `snapshot`) and, if a
  // confident correction comes back, offers it as a dismissible suggestion —
  // never applies it automatically, so what was typed is never overwritten
  // without the user choosing to accept it. Dropped if the text has since
  // moved on from `snapshot`.
  function checkWordForCorrection(snapshot: string, word: string, start: number, end: number) {
    if (word.length < 3) return;
    checkSpelling(word, knownWords)
      .then((result) => {
        if (!result.suggestion || valueRef.current !== snapshot) return;
        setPendingCorrection({ snapshot, start, end, original: word, suggestion: result.suggestion });
      })
      .catch(() => {
        // Autocorrect is a nice-to-have — a failed lookup should never
        // interrupt typing or surface an error to the user.
      });
  }

  // Finds the last whitespace-delimited word in `text` (ignoring any
  // trailing spaces) and spellchecks it. `text` is passed through unmodified
  // as the snapshot, trailing spaces and all, so it matches what's actually
  // in the field for the staleness check in checkWordForCorrection.
  function checkTrailingWord(text: string) {
    const withoutTrailingSpace = text.replace(/\s+$/, "");
    const start = withoutTrailingSpace.search(/\S+$/);
    if (start === -1) return;
    checkWordForCorrection(
      text,
      withoutTrailingSpace.slice(start),
      start,
      withoutTrailingSpace.length
    );
  }

  function acceptCorrection() {
    if (!activeCorrection) return;
    const { snapshot, start, end, suggestion } = activeCorrection;
    onChange(snapshot.slice(0, start) + suggestion + snapshot.slice(end));
    setPendingCorrection(null);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          setIsOpen(true);

          // A space just completed a word — spellcheck it in the background
          // rather than waiting for blur, so a suggestion is ready sooner.
          if (next.endsWith(" ")) {
            checkTrailingWord(next);
          }
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          checkTrailingWord(value);
          setTimeout(() => setIsOpen(false), 150);
        }}
        placeholder="Item name"
        required
        disabled={disabled}
        maxLength={80}
        autoComplete="off"
        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm disabled:bg-surface-muted disabled:text-muted-foreground"
      />
      {showFloating &&
        position &&
        createPortal(
          showProductDropdown ? (
            <ul
              style={{
                position: "fixed",
                top: position.top,
                left: position.left,
                width: Math.max(position.width, 256),
              }}
              className="z-50 overflow-hidden rounded-md border border-border bg-surface shadow-md"
            >
              {suggestions.map((product) => (
                <li key={product.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(product);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted"
                  >
                    <span className="flex-1 truncate">{product.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {product.reference}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatCurrency(product.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            activeCorrection && (
              <div
                style={{
                  position: "fixed",
                  top: position.top,
                  left: position.left,
                  width: Math.max(position.width, 256),
                }}
                className="z-50 flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-md"
              >
                <span className="text-muted-foreground">
                  Did you mean{" "}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      acceptCorrection();
                    }}
                    className="font-medium text-primary hover:underline"
                  >
                    {activeCorrection.suggestion}
                  </button>
                  ?
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setPendingCorrection(null);
                  }}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            )
          ),
          document.body
        )}
    </div>
  );
}
