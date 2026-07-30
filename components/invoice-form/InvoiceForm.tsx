"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import {
  createInvoice,
  updateInvoice,
  type InvoiceItemInput,
} from "@/app/actions/invoices";
import InvoicePreviewPanel from "@/components/invoices/InvoicePreviewPanel";
import { computeInvoiceTotals, computeLineTotal } from "@/lib/invoice-math";
import { formatCurrency } from "@/lib/currency";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import CustomerAutocomplete, {
  type CustomerOption,
} from "@/components/invoice-form/CustomerAutocomplete";
import ItemAutocomplete, {
  type ProductOption,
} from "@/components/invoice-form/ItemAutocomplete";

const PAYMENT_MODES = ["Cash", "Card", "Bank Transfer", "Cheque"] as const;

type ItemRow = Omit<InvoiceItemInput, "productId"> & {
  id: string;
  productId: string | null;
};

type BusinessInfo = {
  businessName: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  taxId: string | null;
  dmOffsetXMm: number;
  dmOffsetYMm: number;
  dmFontSizePt: number;
  dmItemRowMm: number;
} | null;

export type InvoiceFormInitialData = {
  billTo: { name: string; phone: string; address: string; taxId: string; customerId: string | null };
  dateOfDelivery: string;
  placeOfSupply: string;
  modeOfPayment: string;
  additionalInfo: string;
  taxEnabled: boolean;
  taxPercent: number;
  items: InvoiceItemInput[];
};

type InvoiceFormProps = {
  business: BusinessInfo;
  customers: CustomerOption[];
  products: ProductOption[];
} & (
  | { mode?: "create" }
  | { mode: "edit"; invoiceId: string; invoiceNo: string; initialData: InvoiceFormInitialData }
);

function emptyRow(id: string): ItemRow {
  return { id, reference: "", name: "", price: 0, quantity: 1, productId: null };
}

