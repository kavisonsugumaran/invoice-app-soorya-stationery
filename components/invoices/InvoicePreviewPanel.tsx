"use client";

import { useState } from "react";
import DotMatrixInvoice from "@/components/invoice-print/DotMatrixInvoice";
import InvoicePreview from "@/components/invoice-form/InvoicePreview";
import type { DmCalibration } from "@/lib/dot-matrix-layout";

type BusinessInfo = {
  businessName: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
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

type InvoicePreviewPanelProps = {
  business: BusinessInfo;
  calibration: DmCalibration;
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

export default function InvoicePreviewPanel({
  business,
  calibration,
  ...shared
}: InvoicePreviewPanelProps) {
  const [mode, setMode] = useState<"form" | "digital">("form");

  return (
    // Plain block layout (space-y-3, not flex flex-col) — a flex ancestor
    // above the multi-page DotMatrixInvoice content breaks Chromium's print
    // pagination (see the comment in DotMatrixInvoice.tsx).
    <div className="space-y-3">
      <div className="flex gap-1 print:hidden">
        <button
          type="button"
          onClick={() => setMode("form")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            mode === "form"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground hover:bg-surface-muted"
          }`}
        >
          Pre-printed Form
        </button>
        <button
          type="button"
          onClick={() => setMode("digital")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${
            mode === "digital"
              ? "bg-primary text-primary-foreground"
              : "border border-border text-muted-foreground hover:bg-surface-muted"
          }`}
        >
          Digital Copy
        </button>
      </div>

      {mode === "form" ? (
        <DotMatrixInvoice calibration={calibration} {...shared} />
      ) : (
        <InvoicePreview business={business} {...shared} />
      )}
    </div>
  );
}
