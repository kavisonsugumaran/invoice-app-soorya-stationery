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
import { tinError, TIN_LENGTH } from "@/lib/validation";
import { PHONE_LENGTH } from "@/lib/phone-format";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

const PAYMENT_MODES = ["Cash", "Card", "Bank Transfer", "Cheque"] as const;

type LinkedProduct = { id: string; reference: string; name: string; price: number };

type ItemRow = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  // The product this row was selected from, remembered independently of live
  // edits — see activeLink() below for why this isn't just cleared on edit.
  linkedProduct: LinkedProduct | null;
};

// A row only still represents its linked product while name and price match
// what was selected — resolveInvoiceItems() (server-side) uses the same
// name+price match to decide whether to reuse that product or mint a new
// one, so this keeps the Ref. column truthful to what save will actually do.
// Editing away shows "Auto" (a new/different product); editing back to the
// original values re-shows the original reference, rather than staying
// cleared forever.
function activeLink(item: ItemRow): LinkedProduct | null {
  if (!item.linkedProduct) return null;
  return item.linkedProduct.name === item.name.trim() && item.linkedProduct.price === item.price
    ? item.linkedProduct
    : null;
}

type BusinessInfo = {
  businessName: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  taxId: string | null;
  dmOffsetXMm: number;
  dmOffsetYMm: number;
  dmFontSizePt: number;
  dmItemRowMm: number;
  dmScaleY: number;
  dmScaleX: number;
} | null;

export type InvoiceFormInitialData = {
  billTo: { name: string; phone: string; address: string; taxId: string; customerId: string | null };
  date: string;
  dateOfDelivery: string;
  placeOfSupply: string;
  modeOfPayment: string;
  additionalInfo: string;
  taxEnabled: boolean;
  taxPercent: number;
  items: InvoiceItemInput[];
};

function todayDateInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

type InvoiceFormProps = {
  business: BusinessInfo;
  customers: CustomerOption[];
  products: ProductOption[];
} & (
  | { mode?: "create" }
  | { mode: "edit"; invoiceId: string; invoiceNo: string; initialData: InvoiceFormInitialData }
);

function emptyRow(id: string): ItemRow {
  return { id, name: "", price: 0, quantity: 1, linkedProduct: null };
}

