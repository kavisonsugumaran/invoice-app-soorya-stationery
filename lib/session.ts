import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "session";

// Sliding idle timeout + absolute cap (standard enterprise session pattern):
// the session extends on every active request, but never beyond the
// absolute ceiling below, regardless of activity — an active shift doesn't
// get logged out mid-use, but a forgotten-open or stolen session still dies
// within a day.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const ABSOLUTE_SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours max from login, regardless of activity

function encodedSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set.");
  }
  return new TextEncoder().encode(secret);
}

type SessionPayload = {
  userId: string;
  /** ISO timestamp of the original login — never changes; anchors the absolute cap. */
  sessionStart: string;
};

function computeExpiry(sessionStart: Date): Date {
  const idleExpiry = new Date(Date.now() + IDLE_TIMEOUT_MS);
  const absoluteExpiry = new Date(sessionStart.getTime() + ABSOLUTE_SESSION_MS);
  return idleExpiry < absoluteExpiry ? idleExpiry : absoluteExpiry;
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires,
    sameSite: "lax" as const,
    path: "/",
  };
}

async function encrypt(payload: SessionPayload, expiresAt: Date) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(encodedSecret());
}

export async function decrypt(session: string | undefined): Promise<SessionPayload | null> {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedSecret(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.sessionStart !== "string") {
      return null;
    }
    return { userId: payload.userId, sessionStart: payload.sessionStart };
  } catch {
    // Covers both a malformed token and a naturally-expired one (jwtVerify
    // enforces `exp` itself) — either way, treat as "no session."
    return null;
  }
}

export async function createSession(userId: string) {
  const sessionStart = new Date();
  const expiresAt = computeExpiry(sessionStart);
  const session = await encrypt({ userId, sessionStart: sessionStart.toISOString() }, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session, sessionCookieOptions(expiresAt));
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

/**
 * Slides the idle-timeout window forward on activity, capped at the
 * absolute session lifetime anchored to the original login (`sessionStart`).
 * Called from proxy.ts on every request so it captures all activity, not
 * just mutations. Returns the new signed cookie value + expiry to set on
 * the response, or null once the absolute cap has been reached.
 */
export async function renewSession(
  payload: SessionPayload
): Promise<{ value: string; expires: Date } | null> {
  const sessionStart = new Date(payload.sessionStart);
  const expiresAt = computeExpiry(sessionStart);
  if (expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const value = await encrypt({ userId: payload.userId, sessionStart: payload.sessionStart }, expiresAt);
  return { value, expires: expiresAt };
}
