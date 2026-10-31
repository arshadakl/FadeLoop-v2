import {
  createInstagramOAuthClient,
  MetaOAuthError,
} from "@fadeloop/worker-common/meta/oauth-client";
import {
  consumeOAuthState,
  createOAuthAttempt,
} from "@fadeloop/worker-common/meta/oauth-state";
import { apiError } from "../../common/http";
import { authenticateOwner } from "../owner/session";
import { createOwnerStore } from "../owner/storage";
import { createAccountStore } from "./storage";

export interface OAuthRouteEnvironment {
  DB: D1Database;
  APP_ORIGIN: string;
  META_APP_ID: string;
  META_APP_SECRET: string;
  META_REDIRECT_URI: string;
  TOKEN_ENCRYPTION_KEY: string;
}

/**
 * Initiates the Instagram OAuth 2.0 flow.
 * - Authenticates the owner session
 * - Generates cryptographically secure state with 10-minute expiry
 * - Saves state tied to owner_sessions in D1 oauth_states
 * - Returns the Instagram authorization URL
 */
export async function handleInstagramConnect(
  request: Request,
  env: OAuthRouteEnvironment,
  now: number = Date.now(),
): Promise<Response> {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);

  const session = await authenticateOwner(request, env.DB, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);

  const client = createInstagramOAuthClient({
    appId: env.META_APP_ID,
    appSecret: env.META_APP_SECRET,
    redirectUri: env.META_REDIRECT_URI,
  });

  const ownerStore = createOwnerStore(env.DB);
  const attempt = await createOAuthAttempt(session.sessionDigest, now);

  const created = await ownerStore.createOAuthState(attempt.record, now);
  if (!created) return apiError("STATE_GENERATION_FAILED", 500);

  const authorizeUrl = client.authorizeUrl(attempt.state);

  return Response.json(
    { authorizeUrl },
    { headers: { "cache-control": "no-store" } },
  );
}

/**
 * Handles the Instagram OAuth 2.0 callback.
 * - Authenticates owner session
 * - Atomically consumes and deletes the one-time state from oauth_states
 * - Exchanges code for short-lived token and userId
 * - Exchanges short-lived token for 60-day long-lived token
 * - Encrypts token with AES-256-GCM via createAccountStore
 * - Upserts account into instagram_accounts
 * - Redirects back to frontend with success/error query param
 */
export async function handleInstagramCallback(
  request: Request,
  env: OAuthRouteEnvironment,
  fetcher: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<Response> {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);

  const session = await authenticateOwner(request, env.DB, now);
  if (!session) {
    // If not authenticated, redirect to login
    return Response.redirect(
      `${env.APP_ORIGIN}/login?error=unauthenticated`,
      302,
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorReason = url.searchParams.get("error_reason");

  if (error || errorReason) {
    return Response.redirect(
      `${env.APP_ORIGIN}/accounts?error=oauth_denied`,
      302,
    );
  }

  if (!code || !state) {
    return Response.redirect(
      `${env.APP_ORIGIN}/accounts?error=invalid_request`,
      302,
    );
  }

  const ownerStore = createOwnerStore(env.DB);

  // Atomically consume state (single use, prevents replay attacks)
  const validState = await consumeOAuthState(
    state,
    session.sessionDigest,
    now,
    ownerStore.oauthState,
  );

  if (!validState) {
    return Response.redirect(
      `${env.APP_ORIGIN}/accounts?error=state_expired`,
      302,
    );
  }

  try {
    const client = createInstagramOAuthClient(
      {
        appId: env.META_APP_ID,
        appSecret: env.META_APP_SECRET,
        redirectUri: env.META_REDIRECT_URI,
      },
      fetcher,
    );

    // 1. Exchange authorization code for short-lived token
    const shortLived = await client.exchangeCode(code);

    // 2. Exchange short-lived token for long-lived 60-day token
    const longLived = await client.exchangeLongLivedToken(
      shortLived.accessToken,
    );

    // Calculate expiry timestamp
    const expiresAt = now + longLived.expiresIn * 1000;

    // 3. Encrypt and store account in D1
    const accountStore = createAccountStore(env.DB, env.TOKEN_ENCRYPTION_KEY);
    const connected = await accountStore.connect({
      workspaceId: session.workspaceId,
      accountId: shortLived.userId,
      accessToken: longLived.accessToken,
      expiresAt,
      now,
    });

    if (!connected) {
      return Response.redirect(
        `${env.APP_ORIGIN}/accounts?error=connect_failed`,
        302,
      );
    }

    return Response.redirect(
      `${env.APP_ORIGIN}/accounts?connected=true&accountId=${encodeURIComponent(shortLived.userId)}`,
      302,
    );
  } catch (err) {
    console.error("Instagram OAuth exchange failed:", err);
    const reason =
      err instanceof MetaOAuthError ? err.reason : "exchange_failed";
    return Response.redirect(
      `${env.APP_ORIGIN}/accounts?error=${encodeURIComponent(reason)}`,
      302,
    );
  }
}
