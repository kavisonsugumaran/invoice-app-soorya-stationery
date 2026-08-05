import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getCurrentUser } from "@/lib/dal";
import { createCustomer, updateCustomer } from "./customers";

vi.mock("@/lib/dal", () => ({
  getCurrentUser: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

async function loginAsStaff() {
  const user = await prisma.user.create({
    data: {
      username: `test-user-${Date.now()}-${Math.random()}`,
      name: "Test User",
      role: "USER",
      passwordHash: "not-a-real-hash",
    },
  });
  mockedGetCurrentUser.mockResolvedValue({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("createCustomer", () => {
  it("stores the phone number as digits only, regardless of how it was typed", async () => {
    await loginAsStaff();

    const result = await createCustomer({
      name: "Kamal Perera",
      phone: "077-123 4567",
      email: "",
      address: "",
      taxId: "",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");

    const customer = await prisma.customer.findUnique({ where: { id: result.id } });
    expect(customer?.phone).toBe("0771234567");
  });

  it("detects a duplicate phone number even when typed with different formatting", async () => {
    await loginAsStaff();
    await prisma.customer.create({ data: { name: "Existing Customer", phone: "0771234567" } });

    const result = await createCustomer({
      name: "Someone Else",
      phone: "077 123 4567",
      email: "",
      address: "",
      taxId: "",
    });

    expect(result).toEqual({
      success: false,
      error: "A customer with this phone number already exists: Existing Customer.",
    });
  });
});

describe("updateCustomer", () => {
  it("normalizes the phone number on update too", async () => {
    await loginAsStaff();
    const customer = await prisma.customer.create({ data: { name: "Kamal Perera", phone: "0771234567" } });

    const result = await updateCustomer(customer.id, {
      name: "Kamal Perera",
      phone: "(077) 999 8888",
      email: "",
      address: "",
      taxId: "",
    });

    expect(result).toEqual({ success: true });
    const updated = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updated?.phone).toBe("0779998888");
  });
});
