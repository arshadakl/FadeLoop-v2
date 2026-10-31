import type { OAuthStateStore } from "@fadeloop/worker-common/meta/oauth-state";
import { measuredQueries, type QueryObserver } from "../../common/database";

export interface OwnerSession {
  sessionDigest: string;
  workspaceId: string;
  ownerId: string;
  expiresAt: number;
}

export function createOwnerStore(db: D1Database, observer?: QueryObserver) {
  const query = measuredQueries(observer);
  return {
    async findWorkspaceForOwner(ownerId: string) {
      const rows = await query<{ id: string }>(
        "owner.workspace_find",
        db
          .prepare("SELECT id FROM workspaces WHERE owner_id = ?")
          .bind(ownerId),
      );
      return rows[0] ?? null;
    },
    async createSession(input: {
      digest: string;
      workspaceId: string;
      now: number;
      expiresAt: number;
    }): Promise<void> {
      await query(
        "owner.session_create",
        db
          .prepare(
            "INSERT INTO owner_sessions (digest, workspace_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
          )
          .bind(input.digest, input.workspaceId, input.now, input.expiresAt),
      );
    },
    async findSession(
      digest: string,
      now: number,
    ): Promise<OwnerSession | null> {
      const rows = await query<{
        workspace_id: string;
        owner_id: string;
        expires_at: number;
      }>(
        "owner.session_find",
        db
          .prepare(
            "SELECT s.workspace_id, w.owner_id, s.expires_at FROM owner_sessions s JOIN workspaces w ON w.id = s.workspace_id WHERE s.digest = ? AND s.expires_at > ?",
          )
          .bind(digest, now),
      );
      const row = rows[0];
      return row
        ? {
            sessionDigest: digest,
            workspaceId: row.workspace_id,
            ownerId: row.owner_id,
            expiresAt: row.expires_at,
          }
        : null;
    },
    async revokeSession(digest: string): Promise<void> {
      await query(
        "owner.session_revoke",
        db.prepare("DELETE FROM owner_sessions WHERE digest = ?").bind(digest),
      );
    },
    async createOAuthState(
      record: { digest: string; ownerSessionId: string; expiresAt: number },
      now: number,
    ): Promise<boolean> {
      const rows = await query<{ digest: string }>(
        "oauth.state_create",
        db
          .prepare(
            "INSERT INTO oauth_states (digest, session_digest, created_at, expires_at) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM owner_sessions WHERE digest = ? AND expires_at > ?) RETURNING digest",
          )
          .bind(
            record.digest,
            record.ownerSessionId,
            now,
            record.expiresAt,
            record.ownerSessionId,
            now,
          ),
      );
      return rows.length === 1;
    },
    oauthState: {
      async consume(input: {
        digest: string;
        ownerSessionId: string;
        now: number;
      }): Promise<boolean> {
        const rows = await query<{ digest: string }>(
          "oauth.state_consume",
          db
            .prepare(
              "DELETE FROM oauth_states WHERE digest = ? AND session_digest = ? AND expires_at > ? AND EXISTS (SELECT 1 FROM owner_sessions WHERE digest = ? AND expires_at > ?) RETURNING digest",
            )
            .bind(
              input.digest,
              input.ownerSessionId,
              input.now,
              input.ownerSessionId,
              input.now,
            ),
        );
        return rows.length === 1;
      },
    } satisfies OAuthStateStore,
  };
}
