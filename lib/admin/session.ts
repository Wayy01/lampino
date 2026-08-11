// Stateless admin session: an HMAC-signed, expiring payload in an httpOnly
// cookie. No DB hit per request; rotating ADMIN_SESSION_SECRET logs everyone out.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE = "lampino-admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // one week

export type AdminSession = {
  userId: number;
  username: string;
  role: string;
  expiresAt: number; // unix ms
};

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("ADMIN_SESSION_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: AdminSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): AdminSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as AdminSession;
    if (typeof session.userId !== "number" || session.expiresAt < Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function createAdminSession(user: {
  id: number;
  username: string;
  role: string;
}): Promise<void> {
  const session: AdminSession = {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
  };
  const store = await cookies();
  store.set(COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  return token ? decode(token) : null;
}

/** Guard for admin pages and server actions: redirects to the login screen. */
export async function requireAdmin(lang: string = "ro"): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect(`/admin/${lang}/login`);
  return session;
}