export default function InvoiceForm(props: InvoiceFormProps) {
  const { business, customers, products } = props;
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.initialData : null;

  const router = useRouter();
  const idPrefix = useId();
  const [nextRowId, setNextRowId] = useState(1);
  const [items, setItems] = useState<ItemRow[]>(
    initial && initial.items.length > 0
      ? initial.items.map((item, i) => ({
          ...item,
          id: `${idPrefix}-init-${i}`,
          productId: item.productId ?? null,
        }))
      : [emptyRow(`${idPrefix}-0`)]
  );
  const [billToName, setBillToName] = useState(initial?.billTo.name ?? "");
  const [billToPhone, setBillToPhone] = useState(initial?.billTo.phone ?? "");
  const [billToAddress, setBillToAddress] = useState(initial?.billTo.address ?? "");
  const [billToTaxId, setBillToTaxId] = useState(initial?.billTo.taxId ?? "");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initial?.billTo.customerId ?? null
  );
  const [dateOfDelivery, setDateOfDelivery] = useState(initial?.dateOfDelivery ?? "");
  const [placeOfSupply, setPlaceOfSupply] = useState(initial?.placeOfSupply ?? "");
  const [modeOfPayment, setModeOfPayment] = useState(initial?.modeOfPayment ?? "");
  const [additionalInfo, setAdditionalInfo] = useState(initial?.additionalInfo ?? "");
  const [taxEnabled, setTaxEnabled] = useState(initial?.taxEnabled ?? false);
  const [taxPercent, setTaxPercent] = useState(initial?.taxPercent ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { subtotal, taxAmount, total } = useMemo(
    () => computeInvoiceTotals(items, taxEnabled, taxPercent),
    [items, taxEnabled, taxPercent]
  );

  function updateItem(id: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function selectProduct(id: string, product: ProductOption) {
    updateItem(id, {
      reference: product.reference,
      name: product.name,
      price: product.price,
      productId: product.id,
    });
  }

  // Reference/name are locked once a row is linked to a product — this clears the
  // link so the user can pick or type a different item instead of overwriting the
  // original product's identity. Quantity is left as-is.
  function resetItemToBlank(id: string) {
    updateItem(id, { reference: "", name: "", price: 0, productId: null });
  }

  function addRow() {
    setItems((prev) => [...prev, emptyRow(`${idPrefix}-${nextRowId}`)]);
    setNextRowId((n) => n + 1);
  }

  function removeRow(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const payload = {
      items: items.map(({ reference, name, price, quantity, productId }) => ({
        reference,
        name,
        price,
        quantity,
        productId: productId ?? undefined,
      })),
      taxEnabled,
      taxPercent,
      billTo: {
        name: billToName,
        phone: billToPhone,
        address: billToAddress,
        taxId: billToTaxId,
        customerId: selectedCustomerId ?? undefined,
      },
      dateOfDelivery,
      placeOfSupply,
      modeOfPayment,
      additionalInfo,
    };

    startTransition(async () => {
      if (isEdit) {
        const result = await updateInvoice(props.invoiceId, payload);
        if (result.success) {
          setSuccessMessage("Changes saved.");
          router.refresh();
        } else {
          setError(result.error);
        }
      } else {
        const result = await createInvoice(payload);
        if (result.success) {
          router.push(`/invoices/${result.id}`);
        } else {
          setError(result.error);
        }
      }
    });
  }

  const formFields = (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Purchaser (Bill To)</h2>
          {selectedCustomerId && (
            <span className="rounded-full bg-primary-muted px-2 py-0.5 text-xs font-medium text-primary">
              Existing customer — edits will update their record
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CustomerAutocomplete
            customers={customers}
            value={billToName}
            required={taxEnabled}
            onChange={(name) => {
              setBillToName(name);
              setSelectedCustomerId(null);
            }}
            onSelect={(customer) => {
              setBillToName(customer.name);
              setBillToPhone(customer.phone ?? "");
              setBillToAddress(customer.address ?? "");
              setBillToTaxId(customer.taxId ?? "");
              setSelectedCustomerId(customer.id);
            }}
          />
          <input
            type="text"
            value={billToPhone}
            onChange={(e) => setBillToPhone(e.target.value)}
            placeholder="Phone"
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={billToTaxId}
            onChange={(e) => setBillToTaxId(e.target.value)}
            placeholder="Purchaser's TIN"
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={billToAddress}
            onChange={(e) => setBillToAddress(e.target.value)}
            placeholder="Address"
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm sm:col-span-2"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Invoice Details</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Date of Delivery
            <input
              type="date"
              value={dateOfDelivery}
              onChange={(e) => setDateOfDelivery(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Place of Supply
            <input
              type="text"
              value={placeOfSupply}
              onChange={(e) => setPlaceOfSupply(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
            Mode of Payment
            <select
              value={modeOfPayment}
              onChange={(e) => setModeOfPayment(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground"
            >
              <option value="">Select...</option>
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Items</h2>
        <div className="overflow-x-auto">
          <div className="grid min-w-[42rem] grid-cols-[1.5rem_4rem_1fr_5.5rem_3.5rem_9rem_1.75rem] gap-2 text-xs font-medium text-muted-foreground">
            <span />
            <span>Ref.</span>
            <span>Item</span>
            <span>Price</span>
            <span>Qty</span>
            <span>Line total</span>
            <span />
          </div>

          {items.map((item) => (
            <div
              key={item.id}
              className="grid min-w-[42rem] grid-cols-[1.5rem_4rem_1fr_5.5rem_3.5rem_9rem_1.75rem] items-center gap-2"
            >
              <InitialsAvatar name={item.name} colorSeed={item.id} shape="square" size={24} />
              <span
                title={item.productId ? undefined : "Assigned automatically when saved"}
                className="truncate rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm text-muted-foreground"
              >
                {item.reference || "Auto"}
              </span>
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <ItemAutocomplete
                    products={products}
                    value={item.name}
                    disabled={Boolean(item.productId)}
                    onChange={(name) => updateItem(item.id, { name })}
                    onSelect={(product) => selectProduct(item.id, product)}
                  />
                </div>
                {item.productId && (
                  <button
                    type="button"
                    onClick={() => resetItemToBlank(item.id)}
                    title="Use a different item"
                    aria-label="Use a different item"
                    className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={item.price}
                onChange={(e) => updateItem(item.id, { price: e.target.valueAsNumber || 0 })}
                required
                className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min="0"
                max="10000"
                step="1"
                value={item.quantity}
                onChange={(e) =>
                  updateItem(item.id, { quantity: e.target.valueAsNumber || 0 })
                }
                required
                className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm"
              />
              <span className="truncate px-2 py-1.5 text-right text-sm text-muted-foreground">
                {formatCurrency(computeLineTotal(item))}
              </span>
              <button
                type="button"
                onClick={() => removeRow(item.id)}
                disabled={items.length === 1}
                aria-label="Remove item"
                className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-danger-muted hover:text-danger disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 self-start rounded-md px-1 py-1 text-sm font-medium text-primary hover:underline"
        >
          <Plus size={16} />
          Add new line
        </button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Additional Information ({additionalInfo.length}/200)
        <textarea
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          rows={2}
          maxLength={200}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="flex items-center gap-3">
        <input
          id={`${idPrefix}-tax-toggle`}
          type="checkbox"
          checked={taxEnabled}
          onChange={(e) => setTaxEnabled(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        <label htmlFor={`${idPrefix}-tax-toggle`} className="text-sm font-medium">
          Apply VAT
        </label>
        {taxEnabled && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.valueAsNumber || 0)}
              className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
        <div className="flex w-full max-w-72 justify-between gap-3">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="text-right">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex w-full max-w-72 justify-between gap-3">
          <span className="text-muted-foreground">VAT</span>
          <span className="text-right">{formatCurrency(taxAmount)}</span>
        </div>
        <div className="flex w-full max-w-72 justify-between gap-3 text-base font-semibold">
          <span>Total</span>
          <span className="text-right">{formatCurrency(total)}</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {successMessage && (
        <p role="status" className="text-sm text-success">
          {successMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving..." : isEdit ? "Save Changes" : "Save Invoice"}
      </button>
    </>
  );

  if (isEdit) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-4xl flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-foreground">Invoice {props.invoiceNo}</h1>
        {formFields}
      </form>
    );
  }

  return (
    <div className="grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-2">
      <form
        onSubmit={handleSubmit}
        className="print:hidden flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-foreground">New Invoice</h1>
        {formFields}
      </form>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <InvoicePreviewPanel
          business={business}
          calibration={{
            dmOffsetXMm: business?.dmOffsetXMm ?? 0,
            dmOffsetYMm: business?.dmOffsetYMm ?? 0,
            dmFontSizePt: business?.dmFontSizePt ?? 10,
            dmItemRowMm: business?.dmItemRowMm ?? 6,
          }}
          billTo={{ name: billToName, phone: billToPhone, address: billToAddress, taxId: billToTaxId }}
          dateOfDelivery={dateOfDelivery ? new Date(dateOfDelivery) : null}
          placeOfSupply={placeOfSupply}
          modeOfPayment={modeOfPayment}
          additionalInfo={additionalInfo}
          items={items}
          taxEnabled={taxEnabled}
          taxPercent={taxPercent}
          subtotal={subtotal}
          taxAmount={taxAmount}
          total={total}
        />
      </div>
    </div>
  );
}
