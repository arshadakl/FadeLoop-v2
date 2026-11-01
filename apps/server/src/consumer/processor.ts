import type { AutomationEvent } from "@fadeloop/contracts/events";
import {
  isCommentWithinReplyWindow,
  matchComment,
} from "@fadeloop/domain/matching";
import type { QueryObserver } from "@fadeloop/worker-common/database";
import { sendInstagramPrivateReply } from "@fadeloop/worker-common/meta/private-reply-client";
import { createTokenVault } from "@fadeloop/worker-common/meta/token-vault";
import { createConsumerStore } from "./storage";

export interface ConsumerEnvironment {
  APP_ENV: string;
  DB?: D1Database;
  TOKEN_ENCRYPTION_KEY?: string;
  META_GRAPH_VERSION?: string;
}

/**
 * Builds the private reply message text from the template and optional resource URL.
 */
export function formatReplyText(
  template: string,
  resourceUrl?: string | null,
): string {
  const trimmed = template.trim();
  if (!resourceUrl) return trimmed;
  if (trimmed.includes(resourceUrl)) return trimmed;
  return `${trimmed}\n\n${resourceUrl.trim()}`;
}

/**
 * Processes a single queue message containing an AutomationEvent.
 *
 * Implements strict guardrails:
 * - Direct comment delivery (comment.created) & interactive 2-step opt-in (postback.received / message.received).
 * - 7-day eligibility window enforced for comment replies.
 * - Active published campaign and keyword match verified.
 * - Atomic D1 claim guarantees idempotent single delivery per comment / step.
 * - AES-GCM token decryption.
 * - Meta Graph API dispatch with bounded retries and no blind retries on unknown.
 */
