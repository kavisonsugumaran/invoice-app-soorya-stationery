import { redirect } from "next/navigation";
import DotMatrixCalibrationForm from "@/components/settings/DotMatrixCalibrationForm";
import { getBusinessSettings } from "@/lib/settings";
import { verifySession } from "@/lib/dal";

export default async function SettingsPage() {
  const currentUser = await verifySession();
  if (currentUser.role !== "ADMIN") {
    redirect("/");
  }

  const business = await getBusinessSettings();

  const initial = {
    dmOffsetXMm: business?.dmOffsetXMm ?? 0,
    dmOffsetYMm: business?.dmOffsetYMm ?? 0,
    dmFontSizePt: business?.dmFontSizePt ?? 10,
    dmItemRowMm: business?.dmItemRowMm ?? 6,
  };

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6">
      <DotMatrixCalibrationForm initial={initial} />
    </div>
  );
}
