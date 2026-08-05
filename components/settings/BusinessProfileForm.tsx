"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import {
  updateBusinessProfile,
  uploadBusinessLogo,
  removeBusinessLogo,
  type BusinessProfileInput,
} from "@/app/actions/settings";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

export default function BusinessProfileForm({
  initial,
}: {
  initial: BusinessProfileInput & { logoUrl: string | null };
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [businessName, setBusinessName] = useState(initial.businessName);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [email, setEmail] = useState(initial.email);
  const [taxId, setTaxId] = useState(initial.taxId);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);

  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [logoError, setLogoError] = useState<string | null>(null);
  const [isLogoPending, startLogoTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsConfirmOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await updateBusinessProfile({ businessName, address, phone, whatsapp, email, taxId });
      if (result.success) {
        showToast("Changes saved.");
        setIsConfirmOpen(false);
        router.refresh();
      } else {
        setError(result.error);
        setIsConfirmOpen(false);
      }
    });
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);

    const formData = new FormData();
    formData.set("logo", file);

    startLogoTransition(async () => {
      const result = await uploadBusinessLogo(formData);
      if (result.success) {
        setLogoUrl(result.logoUrl);
        router.refresh();
      } else {
        setLogoError(result.error);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleRemoveLogo() {
    setLogoError(null);
    startLogoTransition(async () => {
      const result = await removeBusinessLogo();
      if (result.success) {
        setLogoUrl(null);
        router.refresh();
      } else {
        setLogoError(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-foreground">Business Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This information is used across invoices and the app.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Business logo" className="h-full w-full object-contain" />
          ) : (
            <ImagePlus size={22} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLogoPending}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
            >
              {isLogoPending ? "Uploading..." : logoUrl ? "Change Logo" : "Upload Logo"}
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={isLogoPending}
                className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-surface-muted disabled:opacity-50"
              >
                <X size={12} />
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleLogoChange}
            className="hidden"
          />
          <span className="text-xs text-muted-foreground">PNG, JPEG, or WebP. Max 2MB.</span>
          {logoError && (
            <p role="alert" className="text-xs text-danger">
              {logoError}
            </p>
          )}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Business Name</span>
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Address</span>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Phone</span>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">WhatsApp</span>
          <input
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">TIN</span>
          <input
            type="text"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="9 digits"
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {isConfirmOpen && (
        <ConfirmModal
          title="Save Profile?"
          message="Save these changes to the business profile? This affects how the business appears on every invoice going forward."
          confirmLabel={isPending ? "Saving..." : "Confirm"}
          isPending={isPending}
          onConfirm={handleConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </form>
  );
}
