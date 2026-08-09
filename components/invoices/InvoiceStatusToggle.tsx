"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceStatus } from "@prisma/client";
import { Check, RotateCcw, Ban } from "lucide-react";
import { updateInvoiceStatus } from "@/app/actions/invoices";
import StatusBadge from "@/components/invoices/StatusBadge";
import ConfirmModal from "@/components/ui/ConfirmModal";
import MarkUnpaidModal from "@/components/invoices/MarkUnpaidModal";
import CancelInvoiceModal from "@/components/invoices/CancelInvoiceModal";

export default function InvoiceStatusToggle({
  invoiceId,
  status,
  variant = "compact",
}: {
  invoiceId: string;
  status: InvoiceStatus;
  /** "full" shows a labeled button (e.g. invoice header); "compact" shows an icon-only button (e.g. table rows). */
  variant?: "compact" | "full";
}) {
  const [isPending, startTransition] = useTransition();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isUnpaidModalOpen, setIsUnpaidModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const router = useRouter();

  const isUnpaid = status === "UNPAID";
  const isPaid = status === "PAID";
  const isCancelled = status === "CANCELLED";

  function markAsPaid() {
    startTransition(async () => {
      await updateInvoiceStatus(invoiceId, "PAID");
      setIsConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={status} />
      {isUnpaid &&
        (variant === "full" ? (
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-full bg-success px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check size={15} />
            Mark as Paid
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            disabled={isPending}
            title="Mark as Paid"
            aria-label="Mark as Paid"
            className="flex items-center justify-center rounded-md border border-border p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            <Check size={13} />
          </button>
        ))}

      {isPaid &&
        (variant === "full" ? (
          <button
            type="button"
            onClick={() => setIsUnpaidModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-danger-muted hover:text-danger"
          >
            <RotateCcw size={14} />
            Mark as Unpaid
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsUnpaidModalOpen(true)}
            title="Mark as Unpaid"
            aria-label="Mark as Unpaid"
            className="flex items-center justify-center rounded-md border border-border p-1 text-muted-foreground hover:bg-danger-muted hover:text-danger"
          >
            <RotateCcw size={13} />
          </button>
        ))}

      {!isCancelled &&
        (variant === "full" ? (
          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-danger-muted hover:text-danger"
          >
            <Ban size={14} />
            Cancel Invoice
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            title="Cancel Invoice"
            aria-label="Cancel Invoice"
            className="flex items-center justify-center rounded-md border border-border p-1 text-muted-foreground hover:bg-danger-muted hover:text-danger"
          >
            <Ban size={13} />
          </button>
        ))}

      {isConfirmOpen && (
        <ConfirmModal
          title="Mark as Paid?"
          message="This marks the invoice as paid. Reverting it back to unpaid later requires an admin password to confirm."
          confirmLabel={isPending ? "Marking as Paid..." : "Mark as Paid"}
          tone="success"
          isPending={isPending}
          onConfirm={markAsPaid}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}

      {isUnpaidModalOpen && (
        <MarkUnpaidModal
          invoiceId={invoiceId}
          onClose={() => setIsUnpaidModalOpen(false)}
          onSuccess={() => {
            setIsUnpaidModalOpen(false);
            router.refresh();
          }}
        />
      )}

      {isCancelModalOpen && (
        <CancelInvoiceModal
          invoiceId={invoiceId}
          onClose={() => setIsCancelModalOpen(false)}
          onSuccess={() => {
            setIsCancelModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
