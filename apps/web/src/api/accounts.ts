import { getJSON } from "./client";

export interface AccountMetadata {
  account_id: string;
  status: "connected" | "disconnected";
  token_expires_at: number | null;
}

export interface AccountsResponse {
  accounts: AccountMetadata[];
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
