import { getJSON, sendJSON } from "./client";

export interface AccountMetadata {
  account_id: string;
  status: "connected" | "disconnected";
  token_expires_at: number | null;
  username?: string | null;
  name?: string | null;
  profile_picture_url?: string | null;
}

export interface AccountsResponse {
  accounts: AccountMetadata[];
}

export async function deleteAccount(
  accountId: string,
): Promise<{ ok: boolean; deleted: boolean; accountId: string }> {
  return sendJSON<{ ok: boolean; deleted: boolean; accountId: string }>(
    `/api/accounts/${encodeURIComponent(accountId)}`,
    "DELETE",
  );
}

export interface WebhookSubscriptionStatus {
  ok: boolean;
  subscribed: boolean;
  subscribedFields: string[];
}

export async function fetchAccountWebhookStatus(
  accountId: string,
  signal?: AbortSignal,
): Promise<WebhookSubscriptionStatus> {
  return getJSON<WebhookSubscriptionStatus>(
    `/api/accounts/${encodeURIComponent(accountId)}/webhooks`,
    signal,
  );
}

export async function subscribeAccountWebhooks(
  accountId: string,
): Promise<WebhookSubscriptionStatus> {
  return sendJSON<WebhookSubscriptionStatus>(
    `/api/accounts/${encodeURIComponent(accountId)}/webhooks`,
    "POST",
    {},
  );
}

export async function fetchAccounts(
  signal?: AbortSignal,
): Promise<AccountsResponse> {
  return getJSON<AccountsResponse>("/api/accounts", signal);
}

export async function initiateInstagramOAuthConnect(
  signal?: AbortSignal,
): Promise<string> {
  const data = await getJSON<{ authorizeUrl: string }>(
    "/api/auth/instagram/connect",
    signal,
  );
  return data.authorizeUrl;
}

export interface InstagramMediaItem {
  id: string;
  caption?: string | undefined;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string | undefined;
  thumbnail_url?: string | undefined;
  permalink: string;
  timestamp: string;
}

export interface MediaResponse {
  media: InstagramMediaItem[];
}

export async function fetchAccountMedia(
  accountId: string,
  signal?: AbortSignal,
): Promise<MediaResponse> {
  return getJSON<MediaResponse>(
    `/api/accounts/${encodeURIComponent(accountId)}/media`,
    signal,
  );
}
