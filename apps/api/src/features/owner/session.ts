import type { OwnerSession } from "./storage";
import { createOwnerStore } from "./storage";

const cookieName = "__Host-fadeloop-session";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export async function sessionDigest(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`fadeloop:session:v1:${token}`),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function readSessionToken(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.startsWith(`${cookieName}=`));
  if (values.length !== 1) return null;
  const token = values[0]?.slice(cookieName.length + 1) ?? "";
  return tokenPattern.test(token) ? token : null;
}

export async function authenticateOwner(
  request: Request,
  db: D1Database,
  now: number,
): Promise<OwnerSession | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  return createOwnerStore(db).findSession(await sessionDigest(token), now);
}

export function hasTrustedOrigin(request: Request, appOrigin: string): boolean {
  try {
    const configured = new URL(appOrigin);
    const safeProtocol =
      configured.protocol === "https:" ||
      (configured.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(configured.hostname));
    return (
      safeProtocol &&
      configured.origin === appOrigin &&
      request.headers.get("origin") === appOrigin
    );
  } catch {
    return false;
  }
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  if (
    !tokenPattern.test(token) ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds < 0
  )
    throw new Error("Invalid session cookie");
  return `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
