"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceStatus } from "@prisma/client";
import { Check } from "lucide-react";
import { updateInvoiceStatus } from "@/app/actions/invoices";
import StatusBadge from "@/components/invoices/StatusBadge";

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
  const router = useRouter();

  // Paid is a one-way, terminal state — a paid invoice can never be marked unpaid again,
  // so once status is PAID there's no valid action left to offer.
  const isPaid = status === "PAID";

  function markAsPaid() {
    startTransition(async () => {
      await updateInvoiceStatus(invoiceId, "PAID");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={status} />
      {!isPaid &&
        (variant === "full" ? (
          <button
            type="button"
            onClick={markAsPaid}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            <Check size={13} />
            {isPending ? "Updating..." : "Mark as Paid"}
          </button>
        ) : (
          <button
            type="button"
            onClick={markAsPaid}
            disabled={isPending}
            title="Mark as Paid"
            aria-label="Mark as Paid"
            className="flex items-center justify-center rounded-md border border-border p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            <Check size={13} />
          </button>
        ))}
    </div>
  );
}
