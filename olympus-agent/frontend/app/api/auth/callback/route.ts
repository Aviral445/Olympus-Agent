import { NextRequest, NextResponse } from "next/server";
import { isAllowedUser, isAdminUser, serializeSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=oauth_denied", req.url));
  }

  // 1. Exchange code for GitHub access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  const token: string = tokenData.access_token;

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=token_exchange_failed", req.url));
  }

  // 2. Fetch authenticated GitHub user
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(new URL("/login?error=github_api_failed", req.url));
  }

  const user = await userRes.json();

  // 3. Allowlist check
  if (!isAllowedUser(user.login)) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  // 4. Build session
  const session = {
    login: user.login as string,
    name: (user.name as string) || (user.login as string),
    avatar: user.avatar_url as string,
    token,
    isAdmin: isAdminUser(user.login as string),
  };

  // 5. Set httpOnly session cookie and redirect home
  const response = NextResponse.redirect(new URL("/", req.url));
  response.cookies.set("olympus_session", serializeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
