import { cookies } from "next/headers";
import type { AuthSession } from "./types";

const SESSION_COOKIE = "olympus_session";

/** Read and decode the session cookie (server-side only). */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE);
    if (!cookie?.value) return null;
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    return JSON.parse(decoded) as AuthSession;
  } catch {
    return null;
  }
}

/** Build the GitHub OAuth authorization URL. */
export function buildGithubOAuthUrl(): string {
  const clientId = process.env.GITHUB_CLIENT_ID ?? "";
  const params = new URLSearchParams({ client_id: clientId, scope: "read:user" });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/** Check whether a given GitHub login is on the allowlist (if configured). */
export function isAllowedUser(login: string): boolean {
  const list = process.env.ALLOWED_GITHUB_USERS;
  if (!list || list.trim() === "") return true; // Open to all authenticated users
  return list.split(",").map((u) => u.trim()).includes(login);
}

/** Check whether a given GitHub login has admin privileges. */
export function isAdminUser(login: string): boolean {
  const list = process.env.ADMIN_GITHUB_USERS ?? "";
  return list.split(",").map((u) => u.trim()).includes(login);
}

/** Serialize a session object to a base64 cookie value. */
export function serializeSession(session: AuthSession): string {
  return Buffer.from(JSON.stringify(session)).toString("base64");
}
