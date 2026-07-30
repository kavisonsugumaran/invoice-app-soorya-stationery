"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer,
  updateCustomer,
  type CustomerFormInput,
} from "@/app/actions/customers";

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
  const initial = props.mode === "edit" ? props.customer : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const input: CustomerFormInput = { name, phone, email, address, taxId };

    startTransition(async () => {
      if (props.mode === "create") {
        const result = await createCustomer(input);
        if (result.success) {
          router.push(`/customers/${result.id}`);
        } else {
          setError(result.error);
        }
      } else {
        const result = await updateCustomer(props.customer.id, input);
        if (result.success) {
          setSuccessMessage("Changes saved.");
          router.refresh();
        } else {
          setError(result.error);
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
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
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
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {successMessage && (
        <p role="status" className="text-sm text-success">
          {successMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving..." : props.mode === "create" ? "Create Customer" : "Save Changes"}
      </button>
    </form>
  );
}
