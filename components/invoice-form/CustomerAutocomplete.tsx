"use client";

import { useMemo, useState } from "react";
import InitialsAvatar from "@/components/ui/InitialsAvatar";

export type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  taxId: string | null;
};

type CustomerAutocompleteProps = {
  customers: CustomerOption[];
  value: string;
  required?: boolean;
  onChange: (name: string) => void;
  onSelect: (customer: CustomerOption) => void;
};

const MAX_SUGGESTIONS = 6;

export default function CustomerAutocomplete({
  customers,
  value,
  required = true,
  onChange,
  onSelect,
}: CustomerAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];
    return customers
      .filter((c) => c.name.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [customers, value]);

  const showDropdown = isOpen && suggestions.length > 0;

  return (
    <div className="relative sm:col-span-2">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        placeholder={required ? "Customer name*" : "Customer name"}
        required={required}
        autoComplete="off"
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
      />
      {showDropdown && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-surface shadow-md">
          {suggestions.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(customer);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted"
              >
                <InitialsAvatar name={customer.name} size={22} />
                <span className="flex-1 truncate">{customer.name}</span>
                {customer.phone && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {customer.phone}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
