import { NextRequest, NextResponse } from "next/server";
import { decrypt, renewSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const PUBLIC_ROUTES = ["/login"];

// Mostly an optimistic check — reads the session cookie, no DB call. This is
// a UX redirect layer, not the security boundary: it can silently miss
// Server Action POST requests depending on matcher, so every Server Action
// also verifies auth itself via requireUser()/requireAdmin() (see
// lib/auth-guard.ts), which — like page-level verifySession() — checks the
// live DB row (isActive, passwordChangedAt), not just the JWT.
//
// The one place this file does hit the DB is the /login bounce-away below,
// and it has to: a JWT can still have a valid signature/expiry for a
// session that's actually been invalidated server-side (account
// deactivated, or its password changed on another computer — see
// lib/dal.ts's getCurrentUser). Bouncing such a session away from /login on
// the JWT check alone would send it straight to a protected page that
// correctly rejects it via the DB-backed check and redirects back to
// /login — which this file would then bounce away from again, forever.
// Checking here too, and clearing the cookie when it fails, is what stops
// that loop; every other request keeps the cheap JWT-only check.
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.includes(path);

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = await decrypt(cookie);
  const isAuthenticated = Boolean(payload?.userId);

  if (!isPublicRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublicRoute && isAuthenticated && payload) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isActive: true, passwordChangedAt: true },
    });
    const stillValid =
      Boolean(user?.isActive) &&
      (!user!.passwordChangedAt || user!.passwordChangedAt <= new Date(payload.sessionStart));

    if (stillValid) {
      return NextResponse.redirect(new URL("/", req.nextUrl));
    }

    // Session looked valid by JWT alone but isn't really live anymore —
    // clear it and let /login render instead of bouncing away from it.
    const response = NextResponse.next();
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (!isAuthenticated || !payload) {
    return NextResponse.next();
  }

  // Slide the idle-timeout window forward on every authenticated request
  // (proxy runs on every navigation, so this captures browsing, not just
  // mutations), capped at the absolute session lifetime from lib/session.ts.
  const renewed = await renewSession(payload);
  if (!renewed) {
    // Absolute cap reached — force re-login even though the cookie was
    // technically still present.
    const redirectResponse = NextResponse.redirect(new URL("/login", req.nextUrl));
    redirectResponse.cookies.delete(SESSION_COOKIE);
    return redirectResponse;
  }

  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, renewed.value, sessionCookieOptions(renewed.expires));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|webp|svg|jpg|jpeg|gif|ico)$).*)",
  ],
};
