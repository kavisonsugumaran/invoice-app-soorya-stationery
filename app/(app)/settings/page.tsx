import DotMatrixCalibrationForm from "@/components/settings/DotMatrixCalibrationForm";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";
import { getBusinessSettings } from "@/lib/settings";
import { verifySession } from "@/lib/dal";

export default async function SettingsPage() {
  const currentUser = await verifySession();
  const isAdmin = currentUser.role === "ADMIN";

  const business = isAdmin ? await getBusinessSettings() : null;

  const initial = {
    dmOffsetXMm: business?.dmOffsetXMm ?? 0,
    dmOffsetYMm: business?.dmOffsetYMm ?? 0,
    dmFontSizePt: business?.dmFontSizePt ?? 10,
    dmItemRowMm: business?.dmItemRowMm ?? 6,
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8 sm:px-6">
      <ChangePasswordForm />
      {isAdmin && <DotMatrixCalibrationForm initial={initial} />}
    </div>
  );
}
