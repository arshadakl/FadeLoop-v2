import type {
  Campaign,
  CampaignRevision,
  DeliveryClaim,
} from "@fadeloop/contracts/campaign";
import {
  measuredQueries,
  type QueryObserver,
} from "@fadeloop/worker-common/database";

export interface ActiveCampaignWithRevision {
  campaign: Campaign;
  revision: CampaignRevision;
}

export interface ConnectedAccountData {
  accountId: string;
  workspaceId: string;
  tokenCiphertext: string;
  tokenExpiresAt: number;
}

export type ClaimResult =
  | { status: "claimed" }
  | { status: "already_settled" }
  | { status: "retryable" };

export function createConsumerStore(db: D1Database, observer?: QueryObserver) {
  const query = measuredQueries(observer);

  return {
    /**
     * Resolves an account's encrypted token and validity.
     * Uses idx_instagram_accounts_workspace for bounded lookup.
     */
    async findConnectedAccount(
      accountId: string,
    ): Promise<ConnectedAccountData | null> {
      const rows = await query<{
        account_id: string;
        workspace_id: string;
        token_ciphertext: string | null;
        token_expires_at: number | null;
      }>(
        "accounts.find_connected",
        db
          .prepare(
            `SELECT account_id, workspace_id, token_ciphertext, token_expires_at
             FROM instagram_accounts
             WHERE account_id = ? AND status = 'connected'`,
          )
          .bind(accountId),
      );

      const row = rows[0];
      if (!row?.token_ciphertext || !row.token_expires_at) return null;

      return {
        accountId: row.account_id,
        workspaceId: row.workspace_id,
        tokenCiphertext: row.token_ciphertext,
        tokenExpiresAt: row.token_expires_at,
      };
    },

    /**
     * Finds the active published campaign and latest revision for a post/reel.
     * Uses idx_campaigns_published_media for bounded rows_read = 1.
     */
    async findActiveCampaignForMedia(
      accountId: string,
      mediaId: string,
    ): Promise<ActiveCampaignWithRevision | null> {
      const rows = await query<{
        c_id: string;
        c_workspace_id: string;
        c_account_id: string;
        c_media_id: string;
        c_status: "published" | "paused";
        c_created_at: number;
        c_updated_at: number;
        r_id: string;
        r_match_mode: "exact_keyword" | "any_comment";
        r_keywords_json: string;
        r_reply_template: string;
        r_resource_url: string | null;
        r_created_at: number;
      }>(
        "campaigns.find_active_for_media",
        db
          .prepare(
            `SELECT
              c.id AS c_id, c.workspace_id AS c_workspace_id, c.account_id AS c_account_id,
              c.media_id AS c_media_id, c.status AS c_status, c.created_at AS c_created_at,
              c.updated_at AS c_updated_at,
              r.id AS r_id, r.match_mode AS r_match_mode, r.keywords_json AS r_keywords_json,
              r.reply_template AS r_reply_template, r.resource_url AS r_resource_url,
              r.created_at AS r_created_at
            FROM campaigns c
            JOIN campaign_revisions r ON r.campaign_id = c.id
            WHERE c.account_id = ? AND c.media_id = ? AND c.status = 'published'
            ORDER BY r.created_at DESC
            LIMIT 1`,
          )
          .bind(accountId, mediaId),
      );

      const row = rows[0];
      if (!row) return null;

      let keywords: string[] = [];
      try {
        keywords = JSON.parse(row.r_keywords_json);
      } catch {
        keywords = [];
      }

      return {
        campaign: {
          id: row.c_id,
          workspaceId: row.c_workspace_id,
          accountId: row.c_account_id,
          mediaId: row.c_media_id,
          status: row.c_status,
          createdAt: row.c_created_at,
          updatedAt: row.c_updated_at,
        },
        revision: {
          id: row.r_id,
          campaignId: row.c_id,
          matchMode: row.r_match_mode,
          keywords,
          replyTemplate: row.r_reply_template,
          resourceUrl: row.r_resource_url,
          createdAt: row.r_created_at,
        },
      };
    },

    /**
     * Atomically claims a comment for delivery.
     * Unique constraint on (account_id, comment_id) guarantees exactly one delivery.
     * If claim exists and this is a redelivery (attemptCount > 1), verifies if previous attempt was retryable.
     */
    async claimDelivery(
      claim: DeliveryClaim,
      attemptCount = 1,
    ): Promise<ClaimResult> {
      try {
        await query(
          "deliveries.claim_insert",
          db
            .prepare(
              `INSERT INTO delivery_claims (
                action_key, workspace_id, account_id, comment_id, media_id,
                campaign_id, revision_id, claimed_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              claim.actionKey,
              claim.workspaceId,
              claim.accountId,
              claim.commentId,
              claim.mediaId,
              claim.campaignId,
              claim.revisionId,
              claim.claimedAt,
            ),
        );
        return { status: "claimed" };
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          (err.message.includes("UNIQUE") || err.message.includes("constraint"))
        ) {
          // If this is a redelivery from queue retries, check if previous outcome was retryable
          if (attemptCount > 1) {
            const outcomes = await query<{ status: string }>(
              "deliveries.check_retryable",
              db
                .prepare(
                  `SELECT status FROM delivery_outcomes
                   WHERE action_key = ?
                   ORDER BY occurred_at DESC, attempt_count DESC
                   LIMIT 1`,
                )
                .bind(claim.actionKey),
            );
            const latest = outcomes[0];
            // Retry if explicitly retryable OR if prior attempt crashed before writing an outcome
            if (!latest || latest.status === "retryable") {
              return { status: "retryable" };
            }
          }
          return { status: "already_settled" };
        }
        throw err;
      }
    },

    /**
     * Persists final or transient delivery outcome for auditing and DLQ tracking.
     */
    async recordOutcome(input: {
      id: string;
      actionKey: string;
      workspaceId: string;
      accountId: string;
      status: "sent" | "retryable" | "failed" | "unknown";
      providerMessageId?: string;
      errorCode?: string;
      attemptCount: number;
      occurredAt: number;
    }): Promise<void> {
      await query(
        "deliveries.outcome_insert",
        db
          .prepare(
            `INSERT INTO delivery_outcomes (
              id, action_key, workspace_id, account_id, status,
              provider_message_id, error_code, attempt_count, occurred_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            input.id,
            input.actionKey,
            input.workspaceId,
            input.accountId,
            input.status,
            input.providerMessageId ?? null,
            input.errorCode ?? null,
            input.attemptCount,
            input.occurredAt,
          ),
      );
    },
  };
}
