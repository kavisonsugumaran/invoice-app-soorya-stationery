import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getCurrentUser } from "@/lib/dal";
import { createUser, setUserActive, changeOwnPassword } from "./users";

vi.mock("@/lib/dal", () => ({
  getCurrentUser: vi.fn(),
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

async function createTestUserWithPassword(password: string, role: "ADMIN" | "USER" = "USER") {
  return prisma.user.create({
    data: {
      username: `test-${role.toLowerCase()}-${Date.now()}-${Math.random()}`,
      name: `Test ${role}`,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("createUser", () => {
  it("rejects a non-admin caller", async () => {
    const staff = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: staff.id,
      username: staff.username,
      name: staff.name,
      role: staff.role,
    });

    const result = await createUser({
      username: "newstaff",
      name: "New Staff",
      password: "password123",
      role: "USER",
    });

    expect(result).toEqual({ success: false, error: "Admins only." });
  });

  it("allows an admin to create a new user", async () => {
    const admin = await createTestUser("ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });

    const result = await createUser({
      username: "newstaff",
      name: "New Staff",
      password: "password123",
      role: "USER",
    });

    expect(result.success).toBe(true);
  });
});

describe("setUserActive", () => {
  it("refuses to let an admin deactivate their own account", async () => {
    const admin = await createTestUser("ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });

    const result = await setUserActive(admin.id, false);

    expect(result).toEqual({
      success: false,
      error: "You cannot deactivate your own account.",
    });

    const stillActive = await prisma.user.findUnique({ where: { id: admin.id } });
    expect(stillActive?.isActive).toBe(true);
  });

  it("allows an admin to deactivate a different user", async () => {
    const admin = await createTestUser("ADMIN");
    const staff = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });

    const result = await setUserActive(staff.id, false);

    expect(result).toEqual({ success: true });
    const updated = await prisma.user.findUnique({ where: { id: staff.id } });
    expect(updated?.isActive).toBe(false);
  });
});

describe("changeOwnPassword", () => {
  it("rejects when not authenticated", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const result = await changeOwnPassword({
      currentPassword: "whatever",
      newPassword: "newpassword123",
    });

    expect(result).toEqual({ success: false, error: "Please sign in." });
  });

  it("rejects when the current password is wrong", async () => {
    const staff = await createTestUserWithPassword("correct-password");
    mockedGetCurrentUser.mockResolvedValue({
      id: staff.id,
      username: staff.username,
      name: staff.name,
      role: staff.role,
    });

    const result = await changeOwnPassword({
      currentPassword: "wrong-password",
      newPassword: "newpassword123",
    });

    expect(result).toEqual({ success: false, error: "Current password is incorrect." });
  });

  it("lets a Staff (non-admin) user change their own password — self-service, no role restriction", async () => {
    const staff = await createTestUserWithPassword("correct-password", "USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: staff.id,
      username: staff.username,
      name: staff.name,
      role: staff.role,
    });

    const result = await changeOwnPassword({
      currentPassword: "correct-password",
      newPassword: "newpassword123",
    });

    expect(result).toEqual({ success: true });

    const updated = await prisma.user.findUnique({ where: { id: staff.id } });
    const newPasswordWorks = await bcrypt.compare("newpassword123", updated!.passwordHash);
    expect(newPasswordWorks).toBe(true);
  });

  it("rejects a new password shorter than 8 characters", async () => {
    const staff = await createTestUserWithPassword("correct-password");
    mockedGetCurrentUser.mockResolvedValue({
      id: staff.id,
      username: staff.username,
      name: staff.name,
      role: staff.role,
    });

    const result = await changeOwnPassword({
      currentPassword: "correct-password",
      newPassword: "short",
    });

    expect(result).toEqual({
      success: false,
      error: "Password must be at least 8 characters.",
    });
  });
});
