import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "olympus_session";

// Paths that don't require auth
const PUBLIC_PREFIXES = ["/login", "/api/auth", "/_next", "/favicon.ico"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get(SESSION_COOKIE);
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Not logged in — redirect to login (unless already on a public path)
  if (!session && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in — redirect away from /login
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
