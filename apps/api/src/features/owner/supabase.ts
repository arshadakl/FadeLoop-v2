import { boundedJSON, isRecord } from "../../common/http";

export interface SupabaseConfiguration {
  url: string;
  publishableKey: string;
  ownerUserId: string;
}

export class AuthProviderError extends Error {
  constructor(readonly status: 401 | 429 | 503) {
    super("Owner authentication failed");
  }
}

export async function verifySupabasePassword(
  config: SupabaseConfiguration,
  email: string,
  password: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const origin = new URL(config.url);
  if (
    origin.protocol !== "https:" ||
    origin.origin !== config.url ||
    !config.publishableKey ||
    !config.ownerUserId
  )
    throw new AuthProviderError(503);
  let response: Response;
  try {
    response = await fetcher(
      `${config.url}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: {
          apikey: config.publishableKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      },
    );
  } catch {
    throw new AuthProviderError(503);
  }
  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {
      /* Preserve the sanitized failure. */
    }
    throw new AuthProviderError(
      response.status === 429 ? 429 : response.status >= 500 ? 503 : 401,
    );
  }
  let value: unknown;
  try {
    value = await boundedJSON(response, 65_536);
  } catch {
    throw new AuthProviderError(503);
  }
  if (
    !isRecord(value) ||
    !isRecord(value.user) ||
    typeof value.access_token !== "string" ||
    !value.access_token ||
    value.user.id !== config.ownerUserId ||
    typeof value.user.email_confirmed_at !== "string" ||
    !Number.isFinite(Date.parse(value.user.email_confirmed_at))
  )
    throw new AuthProviderError(401);
  if (
    Array.isArray(value.user.factors) &&
    value.user.factors.some(
      (factor: unknown) => isRecord(factor) && factor.status === "verified",
    )
  )
    throw new AuthProviderError(401);
  // Identity comes directly from the configured HTTPS auth server, not browser JWT claims.
  // Discard provider tokens; FadeLoop issues its own short, revocable D1 session.
  return config.ownerUserId;
}
