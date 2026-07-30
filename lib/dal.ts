import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt, getSessionCookie } from "@/lib/session";

export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
};

/**
 * Re-fetches the live User row on every call (memoized per-request via
 * React.cache) instead of trusting role/isActive from the JWT — this is what
 * makes deactivating a user or changing their role take effect on their very
 * next request rather than only after the session cookie expires.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const payload = await decrypt(await getSessionCookie());
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, name: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) return null;

  return { id: user.id, username: user.username, name: user.name, role: user.role };
});

/** Page/layout-level guard — redirects to /login if not authenticated. */
export async function verifySession(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
