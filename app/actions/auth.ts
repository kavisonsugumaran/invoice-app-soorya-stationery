"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

export type LoginInput = { username: string; password: string };
export type LoginResult = { success: true } | { success: false; error: string };

const GENERIC_LOGIN_ERROR = "Invalid username or password.";

export async function login(input: LoginInput): Promise<LoginResult> {
  const username = input.username.trim();
  if (!username || !input.password) {
    return { success: false, error: "Enter your username and password." };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }

  await createSession(user.id);
  return { success: true };
}

export async function logout(): Promise<{ success: true }> {
  await deleteSession();
  return { success: true };
}
