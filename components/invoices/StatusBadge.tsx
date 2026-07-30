import type { InvoiceStatus } from "@prisma/client";

export default function StatusBadge({ status }: { status: InvoiceStatus }) {
  const isPaid = status === "PAID";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isPaid ? "bg-success-muted text-success" : "bg-warning-muted text-warning"
      }`}
    >
      {isPaid ? "Paid" : "Unpaid"}
    </span>
  );
}
