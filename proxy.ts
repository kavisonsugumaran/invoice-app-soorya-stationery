import { NextRequest, NextResponse } from "next/server";
import { decrypt, renewSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_ROUTES = ["/login"];

// Optimistic check only — reads the session cookie, no DB call. This is a UX
// redirect layer, not the security boundary: it can silently miss Server
// Action POST requests depending on matcher, so every Server Action also
// verifies auth itself via requireUser()/requireAdmin() (see lib/auth-guard.ts).
export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.includes(path);

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const payload = await decrypt(cookie);
  const isAuthenticated = Boolean(payload?.userId);

  if (!isPublicRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isPublicRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
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
