"use client";

import { Printer } from "lucide-react";
import { computeLineTotal } from "@/lib/invoice-math";
import { amountToWords } from "@/lib/number-to-words";
import { formatInvoiceDate } from "@/lib/date-format";

const NAVY = "#1c4a86";
const NAVY_LIGHT = "#dbe4f7";

type BusinessInfo = {
  businessName: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  taxId: string | null;
} | null;

type PreviewItem = {
  reference: string;
  name: string;
  price: number;
  quantity: number;
};

type BillTo = {
  name: string;
  phone: string;
  address: string;
  taxId: string;
};

type InvoicePreviewProps = {
  business: BusinessInfo;
  invoiceNo?: string;
  date?: Date;
  dateOfDelivery?: Date | null;
  placeOfSupply?: string | null;
  modeOfPayment?: string | null;
  additionalInfo?: string | null;
  billTo: BillTo;
  items: PreviewItem[];
  taxEnabled: boolean;
  taxPercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
};

function InfoLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-1 leading-snug">
      <span className="shrink-0 font-bold" style={{ color: NAVY }}>
        {label} :
      </span>
      <span className="break-words">{value || ""}</span>
    </div>
  );
}

export default function InvoicePreview({
  business,
  invoiceNo,
  date,
  dateOfDelivery,
  placeOfSupply,
  modeOfPayment,
  additionalInfo,
  billTo,
  items,
  taxEnabled,
  taxPercent,
  subtotal,
  taxAmount,
  total,
}: InvoicePreviewProps) {
  const invoiceDate = date ?? new Date();

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-sm font-semibold text-muted-foreground">Preview</h2>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
        >
          <Printer size={14} />
          Print
        </button>
      </div>

      <div className="invoice-document flex flex-col rounded-md border-2 bg-white p-6 text-black print:border print:p-0 print:shadow-none" style={{ borderColor: NAVY }}>
        {/* Header */}
        <div className="flex flex-col items-center gap-2 pb-4 text-center">
          <h1
            className="text-3xl font-extrabold uppercase tracking-wide"
            style={{ color: NAVY }}
          >
            {business?.businessName || "Your Business Name"}
          </h1>
          <span
            className="rounded px-4 py-1 text-sm font-bold uppercase tracking-widest text-white"
            style={{ backgroundColor: NAVY }}
          >
            Tax Invoice
          </span>
        </div>

        {/* Date of Invoice / Tax Invoice No. */}
        <div className="grid grid-cols-2 border" style={{ borderColor: NAVY }}>
          <div className="border-r px-3 py-2 text-sm" style={{ borderColor: NAVY }}>
            <span className="font-bold" style={{ color: NAVY }}>
              Date of Invoice
            </span>
            <span className="ml-1">: {formatInvoiceDate(invoiceDate)}</span>
          </div>
          <div className="px-3 py-2 text-sm">
            <span className="font-bold" style={{ color: NAVY }}>
              Tax Invoice No.
            </span>
            <span className="ml-1">: {invoiceNo ?? "Assigned on save"}</span>
          </div>
        </div>

        {/* Supplier / Purchaser */}
        <div className="grid grid-cols-2 border border-t-0" style={{ borderColor: NAVY }}>
          <div
            className="flex flex-col gap-1 border-r px-3 py-3 text-sm"
            style={{ borderColor: NAVY, backgroundColor: NAVY_LIGHT }}
          >
            <InfoLine label="Supplier's TIN" value={business?.taxId} />
            <InfoLine label="Supplier's Name" value={business?.businessName} />
            <InfoLine label="Address" value={business?.address} />
            <InfoLine label="E-mail" value={business?.email} />
            <InfoLine label="Telephone No." value={business?.phone} />
            <InfoLine label="Fax" value={business?.fax} />
          </div>
          <div
            className="flex flex-col gap-1 px-3 py-3 text-sm"
            style={{ backgroundColor: NAVY_LIGHT }}
          >
            <InfoLine label="Purchaser's TIN" value={billTo.taxId} />
            <InfoLine label="Purchaser's Name" value={billTo.name} />
            <InfoLine label="Address" value={billTo.address} />
            <InfoLine label="Telephone No." value={billTo.phone} />
          </div>
        </div>

        {/* Date of Supply / Place of Supply */}
        <div className="grid grid-cols-2 border border-t-0" style={{ borderColor: NAVY }}>
          <div className="border-r px-3 py-2 text-sm" style={{ borderColor: NAVY }}>
            <span className="font-bold" style={{ color: NAVY }}>
              Date of Supply
            </span>
            <span className="ml-1">
              : {dateOfDelivery ? formatInvoiceDate(dateOfDelivery) : ""}
            </span>
          </div>
          <div className="px-3 py-2 text-sm">
            <span className="font-bold" style={{ color: NAVY }}>
              Place of Supply
            </span>
            <span className="ml-1">: {placeOfSupply ?? ""}</span>
          </div>
        </div>

        {/* Additional Information */}
        <div className="border border-t-0 px-3 py-2 text-sm" style={{ borderColor: NAVY }}>
          <span className="font-bold" style={{ color: NAVY }}>
            Additional Information if any
          </span>
          <span className="ml-1">: {additionalInfo ?? ""}</span>
        </div>

        {/* Items table */}
        <table className="w-full border border-t-0 text-sm" style={{ borderColor: NAVY }}>
          <thead>
            <tr style={{ backgroundColor: NAVY }} className="text-white">
              <th
                className="border-r px-2 py-2 text-left text-xs font-bold uppercase"
                style={{ borderColor: "rgba(255,255,255,0.35)" }}
              >
                Reference
              </th>
              <th
                className="border-r px-2 py-2 text-left text-xs font-bold uppercase"
                style={{ borderColor: "rgba(255,255,255,0.35)" }}
              >
                Description of Goods or Services
              </th>
              <th
                className="border-r px-2 py-2 text-right text-xs font-bold uppercase"
                style={{ borderColor: "rgba(255,255,255,0.35)" }}
              >
                Qty.
              </th>
              <th
                className="border-r px-2 py-2 text-right text-xs font-bold uppercase"
                style={{ borderColor: "rgba(255,255,255,0.35)" }}
              >
                Unit Price
              </th>
              <th className="px-2 py-2 text-right text-xs font-bold uppercase">
                Amount Excluding VAT (Rs.)
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="h-20 px-2 py-2 text-center text-muted-foreground">
                  No items added
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={index} className="border-t" style={{ borderColor: NAVY }}>
                  <td className="border-r px-2 py-1.5" style={{ borderColor: NAVY }}>
                    {item.reference}
                  </td>
                  <td className="border-r px-2 py-1.5" style={{ borderColor: NAVY }}>
                    {item.name || "Item name"}
                  </td>
                  <td className="border-r px-2 py-1.5 text-right" style={{ borderColor: NAVY }}>
                    {item.quantity}
                  </td>
                  <td className="border-r px-2 py-1.5 text-right" style={{ borderColor: NAVY }}>
                    {item.price.toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{computeLineTotal(item).toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border border-t-0" style={{ borderColor: NAVY }}>
          <div
            className="flex items-center justify-between border-b px-3 py-1.5 text-sm"
            style={{ borderColor: NAVY }}
          >
            <span className="font-semibold" style={{ color: NAVY }}>
              Total Value of Supply
            </span>
            <span className="px-3 py-0.5 font-medium" style={{ backgroundColor: NAVY_LIGHT }}>
              {subtotal.toFixed(2)}
            </span>
          </div>
          <div
            className="flex items-center justify-between border-b px-3 py-1.5 text-sm"
            style={{ borderColor: NAVY }}
          >
            <span className="font-semibold" style={{ color: NAVY }}>
              VAT Amount (Total Value of Supply @ {taxEnabled ? taxPercent : 0}%)
            </span>
            <span className="px-3 py-0.5 font-medium" style={{ backgroundColor: NAVY_LIGHT }}>
              {taxAmount.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5 text-sm">
            <span className="font-bold" style={{ color: NAVY }}>
              Total Amount Including VAT
            </span>
            <span className="px-3 py-0.5 font-bold" style={{ backgroundColor: NAVY_LIGHT }}>
              {total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Amount in words / Payment mode */}
        <div className="border border-t-0 px-3 py-2 text-sm" style={{ borderColor: NAVY }}>
          <span className="font-bold" style={{ color: NAVY }}>
            Total Amount In Words
          </span>
          <span className="ml-1">: {amountToWords(total)}</span>
        </div>
        <div className="border border-t-0 px-3 py-2 text-sm" style={{ borderColor: NAVY }}>
          <span className="font-bold" style={{ color: NAVY }}>
            Mode of Payment
          </span>
          <span className="ml-1">: {modeOfPayment ?? ""}</span>
        </div>

        {/* Footer signatures */}
        <div className="mt-12 grid grid-cols-3 gap-4 px-2 text-center text-xs">
          <div className="border-t border-dotted pt-1" style={{ borderColor: NAVY }}>
            Authorised By
          </div>
          <div className="border-t border-dotted pt-1" style={{ borderColor: NAVY }}>
            Name
          </div>
          <div className="border-t border-dotted pt-1" style={{ borderColor: NAVY }}>
            Goods Received By
            <br />
            Seal, Signature &amp; Date
          </div>
        </div>
      </div>
    </div>
  );
}
