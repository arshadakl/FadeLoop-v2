import { createInstagramOAuthClient } from "@fadeloop/worker-common/meta/oauth-client";
import { createTokenVault } from "@fadeloop/worker-common/meta/token-vault";
import type { ServerEnvironment } from "../../environment";
import { createAccountStore } from "./storage";

export interface MaintenanceResult {
  checked: number;
  refreshed: number;
  failed: number;
}

export async function refreshExpiringTokens(
  env: ServerEnvironment,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
): Promise<MaintenanceResult> {
  const result: MaintenanceResult = { checked: 0, refreshed: 0, failed: 0 };
  if (!env.DB || !env.TOKEN_ENCRYPTION_KEY || !env.META_APP_SECRET) {
    return result;
  }

  // Refresh tokens that expire within the next 15 days
  const FIFTEEN_DAYS_MS = 15 * 86_400 * 1000;
  const threshold = now + FIFTEEN_DAYS_MS;

  const accountStore = createAccountStore(env.DB, env.TOKEN_ENCRYPTION_KEY);
  const expiring = await accountStore.findExpiring(threshold, 10);
  result.checked = expiring.length;

  if (expiring.length === 0) {
    return result;
  }

  const client = createInstagramOAuthClient(
    {
      appId: env.META_APP_ID || "123",
      appSecret: env.META_APP_SECRET,
      redirectUri:
        env.META_REDIRECT_URI || "https://fadeloop.example/auth/callback",
    },
    fetcher,
  );
  const vault = await createTokenVault(env.TOKEN_ENCRYPTION_KEY);

  for (const account of expiring) {
    if (!account.token_ciphertext) continue;

    try {
      const currentToken = await vault.open(
        account.token_ciphertext,
        JSON.stringify([account.workspace_id, account.account_id]),
      );

      const refreshed = await client.refreshToken(currentToken);
      const newExpiresAt = now + refreshed.expiresIn * 1000;

      await accountStore.updateRefreshedToken({
        workspaceId: account.workspace_id,
        accountId: account.account_id,
        accessToken: refreshed.accessToken,
        expiresAt: newExpiresAt,
        now,
      });

      result.refreshed++;
    } catch (err) {
      result.failed++;
      console.error(
        `Failed to refresh token for Instagram account ${account.account_id}:`,
        err instanceof Error ? err.message : "unknown_error",
      );
    }
  }

  return result;
}
