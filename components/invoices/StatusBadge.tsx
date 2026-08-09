import type { InvoiceStatus } from "@prisma/client";

const STYLES: Record<InvoiceStatus, string> = {
  PAID: "bg-success-muted text-success",
  UNPAID: "bg-warning-muted text-warning",
  CANCELLED: "bg-surface-muted text-muted-foreground",
};

const LABELS: Record<InvoiceStatus, string> = {
  PAID: "Paid",
  UNPAID: "Unpaid",
  CANCELLED: "Cancelled",
};

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
