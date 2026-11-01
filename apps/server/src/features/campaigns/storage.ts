import type {
  Campaign,
  CampaignRevision,
  DeliveryClaim,
} from "@fadeloop/contracts/campaign";
import { measuredQueries, type QueryObserver } from "../../common/database";

export interface ActiveCampaignWithRevision {
  campaign: Campaign;
  revision: CampaignRevision;
}

export function createCampaignStore(db: D1Database, observer?: QueryObserver) {
  const query = measuredQueries(observer);

  return {
    /**
     * Find active published campaign and its latest revision for a given account & post/reel.
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
        r_confirmation_button_enabled: number | null;
        r_confirmation_button_text: string | null;
        r_confirmation_prompt_text: string | null;
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
              r.confirmation_button_enabled AS r_confirmation_button_enabled,
              r.confirmation_button_text AS r_confirmation_button_text,
              r.confirmation_prompt_text AS r_confirmation_prompt_text,
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
          confirmationButtonEnabled: row.r_confirmation_button_enabled === 1,
          confirmationButtonText: row.r_confirmation_button_text || "Send Me",
          confirmationPromptText: row.r_confirmation_prompt_text ?? undefined,
          createdAt: row.r_created_at,
        },
      };
    },

    /**
     * Atomically claim a comment for private reply delivery.
     * Guaranteed idempotent by unique index on (account_id, comment_id).
     * Returns true if claimed successfully, false if already claimed.
     */
    async claimDelivery(claim: DeliveryClaim): Promise<boolean> {
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
        return true;
      } catch (err: unknown) {
        // D1 throws on UNIQUE constraint violation
        if (
          err instanceof Error &&
          (err.message.includes("UNIQUE") || err.message.includes("constraint"))
        ) {
          return false;
        }
        throw err;
      }
    },

    /**
     * List campaigns for a workspace with cursor pagination and latest revision.
     * Uses idx_campaigns_workspace (workspace_id, updated_at DESC) for bounded reads.
     */
    async listCampaigns(
      workspaceId: string,
      limit = 20,
      cursorUpdatedAt?: number,
    ): Promise<ActiveCampaignWithRevision[]> {
      const boundedLimit = Math.min(Math.max(1, limit), 50);
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
        r_confirmation_button_enabled: number | null;
        r_confirmation_button_text: string | null;
        r_confirmation_prompt_text: string | null;
        r_created_at: number;
      }>(
        "campaigns.list_workspace",
        cursorUpdatedAt
          ? db
              .prepare(
                `SELECT
                  c.id AS c_id, c.workspace_id AS c_workspace_id, c.account_id AS c_account_id,
                  c.media_id AS c_media_id, c.status AS c_status, c.created_at AS c_created_at,
                  c.updated_at AS c_updated_at,
                  r.id AS r_id, r.match_mode AS r_match_mode, r.keywords_json AS r_keywords_json,
                  r.reply_template AS r_reply_template, r.resource_url AS r_resource_url,
                  r.confirmation_button_enabled AS r_confirmation_button_enabled,
                  r.confirmation_button_text AS r_confirmation_button_text,
                  r.confirmation_prompt_text AS r_confirmation_prompt_text,
                  r.created_at AS r_created_at
                FROM campaigns c
                JOIN campaign_revisions r ON r.id = (
                  SELECT id FROM campaign_revisions
                  WHERE campaign_id = c.id
                  ORDER BY created_at DESC LIMIT 1
                )
                WHERE c.workspace_id = ? AND c.updated_at < ?
                ORDER BY c.updated_at DESC
                LIMIT ?`,
              )
              .bind(workspaceId, cursorUpdatedAt, boundedLimit)
          : db
              .prepare(
                `SELECT
                  c.id AS c_id, c.workspace_id AS c_workspace_id, c.account_id AS c_account_id,
                  c.media_id AS c_media_id, c.status AS c_status, c.created_at AS c_created_at,
                  c.updated_at AS c_updated_at,
                  r.id AS r_id, r.match_mode AS r_match_mode, r.keywords_json AS r_keywords_json,
                  r.reply_template AS r_reply_template, r.resource_url AS r_resource_url,
                  r.confirmation_button_enabled AS r_confirmation_button_enabled,
                  r.confirmation_button_text AS r_confirmation_button_text,
                  r.confirmation_prompt_text AS r_confirmation_prompt_text,
                  r.created_at AS r_created_at
                FROM campaigns c
                JOIN campaign_revisions r ON r.id = (
                  SELECT id FROM campaign_revisions
                  WHERE campaign_id = c.id
                  ORDER BY created_at DESC LIMIT 1
                )
                WHERE c.workspace_id = ?
                ORDER BY c.updated_at DESC
                LIMIT ?`,
              )
              .bind(workspaceId, boundedLimit),
      );

      return rows.map((row) => {
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
            confirmationButtonEnabled: row.r_confirmation_button_enabled === 1,
            confirmationButtonText: row.r_confirmation_button_text || "Send Me",
            confirmationPromptText: row.r_confirmation_prompt_text ?? undefined,
            createdAt: row.r_created_at,
          },
        };
      });
    },

    /**
     * Create a campaign with an initial revision in an atomic batch.
     */
    async createCampaign(input: {
      id: string;
      workspaceId: string;
      accountId: string;
      mediaId: string;
      status: "published" | "paused";
      revision: {
        id: string;
        matchMode: "exact_keyword" | "any_comment";
        keywords: string[];
        replyTemplate: string;
        resourceUrl?: string | null | undefined;
        confirmationButtonEnabled?: boolean | undefined;
        confirmationButtonText?: string | undefined;
        confirmationPromptText?: string | null | undefined;
      };
      now: number;
    }): Promise<ActiveCampaignWithRevision> {
      const keywordsJson = JSON.stringify(input.revision.keywords);
      const btnEnabled =
        input.revision.confirmationButtonEnabled === false ? 0 : 1;
      const btnText =
        input.revision.confirmationButtonText?.trim() || "Send Me";
      const promptText = input.revision.confirmationPromptText?.trim() ?? null;

      await db.batch([
        db
          .prepare(
            `INSERT INTO campaigns (id, workspace_id, account_id, media_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            input.id,
            input.workspaceId,
            input.accountId,
            input.mediaId,
            input.status,
            input.now,
            input.now,
          ),
        db
          .prepare(
            `INSERT INTO campaign_revisions (
              id, campaign_id, match_mode, keywords_json, reply_template, resource_url,
              confirmation_button_enabled, confirmation_button_text, confirmation_prompt_text, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            input.revision.id,
            input.id,
            input.revision.matchMode,
            keywordsJson,
            input.revision.replyTemplate,
            input.revision.resourceUrl ?? null,
            btnEnabled,
            btnText,
            promptText,
            input.now,
          ),
      ]);

      return {
        campaign: {
          id: input.id,
          workspaceId: input.workspaceId,
          accountId: input.accountId,
          mediaId: input.mediaId,
          status: input.status,
          createdAt: input.now,
          updatedAt: input.now,
        },
        revision: {
          id: input.revision.id,
          campaignId: input.id,
          matchMode: input.revision.matchMode,
          keywords: input.revision.keywords,
          replyTemplate: input.revision.replyTemplate,
          resourceUrl: input.revision.resourceUrl ?? null,
          confirmationButtonEnabled: btnEnabled === 1,
          confirmationButtonText: btnText,
          confirmationPromptText: promptText ?? undefined,
          createdAt: input.now,
        },
      };
    },

    /**
     * Update campaign status (published <-> paused).
     */
    async updateStatus(
      campaignId: string,
      workspaceId: string,
      status: "published" | "paused",
      now: number,
    ): Promise<boolean> {
      const result = await db
        .prepare(
          `UPDATE campaigns SET status = ?, updated_at = ?
           WHERE id = ? AND workspace_id = ?`,
        )
        .bind(status, now, campaignId, workspaceId)
        .run();
      return (result.meta.changes ?? 0) > 0;
    },

    /**
     * List recent delivery outcomes for dashboard auditing with bounded cursor pagination.
     * Uses idx_delivery_outcomes_workspace (workspace_id, occurred_at DESC).
     */
    async listDeliveries(
      workspaceId: string,
      limit = 25,
      cursorOccurredAt?: number,
    ) {
      const boundedLimit = Math.min(Math.max(1, limit), 50);
      return query<{
        id: string;
        action_key: string;
        account_id: string;
        status: "sent" | "retryable" | "failed" | "unknown";
        provider_message_id: string | null;
        error_code: string | null;
        attempt_count: number;
        occurred_at: number;
      }>(
        "deliveries.list_workspace",
        cursorOccurredAt
          ? db
              .prepare(
                `SELECT id, action_key, account_id, status, provider_message_id, error_code, attempt_count, occurred_at
                 FROM delivery_outcomes
                 WHERE workspace_id = ? AND occurred_at < ?
                 ORDER BY occurred_at DESC
                 LIMIT ?`,
              )
              .bind(workspaceId, cursorOccurredAt, boundedLimit)
          : db
              .prepare(
                `SELECT id, action_key, account_id, status, provider_message_id, error_code, attempt_count, occurred_at
                 FROM delivery_outcomes
                 WHERE workspace_id = ?
                 ORDER BY occurred_at DESC
                 LIMIT ?`,
              )
              .bind(workspaceId, boundedLimit),
      );
    },

    /**
     * Record a delivery outcome for auditing, DLQ tracking, and dashboard history.
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
