import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getCurrentUser } from "@/lib/dal";
import { updateBusinessProfile, uploadBusinessLogo, removeBusinessLogo } from "./settings";

vi.mock("@/lib/dal", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string) => ({ url: `https://blob.example.com/${pathname}` })),
  del: vi.fn(async () => undefined),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

async function createTestUser(role: "ADMIN" | "USER" = "USER") {
  return prisma.user.create({
    data: {
      username: `test-${role.toLowerCase()}-${Date.now()}-${Math.random()}`,
      name: `Test ${role}`,
      role,
      passwordHash: "not-a-real-hash",
    },
  });
}

async function loginAs(role: "ADMIN" | "USER") {
  const user = await createTestUser(role);
  mockedGetCurrentUser.mockResolvedValue({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
  return user;
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("updateBusinessProfile", () => {
  it("rejects a non-admin caller", async () => {
    await loginAs("USER");

    const result = await updateBusinessProfile({
      businessName: "Soorya Stationers",
      address: "",
      phone: "",
      whatsapp: "",
      email: "",
      taxId: "",
    });

    expect(result).toEqual({ success: false, error: "Admins only." });
  });

  it("rejects an empty business name", async () => {
    await loginAs("ADMIN");

    const result = await updateBusinessProfile({
      businessName: "   ",
      address: "",
      phone: "",
      whatsapp: "",
      email: "",
      taxId: "",
    });

    expect(result).toEqual({ success: false, error: "Business name is required." });
  });

  it("rejects an invalid email", async () => {
    await loginAs("ADMIN");

    const result = await updateBusinessProfile({
      businessName: "Soorya Stationers",
      address: "",
      phone: "",
      whatsapp: "",
      email: "not-an-email",
      taxId: "",
    });

    expect(result).toEqual({ success: false, error: "Enter a valid email address." });
  });

  it("rejects a TIN that isn't exactly 9 digits", async () => {
    await loginAs("ADMIN");

    const result = await updateBusinessProfile({
      businessName: "Soorya Stationers",
      address: "",
      phone: "",
      whatsapp: "",
      email: "",
      taxId: "123",
    });

    expect(result).toEqual({ success: false, error: "TIN must be exactly 9 digits." });
  });

  it("lets an admin save a valid profile, creating the row if missing", async () => {
    await loginAs("ADMIN");

    const result = await updateBusinessProfile({
      businessName: "Soorya Stationers",
      address: "Colombo 11",
      phone: "+94 11 2437926",
      whatsapp: "",
      email: "shop@example.com",
      taxId: "123456789",
    });

    expect(result).toEqual({ success: true });

    const saved = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    expect(saved).toMatchObject({
      businessName: "Soorya Stationers",
      address: "Colombo 11",
      phone: "+94 11 2437926",
      whatsapp: null,
      email: "shop@example.com",
      taxId: "123456789",
    });
  });
});

function makeImageFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("uploadBusinessLogo", () => {
  it("rejects a non-admin caller", async () => {
    await loginAs("USER");

    const formData = new FormData();
    formData.set("logo", makeImageFile("logo.png", "image/png", 100));

    const result = await uploadBusinessLogo(formData);

    expect(result).toEqual({ success: false, error: "Admins only." });
  });

  it("rejects a missing file", async () => {
    await loginAs("ADMIN");

    const result = await uploadBusinessLogo(new FormData());

    expect(result).toEqual({ success: false, error: "Choose an image file." });
  });

  it("rejects a disallowed file type", async () => {
    await loginAs("ADMIN");

    const formData = new FormData();
    formData.set("logo", makeImageFile("logo.svg", "image/svg+xml", 100));

    const result = await uploadBusinessLogo(formData);

    expect(result).toEqual({
      success: false,
      error: "Logo must be a PNG, JPEG, or WebP image.",
    });
  });

  it("rejects a file over 2MB", async () => {
    await loginAs("ADMIN");

    const formData = new FormData();
    formData.set("logo", makeImageFile("logo.png", "image/png", 3 * 1024 * 1024));

    const result = await uploadBusinessLogo(formData);

    expect(result).toEqual({ success: false, error: "Logo must be smaller than 2MB." });
  });

  it("lets an admin upload a valid logo", async () => {
    await loginAs("ADMIN");

    const formData = new FormData();
    formData.set("logo", makeImageFile("logo.png", "image/png", 1000));

    const result = await uploadBusinessLogo(formData);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.logoUrl).toContain("business-logo/logo.png");

    const saved = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    expect(saved?.logoUrl).toBe(result.logoUrl);
  });
});

describe("removeBusinessLogo", () => {
  it("rejects a non-admin caller", async () => {
    await loginAs("USER");

    const result = await removeBusinessLogo();

    expect(result).toEqual({ success: false, error: "Admins only." });
  });

  it("clears an existing logo", async () => {
    await loginAs("ADMIN");
    await prisma.businessSettings.create({
      data: { id: "default", businessName: "Soorya Stationers", logoUrl: "https://blob.example.com/old.png" },
    });

    const result = await removeBusinessLogo();

    expect(result).toEqual({ success: true });
    const saved = await prisma.businessSettings.findUnique({ where: { id: "default" } });
    expect(saved?.logoUrl).toBeNull();
  });
});
