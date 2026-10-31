import { instagramScopes } from "./config";

type OAuthConfiguration = {
  appId: string;
  appSecret: string;
  redirectUri: string;
};
type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class MetaOAuthError extends Error {
  constructor(
    readonly reason:
      | "request_failed"
      | "provider_rejected"
      | "invalid_response",
    readonly status?: number,
  ) {
    super(`Instagram OAuth ${reason}`);
    this.name = "MetaOAuthError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkConfiguration(config: OAuthConfiguration): void {
  try {
    const uri = new URL(config.redirectUri);
    if (
      !/^\d+$/.test(config.appId) ||
      !config.appSecret ||
      uri.protocol !== "https:" ||
      uri.username ||
      uri.password ||
      uri.search ||
      uri.hash
    )
      throw new Error("Invalid configuration");
  } catch {
    throw new Error("Invalid Instagram OAuth configuration");
  }
}

async function readObject(
  response: Response,
): Promise<Record<string, unknown>> {
  if (!response.body)
    throw new MetaOAuthError("invalid_response", response.status);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 32_768) {
        await reader.cancel();
        throw new MetaOAuthError("invalid_response", response.status);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const rawText = new TextDecoder().decode(bytes);
    const value: unknown = JSON.parse(rawText);
    if (!isRecord(value))
      throw new MetaOAuthError("invalid_response", response.status);
    const match = /"user_id"\s*:\s*"?(\d+)"?/.exec(rawText);
    if (match?.[1]) {
      value.user_id = match[1];
    }
    return value;
  } catch (err) {
    if (err instanceof MetaOAuthError) throw err;
    throw new MetaOAuthError("invalid_response", response.status);
  } finally {
    reader.releaseLock();
  }
}

function tokenFrom(value: Record<string, unknown>): string {
  if (
    typeof value.access_token !== "string" ||
    !value.access_token ||
    value.access_token.length > 16_384
  )
    throw new MetaOAuthError("invalid_response");
  return value.access_token.trim();
}

function expiryFrom(value: Record<string, unknown>): number {
  const exp = value.expires_in;
  if (typeof exp === "number" && Number.isFinite(exp) && exp > 0) {
    return Math.floor(exp);
  }
  if (typeof exp === "string" && /^\d+$/.test(exp.trim())) {
    const parsed = Number(exp.trim());
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  throw new MetaOAuthError("invalid_response");
}

export function createInstagramOAuthClient(
  config: OAuthConfiguration,
  fetcher: Fetcher = fetch,
) {
  const sanitizedConfig: OAuthConfiguration = {
    appId: config.appId.trim(),
    appSecret: config.appSecret.trim(),
    redirectUri: config.redirectUri.trim(),
  };
  checkConfiguration(sanitizedConfig);

  async function request(
    url: URL,
    init: RequestInit = {},
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetcher(url.toString(), {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new MetaOAuthError("request_failed");
    }
    if (!response.ok) {
      // Do not expose provider bodies, request URLs, authorization codes, or tokens.
      try {
        await response.body?.cancel();
      } catch {
        /* Cleanup must not replace the sanitized provider error. */
      }
      throw new MetaOAuthError("provider_rejected", response.status);
    }
    const value = await readObject(response);
    if (value.error)
      throw new MetaOAuthError("provider_rejected", response.status);
    return value;
  }

  return {
    authorizeUrl(state: string): string {
      if (!/^[A-Za-z0-9_-]{43}$/.test(state))
        throw new Error("Invalid OAuth state");
      const url = new URL("https://www.instagram.com/oauth/authorize");
      url.search = new URLSearchParams({
        client_id: sanitizedConfig.appId,
        redirect_uri: sanitizedConfig.redirectUri,
        response_type: "code",
        scope: instagramScopes.join(","),
        state,
      }).toString();
      return url.toString();
    },
    async exchangeCode(code: string) {
      if (!code || code.length > 8192) throw new Error("Invalid OAuth code");
      const body = new URLSearchParams({
        client_id: sanitizedConfig.appId,
        client_secret: sanitizedConfig.appSecret,
        grant_type: "authorization_code",
        redirect_uri: sanitizedConfig.redirectUri,
        code,
      });
      const value = await request(
        new URL("https://api.instagram.com/oauth/access_token"),
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
        },
      );
      const identity = value.user_id;
      let userId: string;
      if (typeof identity === "string" && /^\d+$/.test(identity)) {
        userId = identity;
      } else if (
        typeof identity === "number" &&
        Number.isFinite(identity) &&
        identity > 0
      ) {
        userId = String(BigInt(Math.floor(identity)));
      } else {
        throw new MetaOAuthError("invalid_response");
      }
      return { accessToken: tokenFrom(value), userId };
    },
    async exchangeLongLivedToken(shortToken: string) {
      if (!shortToken || shortToken.length > 16_384)
        throw new Error("Invalid OAuth token");
      const url = new URL("https://graph.instagram.com/access_token");
      url.search = new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: sanitizedConfig.appSecret,
        access_token: shortToken,
      }).toString();
      const value = await request(url);
      return { accessToken: tokenFrom(value), expiresIn: expiryFrom(value) };
    },
    async refreshToken(token: string) {
      if (!token || token.length > 16_384)
        throw new Error("Invalid OAuth token");
      const url = new URL("https://graph.instagram.com/refresh_access_token");
      url.search = new URLSearchParams({
        grant_type: "ig_refresh_token",
        access_token: token,
      }).toString();
      const value = await request(url);
      return { accessToken: tokenFrom(value), expiresIn: expiryFrom(value) };
    },
  };
}
