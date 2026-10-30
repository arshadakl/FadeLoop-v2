import type { AutomationEvent } from "@fadeloop/contracts/events";
import {
  isCommentWithinReplyWindow,
  matchComment,
} from "@fadeloop/domain/matching";
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
 * - Direct comment delivery: only comment.created events are processed.
 * - 7-day eligibility window enforced.
 * - Active campaign and keyword match verified.
 * - Atomic D1 claim guarantees idempotent single delivery.
 * - AES-GCM token decryption.
 * - Meta Graph API dispatch with bounded retries and no blind retries on unknown.
 */
export async function processQueueMessage(
  message: Message<AutomationEvent>,
  env: ConsumerEnvironment,
  fetcher: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<void> {
  const event = message.body;

  // 1. Only process comment.created events for private reply
  if (event.kind !== "comment.created") {
    message.ack();
    return;
  }

  // 2. Validate prerequisites
  if (!env.DB || !env.TOKEN_ENCRYPTION_KEY || !env.META_GRAPH_VERSION) {
    console.error("Consumer worker missing required bindings");
    message.retry({ delaySeconds: 60 });
    return;
  }

  // 3. Enforce Meta 7-day private reply window
  if (!isCommentWithinReplyWindow(event.occurredAt, now)) {
    console.info(
      `Comment ${event.commentId} is outside 7-day eligibility window; dropping.`,
    );
    message.ack();
    return;
  }

  const store = createConsumerStore(env.DB);

  // 4. Look up active published campaign for this post/reel
  const active = await store.findActiveCampaignForMedia(
    event.accountId,
    event.mediaId,
  );
  if (!active) {
    // No active published campaign for this media
    message.ack();
    return;
  }

  // 5. Test comment text matching
  if (!matchComment(event.text, active.revision)) {
    // Comment did not match keyword rules
    message.ack();
    return;
  }

  // 6. Look up connected Instagram account and verify token validity
  const account = await store.findConnectedAccount(event.accountId);
  if (!account) {
    console.warn(
      `Account ${event.accountId} is not connected or missing token.`,
    );
    message.ack();
    return;
  }

  if (account.tokenExpiresAt <= now) {
    console.warn(`Account ${event.accountId} token has expired.`);
    message.ack();
    return;
  }

  // 7. Atomic claim in D1: guarantees only 1 delivery per (account_id, comment_id)
  const actionKey = `${event.accountId}:${event.commentId}`;
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
    // Already claimed or settled by another concurrent or prior worker
    message.ack();
    return;
  }

  // 8. Decrypt account access token
  let accessToken: string;
  try {
    const vault = await createTokenVault(env.TOKEN_ENCRYPTION_KEY);
    accessToken = await vault.open(account.tokenCiphertext, event.accountId);
  } catch (err) {
    console.error("Failed to decrypt account token:", err);
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

  // 9. Dispatch private reply via Meta Graph API
  const replyText = formatReplyText(
    active.revision.replyTemplate,
    active.revision.resourceUrl,
  );

  const result = await sendInstagramPrivateReply(
    {
      graphVersion: env.META_GRAPH_VERSION,
      accountId: event.accountId,
      accessToken,
      commentId: event.commentId,
      text: replyText,
    },
    fetcher,
  );

  // 10. Record outcome and settle queue message
  if (result.status === "sent") {
    await store.recordOutcome({
      id: crypto.randomUUID(),
      actionKey,
      workspaceId: active.campaign.workspaceId,
      accountId: event.accountId,
      status: "sent",
      providerMessageId: result.providerMessageId,
      attemptCount: message.attempts,
      occurredAt: now,
    });
    message.ack();
    return;
  }

  if (result.status === "failed") {
    // Permanent rejection from Meta (e.g. comment deleted, user blocked)
    await store.recordOutcome({
      id: crypto.randomUUID(),
      actionKey,
      workspaceId: active.campaign.workspaceId,
      accountId: event.accountId,
      status: "failed",
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      attemptCount: message.attempts,
      occurredAt: now,
    });
    message.ack();
    return;
  }

  if (result.status === "unknown") {
    // Ambiguous network outcome: do NOT blind retry (could result in duplicate message to user)
    await store.recordOutcome({
      id: crypto.randomUUID(),
      actionKey,
      workspaceId: active.campaign.workspaceId,
      accountId: event.accountId,
      status: "unknown",
      errorCode: "NETWORK_TIMEOUT",
      attemptCount: message.attempts,
      occurredAt: now,
    });
    message.ack();
    return;
  }

  // 11. Retryable outcome (429 rate limit or 5xx)
  await store.recordOutcome({
    id: crypto.randomUUID(),
    actionKey,
    workspaceId: active.campaign.workspaceId,
    accountId: event.accountId,
    status: "retryable",
    attemptCount: message.attempts,
    occurredAt: now,
  });

  // Calculate backoff: respect Retry-After or exponential delay (5s, 15s, 45s)
  const delay =
    result.retryAfterSeconds ?? Math.min(300, 5 * 3 ** (message.attempts - 1));
  message.retry({ delaySeconds: delay });
}
