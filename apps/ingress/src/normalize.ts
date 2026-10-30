import type { AutomationEvent } from "@fadeloop/contracts/events";

export interface RawWebhookChange {
  field?: string;
  value?: {
    id?: string;
    text?: string;
    media?: { id?: string };
    from?: { id?: string; username?: string };
    parent_id?: string;
  };
}

export interface RawWebhookMessagingItem {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    quick_reply?: { payload?: string };
  };
  postback?: {
    mid?: string;
    title?: string;
    payload?: string;
  };
  read?: unknown;
  delivery?: unknown;
  reaction?: unknown;
}

export interface RawWebhookEntry {
  id?: string;
  time?: number;
  changes?: RawWebhookChange[];
  messaging?: RawWebhookMessagingItem[];
}

export interface RawWebhookPayload {
  object?: string;
  entry?: RawWebhookEntry[];
}

/**
 * Normalizes an authenticated Instagram webhook envelope into a list of
 * deterministic AutomationEvents.
 *
 * Rules:
 * - Only processes object === 'instagram'.
 * - Extracts comment.created from changes with field === 'comments'.
 * - Extracts message.received from messaging with message (ignoring echoes).
 * - Extracts postback.received from messaging with postback.
 * - Filters out empty comments, echoes, reactions, read receipts, delivery acks.
 * - Generates deterministic providerEventKey for deduplication.
 */
export function normalizeWebhookPayload(
  payload: unknown,
  receivedAt: number,
): AutomationEvent[] {
  if (typeof payload !== "object" || payload === null) return [];
  const body = payload as RawWebhookPayload;
  if (body.object !== "instagram" || !Array.isArray(body.entry)) return [];

  const events: AutomationEvent[] = [];

  for (const entry of body.entry) {
    if (typeof entry !== "object" || entry === null) continue;
    const accountId = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!accountId) continue;

    const entryTime =
      typeof entry.time === "number" && Number.isFinite(entry.time)
        ? entry.time > 1_000_000_000_000
          ? entry.time
          : entry.time * 1000
        : receivedAt;

    // 1. Process changes (comments)
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (
          typeof change !== "object" ||
          change === null ||
          change.field !== "comments" ||
          typeof change.value !== "object" ||
          change.value === null
        ) {
          continue;
        }

        const val = change.value;
        const commentId = typeof val.id === "string" ? val.id.trim() : "";
        const mediaId =
          typeof val.media?.id === "string" ? val.media.id.trim() : "";
        const text = typeof val.text === "string" ? val.text.trim() : "";

        // Comments must have commentId, mediaId, and text
        if (!commentId || !mediaId || !text) continue;

        // Skip self-comments posted by the account or bot itself to prevent feedback loops
        if (
          typeof val.from?.id === "string" &&
          val.from.id.trim() === accountId
        ) {
          continue;
        }

        events.push({
          schemaVersion: 1,
          kind: "comment.created",
          accountId,
          providerEventKey: `comment:${commentId}`,
          mediaId,
          commentId,
          text,
          occurredAt: entryTime,
          receivedAt,
        });
      }
    }

    // 2. Process messaging (inbound DMs and quick-reply postbacks)
    if (Array.isArray(entry.messaging)) {
      for (const item of entry.messaging) {
        if (typeof item !== "object" || item === null) continue;

        const senderId =
          typeof item.sender?.id === "string" ? item.sender.id.trim() : "";
        if (!senderId || senderId === accountId) continue;

        const itemTime =
          typeof item.timestamp === "number" && Number.isFinite(item.timestamp)
            ? item.timestamp > 1_000_000_000_000
              ? item.timestamp
              : item.timestamp * 1000
            : entryTime;

        // Inbound message
        if (
          item.message &&
          typeof item.message === "object" &&
          !item.message.is_echo &&
          typeof item.message.mid === "string"
        ) {
          const mid = item.message.mid.trim();
          const text =
            typeof item.message.text === "string"
              ? item.message.text.trim()
              : "";
          const payloadStr =
            typeof item.message.quick_reply?.payload === "string"
              ? item.message.quick_reply.payload.trim()
              : undefined;

          if (mid && (text || payloadStr)) {
            events.push({
              schemaVersion: 1,
              kind: "message.received",
              accountId,
              providerEventKey: `message:${mid}`,
              messagingUserId: senderId,
              text,
              ...(payloadStr ? { interactionPayload: payloadStr } : {}),
              occurredAt: itemTime,
              receivedAt,
            });
          }
        }

        // Postback
        if (
          item.postback &&
          typeof item.postback === "object" &&
          typeof item.postback.payload === "string" &&
          item.postback.payload.trim()
        ) {
          const postbackPayload = item.postback.payload.trim();
          const postbackKey =
            typeof item.postback.mid === "string" && item.postback.mid.trim()
              ? `postback:${item.postback.mid.trim()}`
              : `postback:${senderId}:${itemTime}`;

          events.push({
            schemaVersion: 1,
            kind: "postback.received",
            accountId,
            providerEventKey: postbackKey,
            messagingUserId: senderId,
            interactionPayload: postbackPayload,
            occurredAt: itemTime,
            receivedAt,
          });
        }
      }
    }
  }

  return events;
}