export async function processQueueMessage(
  message: Message<AutomationEvent>,
  env: ConsumerEnvironment,
  fetcher: typeof fetch = fetch,
  now: number = Date.now(),
  observer?: QueryObserver,
): Promise<void> {
  const event = message.body;

  console.log(
    `[Consumer] Processing ${event.kind} event for account ${event.accountId}, key: ${event.providerEventKey}`,
  );

  // 1. Validate required environment bindings
  if (!env.DB || !env.TOKEN_ENCRYPTION_KEY || !env.META_GRAPH_VERSION) {
    console.error(
      "[Consumer] Missing required bindings (DB, TOKEN_ENCRYPTION_KEY, META_GRAPH_VERSION)",
    );
    message.retry({ delaySeconds: 60 });
    return;
  }

  const store = createConsumerStore(env.DB, observer);

  // =========================================================================
  // SCENARIO A: Comment Created (Step 1 or Direct Reply)
  // =========================================================================
  if (event.kind === "comment.created") {
    // Enforce Meta 7-day private reply window
    if (!isCommentWithinReplyWindow(event.occurredAt, now)) {
      console.info(
        `[Consumer] Comment ${event.commentId} is outside 7-day eligibility window; dropping.`,
      );
      message.ack();
      return;
    }

    // Look up active published campaign for this post/reel
    const active = await store.findActiveCampaignForMedia(
      event.accountId,
      event.mediaId,
    );
    if (!active) {
      console.info(
        `[Consumer] No active published campaign for account ${event.accountId} media ${event.mediaId}`,
      );
      message.ack();
      return;
    }

    // Test comment text matching
    if (!matchComment(event.text, active.revision)) {
      console.info(
        `[Consumer] Comment text "${event.text}" did not match keyword rules for campaign ${active.campaign.id}`,
      );
      message.ack();
      return;
    }

    // Look up connected Instagram account and verify token validity
    const account = await store.findConnectedAccount(event.accountId);
    if (!account) {
      console.warn(
        `[Consumer] Account ${event.accountId} is not connected or missing token.`,
      );
      message.ack();
      return;
    }

    if (account.tokenExpiresAt <= now) {
      console.warn(`[Consumer] Account ${event.accountId} token has expired.`);
      message.ack();
      return;
    }

    const isConfirmationEnabled =
      active.revision.confirmationButtonEnabled === true;
    const actionKey = `${event.accountId}:${event.commentId}`;

    // Atomic claim in D1: guarantees only 1 delivery per (account_id, comment_id)
    const claimResult = await store.claimDelivery(
      {
        actionKey,
        workspaceId: active.campaign.workspaceId,
        accountId: event.accountId,
        commentId: event.commentId,
        mediaId: event.mediaId,
        campaignId: active.campaign.id,
        revisionId: active.revision.id,
        claimedAt: now,
      },
      message.attempts,
    );

    if (claimResult.status === "already_settled") {
      console.info(`[Consumer] Action ${actionKey} already settled; skipping.`);
      message.ack();
      return;
    }

    // Decrypt account access token
    let accessToken: string;
    try {
      const vault = await createTokenVault(env.TOKEN_ENCRYPTION_KEY);
      accessToken = await vault.open(account.tokenCiphertext, event.accountId);
    } catch (err) {
      console.error("[Consumer] Failed to decrypt account token:", err);
      await store.recordOutcome({
        id: crypto.randomUUID(),
        actionKey,
        workspaceId: active.campaign.workspaceId,
        accountId: event.accountId,
        status: "failed",
        errorCode: "TOKEN_DECRYPT_FAIL",
        attemptCount: message.attempts,
        occurredAt: now,
      });
      message.ack();
      return;
    }

    // Dispatch message via Meta Graph API
    let result: Awaited<ReturnType<typeof sendInstagramPrivateReply>>;

    if (isConfirmationEnabled) {
      // Step 1: Send interactive Quick Reply "Send Me" button prompt
      const promptText =
        active.revision.confirmationPromptText?.trim() ||
        "Tap below to receive your link 👇";
      const buttonTitle = (
        active.revision.confirmationButtonText?.trim() || "Send Me"
      ).slice(0, 20);

      console.log(
        `[Consumer] Dispatching Step 1 interactive prompt ("${buttonTitle}") to comment ${event.commentId}`,
      );

      result = await sendInstagramPrivateReply(
        {
          graphVersion: env.META_GRAPH_VERSION,
          accountId: event.accountId,
          accessToken,
          commentId: event.commentId,
          text: promptText,
          quickReplies: [
            {
              content_type: "text",
              title: buttonTitle,
              payload: `step2:${active.campaign.id}:${event.commentId}`,
            },
          ],
        },
        fetcher,
      );
    } else {
      // Direct Reply mode: send promised resource directly
      const replyText = formatReplyText(
        active.revision.replyTemplate,
        active.revision.resourceUrl,
      );

      console.log(
        `[Consumer] Dispatching direct private reply to comment ${event.commentId}`,
      );

      result = await sendInstagramPrivateReply(
        {
          graphVersion: env.META_GRAPH_VERSION,
          accountId: event.accountId,
          accessToken,
          commentId: event.commentId,
          text: replyText,
        },
        fetcher,
      );
    }

    // Record outcome and settle queue message
    return settleOutcome(
      result,
      store,
      message,
      actionKey,
      active.campaign.workspaceId,
      event.accountId,
      now,
    );
  }

  // =========================================================================
  // SCENARIO B: User Clicked "Send Me" Quick Reply (Step 2 Resource Delivery)
  // =========================================================================
  if (
    (event.kind === "postback.received" || event.kind === "message.received") &&
    event.interactionPayload &&
    event.interactionPayload.startsWith("step2:") &&
    event.messagingUserId
  ) {
    const parts = event.interactionPayload.split(":");
    const campaignId = parts[1];
    const _originalCommentId = parts[2] || "unknown";

    if (!campaignId) {
      console.warn(
        "[Consumer] Malformed step2 payload:",
        event.interactionPayload,
      );
      message.ack();
      return;
    }

    console.log(
      `[Consumer] Processing Step 2 opt-in click from user ${event.messagingUserId} for campaign ${campaignId}`,
    );

    const active = await store.findActiveCampaignById(campaignId);
    if (!active || active.campaign.accountId !== event.accountId) {
      console.warn(
        `[Consumer] Campaign ${campaignId} not found or account mismatch; dropping.`,
      );
      message.ack();
      return;
    }

    const account = await store.findConnectedAccount(event.accountId);
    if (!account || account.tokenExpiresAt <= now) {
      console.warn(
        `[Consumer] Account ${event.accountId} is not connected or token expired.`,
      );
      message.ack();
      return;
    }

    // Step 2 atomic claim: keyed by recipient messagingUserId and campaign
    const actionKey = `${event.accountId}:${event.messagingUserId}:${campaignId}:step2`;
    const claimResult = await store.claimDelivery(
      {
        actionKey,
        workspaceId: active.campaign.workspaceId,
        accountId: event.accountId,
        commentId: `step2:${event.messagingUserId}:${campaignId}`,
        mediaId: active.campaign.mediaId,
        campaignId: active.campaign.id,
        revisionId: active.revision.id,
        claimedAt: now,
      },
      message.attempts,
    );

    if (claimResult.status === "already_settled") {
      console.info(
        `[Consumer] Step 2 already delivered for ${actionKey}; skipping.`,
      );
      message.ack();
      return;
    }

    // Decrypt account access token
    let accessToken: string;
    try {
      const vault = await createTokenVault(env.TOKEN_ENCRYPTION_KEY);
      accessToken = await vault.open(account.tokenCiphertext, event.accountId);
    } catch (err) {
      console.error(
        "[Consumer] Failed to decrypt account token for step 2:",
        err,
      );
      await store.recordOutcome({
        id: crypto.randomUUID(),
        actionKey,
        workspaceId: active.campaign.workspaceId,
        accountId: event.accountId,
        status: "failed",
        errorCode: "TOKEN_DECRYPT_FAIL",
        attemptCount: message.attempts,
        occurredAt: now,
      });
      message.ack();
      return;
    }

    // Send the promised resource in the active 24-hour interaction window
    const replyText = formatReplyText(
      active.revision.replyTemplate,
      active.revision.resourceUrl,
    );

    console.log(
      `[Consumer] Dispatching Step 2 resource payload to user ${event.messagingUserId}`,
    );

    const result = await sendInstagramPrivateReply(
      {
        graphVersion: env.META_GRAPH_VERSION,
        accountId: event.accountId,
        accessToken,
        messagingUserId: event.messagingUserId,
        text: replyText,
      },
      fetcher,
    );

    return settleOutcome(
      result,
      store,
      message,
      actionKey,
      active.campaign.workspaceId,
      event.accountId,
      now,
    );
  }

  // Any other unsupported event kind
  console.info(`[Consumer] Ignoring unsupported event kind: ${event.kind}`);
  message.ack();
}

