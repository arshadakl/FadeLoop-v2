import {
  getInstagramAccountWebhookSubscriptions,
  subscribeInstagramAccountToWebhooks,
} from "@fadeloop/worker-common/meta/webhook-subscription";
import { apiError } from "../../common/http";
import { authenticateOwner } from "../owner/session";
import { createAccountStore, listAccounts } from "./storage";

export interface AccountRouteEnvironment {
  DB: D1Database;
  TOKEN_ENCRYPTION_KEY: string;
  META_GRAPH_VERSION?: string | undefined;
}

export async function handleAccounts(
  request: Request,
  db: D1Database,
  now: number,
): Promise<Response> {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);
  const session = await authenticateOwner(request, db, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);
  const after = new URL(request.url).searchParams.get("after") ?? "";
  if (after.length > 1024) return apiError("INVALID_REQUEST", 400);
  return Response.json(
    { accounts: await listAccounts(db, session.workspaceId, after) },
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
