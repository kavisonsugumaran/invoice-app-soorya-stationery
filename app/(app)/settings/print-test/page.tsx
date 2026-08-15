import { redirect } from "next/navigation";
import DotMatrixCalibrationSheet from "@/components/invoice-print/DotMatrixCalibrationSheet";
import { getBusinessSettings } from "@/lib/settings";
import { verifySession } from "@/lib/dal";

export default async function PrintTestPage() {
  const currentUser = await verifySession();
  if (currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const business = await getBusinessSettings();

  const calibration = {
    dmOffsetXMm: business?.dmOffsetXMm ?? 0,
    dmOffsetYMm: business?.dmOffsetYMm ?? 0,
    dmFontSizePt: business?.dmFontSizePt ?? 10,
    dmItemRowMm: business?.dmItemRowMm ?? 6,
    dmScaleY: business?.dmScaleY ?? 1,
    dmScaleX: business?.dmScaleX ?? 1,
  };

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <DotMatrixCalibrationSheet calibration={calibration} />
    </div>
  );
}
