import DotMatrixCalibrationForm from "@/components/settings/DotMatrixCalibrationForm";
import BusinessProfileForm from "@/components/settings/BusinessProfileForm";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";
import { getBusinessSettings } from "@/lib/settings";
import { verifySession } from "@/lib/dal";

export default async function SettingsPage() {
  const currentUser = await verifySession();
  const isAdmin = currentUser.role === "ADMIN";

  const business = isAdmin ? await getBusinessSettings() : null;

  const calibrationInitial = {
    dmOffsetXMm: business?.dmOffsetXMm ?? 0,
    dmOffsetYMm: business?.dmOffsetYMm ?? 0,
    dmFontSizePt: business?.dmFontSizePt ?? 10,
    dmItemRowMm: business?.dmItemRowMm ?? 6,
    dmScaleY: business?.dmScaleY ?? 1,
    dmScaleX: business?.dmScaleX ?? 1,
  };

  const profileInitial = {
    businessName: business?.businessName ?? "",
    address: business?.address ?? "",
    phone: business?.phone ?? "",
    whatsapp: business?.whatsapp ?? "",
    email: business?.email ?? "",
    taxId: business?.taxId ?? "",
    logoUrl: business?.logoUrl ?? null,
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8 sm:px-6">
      <ChangePasswordForm />
      {isAdmin && (
        <>
          <BusinessProfileForm initial={profileInitial} />
          <DotMatrixCalibrationForm initial={calibrationInitial} />
        </>
      )}
    </div>
  );
}
