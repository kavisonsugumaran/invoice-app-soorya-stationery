"use client";

import { useTransition } from "react";
import { FileSpreadsheet } from "lucide-react";
import type { InvoiceStatus } from "@prisma/client";
import { exportInvoicesToExcel } from "@/app/actions/reports";
import type { InvoiceTaxFolder } from "@/lib/invoices";
import { useToast } from "@/components/ui/ToastProvider";

export default function ExportInvoicesButton({
  from,
  to,
  folder,
  status,
}: {
  from?: string;
  to?: string;
  folder: InvoiceTaxFolder;
  status?: InvoiceStatus;
}) {
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const result = await exportInvoicesToExcel({ from, to, folder, status });
      if (!result.success) {
        showToast(result.error, "error");
        return;
      }

      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);

      showToast(`Exported ${result.rowCount} invoice${result.rowCount === 1 ? "" : "s"}.`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isPending}
      title="Exports using the current tab, status and date filters. Small bills are included under All and Non VAT; cancelled invoices only when the status filter is set to Cancelled."
      className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
    >
      <FileSpreadsheet size={16} />
      {isPending ? "Exporting..." : "Export to Excel"}
    </button>
  );
}
