"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { createSmallBill, updateInvoice, type SmallBillItemInput } from "@/app/actions/invoices";
import SmallBillPrint, { type SmallBillCalibration } from "@/components/small-bill-print/SmallBillPrint";
import { computeInvoiceTotals, computeLineTotal } from "@/lib/invoice-math";
import { SMALL_BILL_ITEMS_PER_PAGE } from "@/lib/small-bill";
import { formatCurrency } from "@/lib/currency";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import CustomerAutocomplete, {
  type CustomerOption,
} from "@/components/invoice-form/CustomerAutocomplete";
import ItemAutocomplete, {
  type ProductOption,
} from "@/components/invoice-form/ItemAutocomplete";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

type LinkedProduct = { id: string; reference: string; name: string; price: number };

type ItemRow = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  linkedProduct: LinkedProduct | null;
};

// Same reasoning as InvoiceForm.tsx's activeLink() — kept in sync with it.
function activeLink(item: ItemRow): LinkedProduct | null {
  if (!item.linkedProduct) return null;
  return item.linkedProduct.name === item.name.trim() && item.linkedProduct.price === item.price
    ? item.linkedProduct
    : null;
}

type BusinessInfo = {
  businessName: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
} | null;

export type SmallBillFormInitialData = {
  billToName: string;
  phone: string;
  address: string;
  taxId: string;
  customerId: string | null;
  date: string;
  items: SmallBillItemInput[];
};

function todayDateInputValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

type SmallBillFormProps = {
  business: BusinessInfo;
  calibration: SmallBillCalibration;
  customers: CustomerOption[];
  products: ProductOption[];
} & (
  | { mode?: "create" }
  | { mode: "edit"; invoiceId: string; invoiceNo: string; initialData: SmallBillFormInitialData }
);

function emptyRow(id: string): ItemRow {
  return { id, name: "", price: 0, quantity: 1, linkedProduct: null };
}

