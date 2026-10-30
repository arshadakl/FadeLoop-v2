import type { OwnerSession } from "./storage";
import { createOwnerStore } from "./storage";

const prodCookieName = "__Host-fadeloop-session";
const localCookieName = "fadeloop-session";
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
  const pairs = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  const matched = pairs.filter(
    (pair) =>
      pair.startsWith(`${prodCookieName}=`) ||
      pair.startsWith(`${localCookieName}=`),
  );
  if (matched.length !== 1) return null;
  const target = matched[0];
  if (!target) return null;
  const prefix = target.startsWith(`${prodCookieName}=`)
    ? `${prodCookieName}=`
    : `${localCookieName}=`;
  const token = target.slice(prefix.length);
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

export function sessionCookie(
  token: string,
  maxAgeSeconds: number,
  isSecure = true,
): string {
  if (
    !tokenPattern.test(token) ||
    !Number.isSafeInteger(maxAgeSeconds) ||
    maxAgeSeconds < 0
  )
    throw new Error("Invalid session cookie");
  const name = isSecure ? prodCookieName : localCookieName;
  const secureFlag = isSecure ? "; Secure" : "";
  return `${name}=${token}; Path=/; HttpOnly${secureFlag}; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(isSecure = true): string {
  const name = isSecure ? prodCookieName : localCookieName;
  const secureFlag = isSecure ? "; Secure" : "";
  return `${name}=; Path=/; HttpOnly${secureFlag}; SameSite=Lax; Max-Age=0`;
}
