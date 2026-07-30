import "server-only";

import { getCurrentUser, type CurrentUser } from "@/lib/dal";

type GuardResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; error: string };

/** Server Action guard — any authenticated (active) user. Never throws/redirects. */
export async function requireUser(): Promise<GuardResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };
  return { ok: true, user };
}

/** Server Action guard — authenticated AND role === "ADMIN". */
export async function requireAdmin(): Promise<GuardResult> {
  const result = await requireUser();
  if (!result.ok) return result;
  if (result.user.role !== "ADMIN") return { ok: false, error: "Admins only." };
  return result;
}