export default function SmallBillForm(props: SmallBillFormProps) {
  const { business, calibration, customers, products } = props;
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
          linkedProduct: null,
        }))
      : [emptyRow(`${idPrefix}-0`)]
  );
  const [billToName, setBillToName] = useState(initial?.billToName ?? "");
  // Not shown as inputs (the pad has no fields for these) — but still
  // carried through so selecting an existing customer via the autocomplete
  // doesn't blank out their phone/address/TIN on save (upsertCustomer
  // overwrites with whatever's passed for the selected customerId).
  const [billToPhone, setBillToPhone] = useState(initial?.phone ?? "");
  const [billToAddress, setBillToAddress] = useState(initial?.address ?? "");
  const [billToTaxId, setBillToTaxId] = useState(initial?.taxId ?? "");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initial?.customerId ?? null
  );
  const [date, setDate] = useState(initial?.date ?? todayDateInputValue());
  const [paymentType, setPaymentType] = useState<"CASH" | "CREDIT">("CASH");
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { total } = useMemo(() => computeInvoiceTotals(items, false, 0), [items]);

  const previewItems = useMemo(
    () => items.filter((item) => item.name.trim() !== ""),
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

  function resetItemToBlank(id: string) {
    updateItem(id, { name: "", price: 0, linkedProduct: null });
  }

  function addRow() {
    setItems((prev) => [...prev, emptyRow(`${idPrefix}-${nextRowId}`)]);
    setNextRowId((n) => n + 1);
  }

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
    setIsConfirmOpen(true);
  }

  function handleConfirm() {
    const itemPayload: SmallBillItemInput[] = items.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    startTransition(async () => {
      if (isEdit) {
        const result = await updateInvoice(props.invoiceId, {
          items: items.map((item) => {
            const link = activeLink(item);
            return {
              reference: "",
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              productId: link?.id,
            };
          }),
          taxEnabled: false,
          taxPercent: 0,
          billTo: {
            name: billToName,
            phone: billToPhone,
            address: billToAddress,
            taxId: billToTaxId,
            customerId: selectedCustomerId ?? undefined,
          },
          date,
          dateOfDelivery: "",
          placeOfSupply: "",
          modeOfPayment: "",
          additionalInfo: "",
        });
        if (result.success) {
          showToast("Changes saved.");
          setIsConfirmOpen(false);
          router.refresh();
        } else {
          setError(result.error);
          setIsConfirmOpen(false);
        }
      } else {
        const result = await createSmallBill({
          items: itemPayload,
          billToName,
          phone: billToPhone,
          address: billToAddress,
          taxId: billToTaxId,
          customerId: selectedCustomerId ?? undefined,
          date,
          status: paymentType === "CASH" ? "PAID" : "UNPAID",
        });
        if (result.success) {
          // More than SMALL_BILL_ITEMS_PER_PAGE items: createSmallBill split
          // the overflow into additional, independent bills for the same
          // customer rather than one bill spanning multiple print pages —
          // surface those extra numbers since only the first one is where
          // this navigates.
          if (result.additionalInvoiceNos?.length) {
            showToast(
              `Saved as ${[result.invoiceNo, ...result.additionalInvoiceNos].join(", ")} — split across ${
                1 + result.additionalInvoiceNos.length
              } bills (more than ${SMALL_BILL_ITEMS_PER_PAGE} items).`
            );
          }
          router.push(`/small-bills/${result.id}`);
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
          <h2 className="text-sm font-semibold text-muted-foreground">Customer</h2>
          {selectedCustomerId && (
            <span className="rounded-full bg-primary-muted px-2 py-0.5 text-xs font-medium text-primary">
              Existing customer
            </span>
          )}
        </div>
        <CustomerAutocomplete
          customers={customers}
          value={billToName}
          required={false}
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
      </div>

      <label className="flex w-full max-w-xs flex-col gap-1 text-xs text-muted-foreground">
        Date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Items</h2>
        <div className="overflow-x-auto">
          <div className="grid min-w-[36rem] grid-cols-[1.5rem_1fr_5.5rem_5rem_9rem_1.75rem] gap-2 text-xs font-medium text-muted-foreground">
            <span />
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
                className="grid min-w-[36rem] grid-cols-[1.5rem_1fr_5.5rem_5rem_9rem_1.75rem] items-center gap-2"
              >
                <InitialsAvatar name={item.name} colorSeed={item.id} shape="square" size={24} />
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
                  onChange={(e) => updateItem(item.id, { quantity: e.target.valueAsNumber || 0 })}
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

      {/* Cash/Credit only matters at creation — after that, status changes
          go through the InvoiceStatusToggle in the page header, same split
          InvoiceForm/invoices/[id]/page.tsx already have. */}
      {!isEdit && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Payment</h2>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`${idPrefix}-payment-type`}
                checked={paymentType === "CASH"}
                onChange={() => setPaymentType("CASH")}
                className="h-4 w-4 accent-primary"
              />
              Cash
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`${idPrefix}-payment-type`}
                checked={paymentType === "CREDIT"}
                onChange={() => setPaymentType("CREDIT")}
                className="h-4 w-4 accent-primary"
              />
              Credit
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
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
        {isPending ? "Saving..." : isEdit ? "Save Changes" : "Save Bill"}
      </button>

      {isConfirmOpen && (
        <ConfirmModal
          title={isEdit ? "Save Changes?" : "Save Bill?"}
          message={
            isEdit
              ? "Save these changes to the bill?"
              : `Save this bill for ${formatCurrency(total)}?`
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
        className="flex w-full max-w-3xl flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-foreground">Small Bill {props.invoiceNo}</h1>
        {formFields}
      </form>
    );
  }

  return (
    // print:block overrides the grid — same Chromium print-pagination
    // safety reasoning as InvoiceForm.tsx. The preview column is narrower
    // here (2fr not needed) since the physical page is only 5.5in square.
    <div className="grid w-full max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.5fr)] print:block">
      <form
        onSubmit={handleSubmit}
        className="print:hidden flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-foreground">New Small Bill</h1>
        {formFields}
      </form>

      <div className="min-w-0 lg:sticky lg:top-6 lg:self-start print:static">
        <SmallBillPrint
          business={business}
          calibration={calibration}
          billToName={billToName}
          items={previewItems}
        />
      </div>
    </div>
  );
}
