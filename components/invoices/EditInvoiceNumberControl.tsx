"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import EditInvoiceNumberModal from "@/components/invoices/EditInvoiceNumberModal";

// Lets any staff member (not just admins) fix an invoice's number directly —
// narrower than full invoice editing, which stays admin-only — but only
// with an admin password to authorize it (see updateInvoiceNumber()).
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
