"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateSmallBillCalibration,
  type SmallBillCalibrationInput,
} from "@/app/actions/settings";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

export default function SmallBillCalibrationForm({
  initial,
}: {
  initial: SmallBillCalibrationInput;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [offsetX, setOffsetX] = useState(initial.smallBillOffsetXMm);
  const [offsetY, setOffsetY] = useState(initial.smallBillOffsetYMm);
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
      const result = await updateSmallBillCalibration({
        smallBillOffsetXMm: offsetX,
        smallBillOffsetYMm: offsetY,
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
        <h1 className="text-xl font-semibold text-foreground">Small Bill Print Calibration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Small bills print onto blank 5.5in x 5.5in stock on the Jollymark printer — a much
          simpler setup than the dot-matrix stationery, since nothing is pre-printed. If the
          printed bill sits a little off-center on the physical paper, nudge these two values (a
          flat page-margin adjustment) and print again.
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
      </div>

      {isConfirmOpen && (
        <ConfirmModal
          title="Save Calibration?"
          message="Save these calibration offsets? They apply to every small bill printed from now on."
          confirmLabel={isPending ? "Saving..." : "Confirm"}
          isPending={isPending}
          onConfirm={handleConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </form>
  );
}
