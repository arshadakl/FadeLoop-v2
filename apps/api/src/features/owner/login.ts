import { loginInputSchema } from "@fadeloop/contracts/auth";
import { apiError, boundedJSON } from "../../common/http";
import { hasTrustedOrigin, sessionCookie, sessionDigest } from "./session";
import { createOwnerStore } from "./storage";
import {
  AuthProviderError,
  type SupabaseConfiguration,
  verifySupabasePassword,
} from "./supabase";

const sessionLifetimeSeconds = 3600;

export async function handleOwnerLogin(
  request: Request,
  input: {
    db: D1Database;
    appOrigin: string;
    provider: SupabaseConfiguration;
    limiter: RateLimit;
    now: number;
  },
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") return apiError("METHOD_NOT_ALLOWED", 405);
  if (!hasTrustedOrigin(request, input.appOrigin))
    return apiError("FORBIDDEN", 403);
  if (!(await input.limiter.limit({ key: "owner-password-login" })).success)
    return apiError("RATE_LIMITED", 429);
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  )
    return apiError("INVALID_REQUEST", 415);
  let body: unknown;
  try {
    body = await boundedJSON(request, 8192);
  } catch {
    return apiError("INVALID_REQUEST", 400);
  }
  const parsed = loginInputSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_REQUEST", 400);
  try {
    const ownerId = await verifySupabasePassword(
      input.provider,
      parsed.data.email,
      parsed.data.password,
      fetcher,
    );
    const store = createOwnerStore(input.db);
    const row = await store.findWorkspaceForOwner(ownerId);
    if (!row) return apiError("UNAUTHENTICATED", 401);
    const token = btoa(
      String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
    )
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    const expiresAt = input.now + sessionLifetimeSeconds * 1000;
    await store.createSession({
      digest: await sessionDigest(token),
      workspaceId: row.id,
      now: input.now,
      expiresAt,
    });
    const isSecure = new URL(input.appOrigin).protocol === "https:";
    return Response.json(
      { workspaceId: row.id, expiresAt },
      {
        headers: {
          "set-cookie": sessionCookie(token, sessionLifetimeSeconds, isSecure),
          "cache-control": "no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof AuthProviderError)
      return apiError(
        error.status === 429
          ? "RATE_LIMITED"
          : error.status === 401
            ? "UNAUTHENTICATED"
            : "AUTH_UNAVAILABLE",
        error.status,
      );
    return apiError("AUTH_UNAVAILABLE", 503);
  }
}
