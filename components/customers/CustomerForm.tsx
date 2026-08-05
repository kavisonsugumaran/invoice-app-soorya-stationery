"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer,
  updateCustomer,
  type CustomerFormInput,
} from "@/app/actions/customers";
import { tinError, TIN_LENGTH } from "@/lib/validation";
import { PHONE_LENGTH } from "@/lib/phone-format";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

type ExistingCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
};

type CustomerFormProps =
  | { mode: "create" }
  | { mode: "edit"; customer: ExistingCustomer };

export default function CustomerForm(props: CustomerFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const initial = props.mode === "edit" ? props.customer : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [taxIdError, setTaxIdError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const taxIdValidationError = tinError(taxId);
    setTaxIdError(taxIdValidationError);
    if (taxIdValidationError) {
      return;
    }

    setIsConfirmOpen(true);
  }

  function handleConfirm() {
    const input: CustomerFormInput = { name, phone, email, address, taxId };

    startTransition(async () => {
      if (props.mode === "create") {
        const result = await createCustomer(input);
        if (result.success) {
          router.push(`/customers/${result.id}`);
        } else {
          setError(result.error);
          setIsConfirmOpen(false);
        }
      } else {
        const result = await updateCustomer(props.customer.id, input);
        if (result.success) {
          showToast("Changes saved.");
          setIsConfirmOpen(false);
          router.refresh();
        } else {
          setError(result.error);
          setIsConfirmOpen(false);
        }
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      <h1 className="text-xl font-semibold text-foreground">
        {props.mode === "create" ? "New Customer" : "Customer Details"}
      </h1>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="customer-name">
          Name*
        </label>
        <input
          id="customer-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="customer-phone">
          Phone
        </label>
        <input
          id="customer-phone"
          type="text"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, PHONE_LENGTH))}
          maxLength={PHONE_LENGTH}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="customer-email">
          Email
        </label>
        <input
          id="customer-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="customer-address">
          Address
        </label>
        <input
          id="customer-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="customer-tax-id">
          TIN (Taxpayer Identification No.)
        </label>
        <input
          id="customer-tax-id"
          type="text"
          inputMode="numeric"
          value={taxId}
          onChange={(e) => {
            setTaxId(e.target.value.replace(/\D/g, "").slice(0, TIN_LENGTH));
            setTaxIdError(null);
          }}
          onBlur={() => setTaxIdError(tinError(taxId))}
          maxLength={TIN_LENGTH}
          aria-invalid={taxIdError ? true : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        {taxIdError && (
          <span role="alert" className="text-xs text-danger">
            {taxIdError}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving..." : props.mode === "create" ? "Create Customer" : "Save Changes"}
      </button>

      {isConfirmOpen && (
        <ConfirmModal
          title={props.mode === "create" ? "Create Customer?" : "Save Changes?"}
          message={
            props.mode === "create"
              ? `Create a new customer record for "${name}"?`
              : "Save these changes to the customer's details?"
          }
          confirmLabel={isPending ? "Saving..." : "Confirm"}
          isPending={isPending}
          onConfirm={handleConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </form>
  );
}
