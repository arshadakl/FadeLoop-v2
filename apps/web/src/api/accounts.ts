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
