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
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!isRecord(value))
      throw new MetaOAuthError("invalid_response", response.status);
    return value;
  } catch {
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
  return value.access_token;
}

function expiryFrom(value: Record<string, unknown>): number {
  if (
    typeof value.expires_in !== "number" ||
    !Number.isSafeInteger(value.expires_in) ||
    value.expires_in <= 0
  )
    throw new MetaOAuthError("invalid_response");
  return value.expires_in;
}

export function createInstagramOAuthClient(
  config: OAuthConfiguration,
  fetcher: Fetcher = fetch,
) {
  checkConfiguration(config);

  async function request(
    url: URL,
    init: RequestInit = {},
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetcher(url.toString(), {
        ...init,
        redirect: "error",
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
        client_id: config.appId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: instagramScopes.join(","),
        state,
      }).toString();
      return url.toString();
    },
    async exchangeCode(code: string) {
      if (!code || code.length > 8192) throw new Error("Invalid OAuth code");
      const body = new URLSearchParams({
        client_id: config.appId,
        client_secret: config.appSecret,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
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
      if (
        !(typeof identity === "string" && /^\d+$/.test(identity)) &&
        !(
          typeof identity === "number" &&
          Number.isSafeInteger(identity) &&
          identity > 0
        )
      )
        throw new MetaOAuthError("invalid_response");
      return { accessToken: tokenFrom(value), userId: String(identity) };
    },
    async exchangeLongLivedToken(shortToken: string) {
      if (!shortToken || shortToken.length > 16_384)
        throw new Error("Invalid OAuth token");
      const url = new URL("https://graph.instagram.com/access_token");
      url.search = new URLSearchParams({
        grant_type: "ig_exchange_token",
        client_secret: config.appSecret,
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
