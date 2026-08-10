"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import EditInvoiceNumberModal from "@/components/invoices/EditInvoiceNumberModal";

// TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md).
// Lets any staff member (not just admins) fix an invoice's number directly —
// narrower than full invoice editing, which stays admin-only. Remove this
// component (and its two usages) once the backfill is finished.
export default function EditInvoiceNumberControl({
  invoiceId,
  invoiceNo,
}: {
  invoiceId: string;
  invoiceNo: string;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayedInvoiceNo, setDisplayedInvoiceNo] = useState(invoiceNo);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        title="Edit invoice number"
      >
        {displayedInvoiceNo}
        <Pencil size={13} />
      </button>

      {isModalOpen && (
        <EditInvoiceNumberModal
          invoiceId={invoiceId}
          currentInvoiceNo={displayedInvoiceNo}
          onClose={() => setIsModalOpen(false)}
          onSuccess={(newInvoiceNo) => {
            setDisplayedInvoiceNo(newInvoiceNo);
            setIsModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