export default function InvoiceForm(props: InvoiceFormProps) {
  const { business, customers, products } = props;
  const isEdit = props.mode === "edit";
  const initial = isEdit ? props.initialData : null;

  const router = useRouter();
  const { showToast } = useToast();
  const idPrefix = useId();
  const [nextRowId, setNextRowId] = useState(1);
  const [items, setItems] = useState<ItemRow[]>(
    initial && initial.items.length > 0
      ? initial.items.map((item, i) => ({
          id: `${idPrefix}-init-${i}`,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          linkedProduct: item.productId
            ? { id: item.productId, reference: item.reference, name: item.name, price: item.price }
            : null,
        }))
      : [emptyRow(`${idPrefix}-0`)]
  );
  const [billToName, setBillToName] = useState(initial?.billTo.name ?? "");
  const [billToPhone, setBillToPhone] = useState(initial?.billTo.phone ?? "");
  const [billToAddress, setBillToAddress] = useState(initial?.billTo.address ?? "");
  const [billToTaxId, setBillToTaxId] = useState(initial?.billTo.taxId ?? "");
  const [billToTaxIdError, setBillToTaxIdError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initial?.billTo.customerId ?? null
  );
  const [date, setDate] = useState(initial?.date ?? todayDateInputValue());
  const [dateOfDelivery, setDateOfDelivery] = useState(initial?.dateOfDelivery ?? "");
  const [placeOfSupply, setPlaceOfSupply] = useState(initial?.placeOfSupply ?? "");
  const [modeOfPayment, setModeOfPayment] = useState(initial?.modeOfPayment ?? "");
  const [additionalInfo, setAdditionalInfo] = useState(initial?.additionalInfo ?? "");
  const [taxEnabled, setTaxEnabled] = useState(initial?.taxEnabled ?? false);
  const [taxPercent, setTaxPercent] = useState(initial?.taxPercent ?? 18);
  // TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md).
  // Create-mode only; remove this state and its UI once the backfill is done.
  const [isOldInvoice, setIsOldInvoice] = useState(false);
  const [oldInvoiceNo, setOldInvoiceNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { subtotal, taxAmount, total } = useMemo(
    () => computeInvoiceTotals(items, taxEnabled, taxPercent),
    [items, taxEnabled, taxPercent]
  );

  // Blank scaffold rows (unfilled "add item" slots) shouldn't render as a
  // phantom Qty 1 / Rs. 0.00 line in the preview until a name is entered.
  const previewItems = useMemo(
    () =>
      items
        .filter((item) => item.name.trim() !== "")
        .map((item) => ({
          reference: activeLink(item)?.reference ?? "",
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
    [items]
  );

  function updateItem(id: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function selectProduct(id: string, product: ProductOption) {
    updateItem(id, {
      name: product.name,
      price: product.price,
      linkedProduct: { id: product.id, reference: product.reference, name: product.name, price: product.price },
    });
  }

  // Clears the row entirely so the user can pick or type a different item
  // instead of overwriting the original product's identity. Quantity is left as-is.
  function resetItemToBlank(id: string) {
    updateItem(id, { name: "", price: 0, linkedProduct: null });
  }

  function addRow() {
    setItems((prev) => [...prev, emptyRow(`${idPrefix}-${nextRowId}`)]);
    setNextRowId((n) => n + 1);
  }

  // Below the invoice's one-item minimum, "removing" the last row clears it back
  // to blank instead of leaving the user stuck with no way to remove it at all.
  function removeRow(id: string) {
    setItems((prev) =>
      prev.length > 1
        ? prev.filter((row) => row.id !== id)
        : prev.map((row) => (row.id === id ? emptyRow(row.id) : row))
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const taxIdValidationError = tinError(billToTaxId);
    setBillToTaxIdError(taxIdValidationError);
    if (taxIdValidationError) {
      return;
    }

    setIsConfirmOpen(true);
  }

  function handleConfirm() {
    const payload = {
      items: items.map((item) => {
        const link = activeLink(item);
        return {
          reference: link?.reference ?? "",
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          productId: link?.id,
        };
      }),
      taxEnabled,
      taxPercent,
      billTo: {
        name: billToName,
        phone: billToPhone,
        address: billToAddress,
        taxId: billToTaxId,
        customerId: selectedCustomerId ?? undefined,
      },
      date,
      dateOfDelivery,
      placeOfSupply,
      modeOfPayment,
      additionalInfo,
      // TEMPORARY (Aug 2026 backfill) — isOldInvoice/oldInvoiceNo are only
      // ever set from the create form; irrelevant on edit since
      // updateInvoice() never regenerates invoiceNo regardless.
      ...(isEdit ? {} : { isOldInvoice, ...(isOldInvoice ? { oldInvoiceNo } : {}) }),
    };

    startTransition(async () => {
      if (isEdit) {
        const result = await updateInvoice(props.invoiceId, payload);
        if (result.success) {
          showToast("Changes saved.");
          setIsConfirmOpen(false);
          router.refresh();
        } else {
          setError(result.error);
          setIsConfirmOpen(false);
        }
      } else {
        const result = await createInvoice(payload);
        if (result.success) {
          router.push(`/invoices/${result.id}`);
        } else {
          setError(result.error);
          setIsConfirmOpen(false);
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
            inputMode="numeric"
            value={billToPhone}
            onChange={(e) => setBillToPhone(e.target.value.replace(/\D/g, "").slice(0, PHONE_LENGTH))}
            maxLength={PHONE_LENGTH}
            placeholder="Phone"
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          />
          <div className="flex flex-col gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={billToTaxId}
              onChange={(e) => {
                setBillToTaxId(e.target.value.replace(/\D/g, "").slice(0, TIN_LENGTH));
                setBillToTaxIdError(null);
              }}
              onBlur={() => setBillToTaxIdError(tinError(billToTaxId))}
              placeholder="Purchaser's TIN"
              maxLength={TIN_LENGTH}
              aria-invalid={billToTaxIdError ? true : undefined}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
            {billToTaxIdError && (
              <span role="alert" className="text-xs text-danger">
                {billToTaxIdError}
              </span>
            )}
          </div>
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
            Date of Invoice
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Date of Supply
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

      {/* TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md).
          Remove this block once the client finishes backfilling old invoices. */}
      {!isEdit && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-muted px-3 py-2.5 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={isOldInvoice}
              onChange={(e) => setIsOldInvoice(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="font-medium text-foreground">This is a backfilled paper invoice</span>
              <span className="block text-xs text-muted-foreground">
                Type in the invoice number from the handwritten paper copy below, instead of
                getting the next real invoice number — so entering old invoices doesn&apos;t use up
                today&apos;s numbering.
              </span>
            </span>
          </label>
          {isOldInvoice && (
            <input
              type="text"
              value={oldInvoiceNo}
              onChange={(e) => setOldInvoiceNo(e.target.value)}
              placeholder="Invoice number from the paper copy"
              maxLength={40}
              required
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Items</h2>
        <div className="overflow-x-auto">
          <div className="grid min-w-[44rem] grid-cols-[1.5rem_4rem_1fr_5.5rem_5rem_9rem_1.75rem] gap-2 text-xs font-medium text-muted-foreground">
            <span />
            <span>Ref.</span>
            <span>Item</span>
            <span>Price</span>
            <span>Qty</span>
            <span className="text-right">Line total</span>
            <span />
          </div>

          {items.map((item) => {
            const link = activeLink(item);
            return (
              <div
                key={item.id}
                className="grid min-w-[44rem] grid-cols-[1.5rem_4rem_1fr_5.5rem_5rem_9rem_1.75rem] items-center gap-2"
              >
                <InitialsAvatar name={item.name} colorSeed={item.id} shape="square" size={24} />
                <span
                  title={link ? undefined : "Assigned automatically when saved"}
                  className="truncate rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm text-muted-foreground"
                >
                  {link?.reference || "Auto"}
                </span>
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <ItemAutocomplete
                      products={products}
                      value={item.name}
                      onChange={(name) => updateItem(item.id, { name })}
                      onSelect={(product) => selectProduct(item.id, product)}
                    />
                  </div>
                  {link && (
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
                  max="999999"
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
                  aria-label="Remove item"
                  className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-danger-muted hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
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

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving..." : isEdit ? "Save Changes" : "Save Invoice"}
      </button>

      {isConfirmOpen && (
        <ConfirmModal
          title={isEdit ? "Save Changes?" : "Save Invoice?"}
          message={
            isEdit
              ? "Save these changes to the invoice?"
              : `Save this invoice for ${formatCurrency(total)}?`
          }
          confirmLabel={isPending ? "Saving..." : "Confirm"}
          isPending={isPending}
          onConfirm={handleConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
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
    // print:block overrides the grid — a grid/flex ancestor above the
    // multi-page print content breaks Chromium's print pagination (see the
    // comment in DotMatrixInvoice.tsx). The form is print:hidden anyway, so
    // at print time this only ever has the one visible child.
    //
    // Columns are weighted 3fr/2fr rather than an even split: the form is
    // the primary task and needs room for the items table (fixed min-width,
    // to keep line-total figures from wrapping), while the preview is a
    // fixed-size (physical paper dimensions) supplementary view that
    // doesn't benefit from extra width the way the form does. max-w bumped
    // from 7xl so wide monitors actually get to use that ratio instead of
    // both columns getting capped down to the old ~1280px total first.
    // Each track is wrapped in minmax(0,...) (same as Tailwind's built-in
    // grid-cols-N does automatically, but arbitrary values don't) — without
    // it, the preview's fixed-width paper content forces its track wider
    // than 2fr, stealing space from the form again.
    <div className="grid w-full max-w-[100rem] grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] print:block">
      <form
        onSubmit={handleSubmit}
        className="print:hidden flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-foreground">New Invoice</h1>
        {formFields}
      </form>

      {/* min-w-0: grid items default to min-width:auto (sized to their content's
          min-content), which would let the fixed-width paper preview force this
          column wider than its minmax(0,2fr) track allows. DotMatrixInvoice
          scales its own content to fit whatever width this column ends up with. */}
      <div className="min-w-0 lg:sticky lg:top-6 lg:self-start print:static">
        <InvoicePreviewPanel
          business={business}
          calibration={{
            dmOffsetXMm: business?.dmOffsetXMm ?? 0,
            dmOffsetYMm: business?.dmOffsetYMm ?? 0,
            dmFontSizePt: business?.dmFontSizePt ?? 10,
            dmItemRowMm: business?.dmItemRowMm ?? 6,
            dmScaleY: business?.dmScaleY ?? 1,
            dmScaleX: business?.dmScaleX ?? 1,
          }}
          billTo={{ name: billToName, phone: billToPhone, address: billToAddress, taxId: billToTaxId }}
          dateOfDelivery={dateOfDelivery ? new Date(dateOfDelivery) : null}
          placeOfSupply={placeOfSupply}
          modeOfPayment={modeOfPayment}
          additionalInfo={additionalInfo}
          items={previewItems}
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
