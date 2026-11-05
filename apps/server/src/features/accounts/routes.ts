import {
  getInstagramAccountWebhookSubscriptions,
  subscribeInstagramAccountToWebhooks,
} from "@fadeloop/worker-common/meta/webhook-subscription";
import { apiError } from "../../common/http";
import { authenticateOwner } from "../owner/session";
import { createAccountStore, listAccounts } from "./storage";

export interface AccountRouteEnvironment {
  DB: D1Database;
  TOKEN_ENCRYPTION_KEY?: string | undefined;
  META_GRAPH_VERSION?: string | undefined;
}

export async function handleAccounts(
  request: Request,
  env: AccountRouteEnvironment,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);
  const session = await authenticateOwner(request, env.DB, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);
  const after = new URL(request.url).searchParams.get("after") ?? "";
  if (after.length > 1024) return apiError("INVALID_REQUEST", 400);

  const accounts = await listAccounts(env.DB, session.workspaceId, after);
  const accountStore = env.TOKEN_ENCRYPTION_KEY
    ? createAccountStore(env.DB, env.TOKEN_ENCRYPTION_KEY)
    : null;
  const graphVersion = env.META_GRAPH_VERSION || "v23.0";

  // Auto-enrich profile details (username, name, profile image) if not yet cached
  if (accountStore) {
    for (const acc of accounts) {
      if (!acc.username && acc.status === "connected") {
        try {
          const creds = await accountStore.readCredential(
            session.workspaceId,
            acc.account_id,
            now,
          );
          if (creds?.accessToken) {
            const res = await fetcher(
              `https://graph.instagram.com/${graphVersion}/me?fields=id,username,name,profile_picture_url&access_token=${encodeURIComponent(creds.accessToken)}`,
              { signal: AbortSignal.timeout(5000) },
            );
            if (res.ok) {
              const data = (await res.json()) as {
                username?: string;
                name?: string;
                profile_picture_url?: string;
              };
              if (data.username || data.name || data.profile_picture_url) {
                await accountStore.updateProfile(
                  session.workspaceId,
                  acc.account_id,
                  {
                    username: data.username ?? null,
                    name: data.name ?? null,
                    profilePictureUrl: data.profile_picture_url ?? null,
                  },
                );
                acc.username = data.username ?? null;
                acc.name = data.name ?? null;
                acc.profile_picture_url = data.profile_picture_url ?? null;
              }
            }
          }
        } catch (err) {
          console.warn(
            `[Accounts] Could not auto-populate profile for ${acc.account_id}:`,
            err,
          );
        }
      }
    }
  }

  return Response.json(
    { accounts },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function handleDeleteAccount(
  request: Request,
  env: AccountRouteEnvironment,
  accountId: string,
  now: number,
): Promise<Response> {
  if (request.method !== "DELETE") return apiError("METHOD_NOT_ALLOWED", 405);
  const session = await authenticateOwner(request, env.DB, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);

  if (!env.TOKEN_ENCRYPTION_KEY) return apiError("SERVICE_UNAVAILABLE", 503);

  const accountStore = createAccountStore(env.DB, env.TOKEN_ENCRYPTION_KEY);
  const deleted = await accountStore.deleteAccount(
    session.workspaceId,
    accountId,
  );
  if (!deleted) {
    return apiError("ACCOUNT_NOT_FOUND", 404);
  }

  return Response.json(
    { ok: true, deleted: true, accountId },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function handleAccountWebhookSubscription(
  request: Request,
  env: AccountRouteEnvironment,
  accountId: string,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const session = await authenticateOwner(request, env.DB, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);
  if (!env.TOKEN_ENCRYPTION_KEY) return apiError("SERVICE_UNAVAILABLE", 503);

  const accountStore = createAccountStore(env.DB, env.TOKEN_ENCRYPTION_KEY);
  const creds = await accountStore.readCredential(
    session.workspaceId,
    accountId,
    now,
  );
  if (!creds) {
    return apiError("ACCOUNT_NOT_FOUND", 404);
  }

  const graphVersion = env.META_GRAPH_VERSION || "v23.0";

  if (request.method === "POST") {
    try {
      await subscribeInstagramAccountToWebhooks(
        accountId,
        creds.accessToken,
        graphVersion,
        fetcher,
      );
      const { subscribedFields } =
        await getInstagramAccountWebhookSubscriptions(
          accountId,
          creds.accessToken,
          graphVersion,
          fetcher,
        );
      return Response.json(
        { ok: true, subscribed: true, subscribedFields },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (err) {
      console.error(
        `Failed to subscribe account ${accountId} to webhooks:`,
        err,
      );
      return apiError("SUBSCRIPTION_FAILED", 502);
    }
  }

  if (request.method === "GET") {
    try {
      const { subscribedFields } =
        await getInstagramAccountWebhookSubscriptions(
          accountId,
          creds.accessToken,
          graphVersion,
          fetcher,
        );
      return Response.json(
        {
          ok: true,
          subscribed: subscribedFields.length > 0,
          subscribedFields,
        },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (err) {
      console.error(
        `Failed to read webhook subscriptions for account ${accountId}:`,
        err,
      );
      return apiError("GRAPH_API_ERROR", 502);
    }
  }

  return apiError("METHOD_NOT_ALLOWED", 405);
}