/**
 * Handles outcome settlement, D1 recording, and queue backoff.
 */
async function settleOutcome(
  result: Awaited<ReturnType<typeof sendInstagramPrivateReply>>,
  store: ReturnType<typeof createConsumerStore>,
  message: Message<AutomationEvent>,
  actionKey: string,
  workspaceId: string,
  accountId: string,
  now: number,
): Promise<void> {
  if (result.status === "sent") {
    console.log(`[Consumer] Delivery successful: ${actionKey}`);
    await store.recordOutcome({
      id: crypto.randomUUID(),
      actionKey,
      workspaceId,
      accountId,
      status: "sent",
      providerMessageId: result.providerMessageId,
      attemptCount: message.attempts,
      occurredAt: now,
    });
    message.ack();
    return;
  }

  if (result.status === "failed") {
    console.warn(
      `[Consumer] Delivery permanently failed: ${actionKey} (${result.reason})`,
    );
    await store.recordOutcome({
      id: crypto.randomUUID(),
      actionKey,
      workspaceId,
      accountId,
      status: "failed",
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      attemptCount: message.attempts,
      occurredAt: now,
    });
    message.ack();
    return;
  }

  if (result.status === "unknown") {
    console.warn(
      `[Consumer] Delivery network outcome ambiguous: ${actionKey}; not blind retrying.`,
    );
    await store.recordOutcome({
      id: crypto.randomUUID(),
      actionKey,
      workspaceId,
      accountId,
      status: "unknown",
      errorCode: "NETWORK_TIMEOUT",
      attemptCount: message.attempts,
      occurredAt: now,
    });
    message.ack();
    return;
  }

  // Retryable outcome (HTTP 429 / Code 32 / 5xx)
  console.warn(
    `[Consumer] Delivery retryable: ${actionKey} (${result.reason})`,
  );
  await store.recordOutcome({
    id: crypto.randomUUID(),
    actionKey,
    workspaceId,
    accountId,
    status: "retryable",
    attemptCount: message.attempts,
    occurredAt: now,
  });

  const delay =
    result.retryAfterSeconds ?? Math.min(300, 5 * 3 ** (message.attempts - 1));
  message.retry({ delaySeconds: delay });
}
