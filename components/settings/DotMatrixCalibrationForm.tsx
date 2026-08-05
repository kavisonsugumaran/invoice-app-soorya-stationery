"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  updateDotMatrixCalibration,
  type DotMatrixCalibrationInput,
} from "@/app/actions/settings";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

export default function DotMatrixCalibrationForm({
  initial,
}: {
  initial: DotMatrixCalibrationInput;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [offsetX, setOffsetX] = useState(initial.dmOffsetXMm);
  const [offsetY, setOffsetY] = useState(initial.dmOffsetYMm);
  const [fontSize, setFontSize] = useState(initial.dmFontSizePt);
  const [rowHeight, setRowHeight] = useState(initial.dmItemRowMm);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsConfirmOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await updateDotMatrixCalibration({
        dmOffsetXMm: offsetX,
        dmOffsetYMm: offsetY,
        dmFontSizePt: fontSize,
        dmItemRowMm: rowHeight,
      });

      if (result.success) {
        showToast("Changes saved.");
        router.refresh();
      } else {
        setError(result.error);
      }
      setIsConfirmOpen(false);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dot-Matrix Print Calibration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Positions of every field are estimated and will drift from your actual pre-printed
          stationery until calibrated. Print the{" "}
          <Link href="/settings/print-test" className="text-primary hover:underline">
            calibration test sheet
          </Link>
          , hold it against the real form, and nudge these values until the marks line up.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Offset X (mm)</span>
          <input
            type="number"
            step="0.5"
            value={offsetX}
            onChange={(e) => setOffsetX(e.target.valueAsNumber || 0)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Offset Y (mm)</span>
          <input
            type="number"
            step="0.5"
            value={offsetY}
            onChange={(e) => setOffsetY(e.target.valueAsNumber || 0)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Font Size (pt)</span>
          <input
            type="number"
            step="0.5"
            min="4"
            value={fontSize}
            onChange={(e) => setFontSize(e.target.valueAsNumber || 0)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Item Row Height (mm)</span>
          <input
            type="number"
            step="0.5"
            min="1"
            value={rowHeight}
            onChange={(e) => setRowHeight(e.target.valueAsNumber || 0)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Calibration"}
        </button>
        <Link
          href="/settings/print-test"
          target="_blank"
          className="rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-muted"
        >
          Print Test Sheet
        </Link>
      </div>

      {isConfirmOpen && (
        <ConfirmModal
          title="Save Calibration?"
          message="Save these calibration offsets? They apply to every dot-matrix invoice printed from now on."
          confirmLabel={isPending ? "Saving..." : "Confirm"}
          isPending={isPending}
          onConfirm={handleConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </form>
  );
}
