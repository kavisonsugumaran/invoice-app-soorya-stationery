"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { requireAdmin, requireUser } from "@/lib/auth-guard";
import { findUserByUsername } from "@/lib/users";
import { createSession } from "@/lib/session";

const MIN_PASSWORD_LENGTH = 8;

export type CreateUserInput = {
  username: string;
  name: string;
  password: string;
  role: Role;
};

export type CreateUserResult = { success: true; id: string } | { success: false; error: string };
export type ActionResult = { success: true } | { success: false; error: string };

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const username = input.username.trim();
  const name = input.name.trim();

  if (!username) return { success: false, error: "Username is required." };
  if (!name) return { success: false, error: "Name is required." };

  const passwordError = validatePassword(input.password);
  if (passwordError) return { success: false, error: passwordError };

  const existing = await findUserByUsername(username);
  if (existing) {
    return { success: false, error: `Username "${username}" is already taken.` };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    // Set from JS (not left to a schema default) — see schema.prisma's note
    // on passwordChangedAt about why a SQL-level default would be wrong here.
    data: { username, name, passwordHash, role: input.role, passwordChangedAt: new Date() },
  });

  return { success: true, id: user.id };
}

export async function setUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!isActive && userId === auth.user.id) {
    return { success: false, error: "You cannot deactivate your own account." };
  }

  try {
    await prisma.user.update({ where: { id: userId }, data: { isActive } });
    return { success: true };
  } catch {
    return { success: false, error: "Could not update user." };
  }
}

export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const passwordError = validatePassword(newPassword);
  if (passwordError) return { success: false, error: passwordError };

  const passwordHash = await bcrypt.hash(newPassword, 10);
  try {
    // passwordChangedAt logs out that user's other active sessions (any
    // other shop computer signed in as them) on their next request — see
    // lib/dal.ts's getCurrentUser(). Admin's own session is a different
    // account, so it's unaffected; no need to reissue anything here.
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Could not reset password." };
  }
}

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

// Self-service — any logged-in user (Admin or Staff) changing their OWN
// password. Unlike resetUserPassword (Admin acting on someone else, no old
// password needed), this requires the current password to verify it's really
// the account owner at the keyboard, not just whoever the session belongs to
// on a shared shop computer.
export async function changeOwnPassword(input: ChangePasswordInput): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const passwordError = validatePassword(input.newPassword);
  if (passwordError) return { success: false, error: passwordError };

  const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!user) return { success: false, error: "Could not change password." };

  const currentPasswordMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!currentPasswordMatches) {
    return { success: false, error: "Current password is incorrect." };
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  const changedAt = new Date();
  try {
    // passwordChangedAt logs out this account's other active sessions (e.g.
    // another shop computer left signed in) on their next request — see
    // lib/dal.ts's getCurrentUser(). That check compares against the
    // session's own start time, which for *this* session predates
    // changedAt too, so without reissuing a fresh cookie below the person
    // who just changed their own password would immediately get logged out
    // of their own session as well.
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: changedAt },
    });
    await createSession(user.id);
    return { success: true };
  } catch {
    return { success: false, error: "Could not change password." };
  }
}
