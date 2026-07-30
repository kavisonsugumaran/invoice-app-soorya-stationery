"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/lib/currency";

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
  const wrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [products, value]);

  const showDropdown = isOpen && suggestions.length > 0;

  // The item row lives inside an overflow-x-auto container (needed elsewhere to stop
  // long text from breaking the grid layout), which clips absolutely-positioned
  // dropdowns. Render the suggestion list through a portal instead, positioned from
  // the input's own bounding rect, so it escapes that clipping.
  useEffect(() => {
    if (!showDropdown) return;

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
  }, [showDropdown]);

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder="Item name"
        required
        disabled={disabled}
        maxLength={80}
        autoComplete="off"
        className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 text-sm disabled:bg-surface-muted disabled:text-muted-foreground"
      />
      {showDropdown &&
        position &&
        createPortal(
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
          </ul>,
          document.body
        )}
    </div>
  );
}
