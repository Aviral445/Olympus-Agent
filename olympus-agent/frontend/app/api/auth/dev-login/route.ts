import { NextRequest, NextResponse } from "next/server";
import { serializeSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = {
    login: "Aviral445",
    name: "Aviral (Dev Owner)",
    avatar: "https://github.com/Aviral445.png",
    token: "dev_token_bypass",
    isAdmin: true,
  };

  const redirectUrl = new URL("/console", req.url);
  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set("olympus_session", serializeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    secure: false,
  });

  return response;
}
