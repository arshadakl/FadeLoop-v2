import { createTokenVault } from "@fadeloop/worker-common/meta/token-vault";
import { measuredQueries, type QueryObserver } from "../../common/database";

interface CredentialRow {
  generation: string;
  status: "connected" | "disconnected";
  token_ciphertext: string | null;
  token_expires_at: number | null;
}

function context(workspaceId: string, accountId: string): string {
  return JSON.stringify([workspaceId, accountId]);
}

export function listAccounts(
  db: D1Database,
  workspaceId: string,
  after = "",
  observer?: QueryObserver,
) {
  return measuredQueries(observer)<{
    account_id: string;
    status: string;
    token_expires_at: number | null;
  }>(
    "accounts.list",
    db
      .prepare(
        "SELECT account_id, status, token_expires_at FROM instagram_accounts WHERE workspace_id = ? AND account_id > ? ORDER BY account_id LIMIT 50",
      )
      .bind(workspaceId, after),
  );
}

export function createAccountStore(
  db: D1Database,
  encryptionKey: string,
  observer?: QueryObserver,
) {
  const query = measuredQueries(observer);
  return {
    async connect(input: {
      workspaceId: string;
      accountId: string;
      accessToken: string;
      expiresAt: number;
      now: number;
    }): Promise<boolean> {
      if (
        !Number.isSafeInteger(input.expiresAt) ||
        input.expiresAt <= input.now
      )
        throw new Error("Invalid token expiry");
      const vault = await createTokenVault(encryptionKey);
      const ciphertext = await vault.seal(
        input.accessToken,
        context(input.workspaceId, input.accountId),
      );
      const rows = await query<{ account_id: string }>(
        "accounts.connect",
        db
          .prepare(`INSERT INTO instagram_accounts (account_id, workspace_id, generation, status, token_ciphertext, token_expires_at, updated_at)
        VALUES (?, ?, ?, 'connected', ?, ?, ?)
        ON CONFLICT (account_id) DO UPDATE SET generation = excluded.generation, status = excluded.status,
        token_ciphertext = excluded.token_ciphertext, token_expires_at = excluded.token_expires_at, updated_at = excluded.updated_at
        WHERE instagram_accounts.workspace_id = excluded.workspace_id RETURNING account_id`)
          .bind(
            input.accountId,
            input.workspaceId,
            crypto.randomUUID(),
            ciphertext,
            input.expiresAt,
            input.now,
          ),
      );
      return rows.length === 1;
    },
    async readCredential(workspaceId: string, accountId: string, now: number) {
      const rows = await query<CredentialRow>(
        "accounts.credential",
        db
          .prepare(
            "SELECT generation, status, token_ciphertext, token_expires_at FROM instagram_accounts WHERE account_id = ? AND workspace_id = ?",
          )
          .bind(accountId, workspaceId),
      );
      const row = rows[0];
      if (
        row?.status !== "connected" ||
        !row.token_ciphertext ||
        !row.token_expires_at ||
        row.token_expires_at <= now
      )
        return null;
      const vault = await createTokenVault(encryptionKey);
      return {
        accessToken: await vault.open(
          row.token_ciphertext,
          context(workspaceId, accountId),
        ),
        generation: row.generation,
        expiresAt: row.token_expires_at,
      };
    },
    async disconnect(
      workspaceId: string,
      accountId: string,
      now: number,
    ): Promise<boolean> {
      const rows = await query<{ account_id: string }>(
        "accounts.disconnect",
        db
          .prepare(
            "UPDATE instagram_accounts SET status = 'disconnected', generation = ?, token_ciphertext = NULL, token_expires_at = NULL, updated_at = ? WHERE account_id = ? AND workspace_id = ? RETURNING account_id",
          )
          .bind(crypto.randomUUID(), now, accountId, workspaceId),
      );
      return rows.length === 1;
    },
    async list(workspaceId: string, after = "") {
      return listAccounts(db, workspaceId, after, observer);
    },
  };
}
