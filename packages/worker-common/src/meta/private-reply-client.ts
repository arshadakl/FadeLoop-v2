export type PrivateReplyResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "retryable"; reason: string; retryAfterSeconds?: number }
  | { status: "failed"; reason: string; errorCode?: string }
  | { status: "unknown"; reason: string };

export interface QuickReplyOption {
  content_type: "text";
  title: string;
  payload: string;
}

export interface SendPrivateReplyInput {
  graphVersion: string;
  accountId: string;
  accessToken: string;
  // Recipient: either commentId (for private replies to comments) or messagingUserId (for conversational reply)
  commentId?: string;
  messagingUserId?: string;
  text: string;
  quickReplies?: QuickReplyOption[];
}

/**
 * Dispatches an automated message or private reply using the Meta Graph API.
 * Endpoint: POST https://graph.instagram.com/{graphVersion}/{accountId}/messages
 *
 * Supports:
 * - Direct comment private reply: recipient: { comment_id: commentId }
 * - Direct user conversational reply: recipient: { id: messagingUserId }
 * - Interactive Quick Reply buttons (e.g. 2-step "Send Me" flow)
 *
 * Contract & Edge Classification:
 * - 200 with message_id -> "sent"
 * - 429 (rate limited) -> "retryable"
 * - 5xx (transient gateway/server error) -> "retryable"
 * - 4xx client errors (e.g. comment deleted, user blocked, expired window) -> "failed" (permanent)
 * - Network timeouts / aborts -> "unknown" (do NOT blind retry, could have been accepted by Meta)
 */
export async function sendInstagramPrivateReply(
  input: SendPrivateReplyInput,
  fetcher: typeof fetch = fetch,
): Promise<PrivateReplyResult> {
  const recipient = input.messagingUserId
    ? { id: input.messagingUserId }
    : { comment_id: input.commentId };

  const messagePayload: {
    text: string;
    quick_replies?: QuickReplyOption[];
  } = {
    text: input.text,
  };

  if (input.quickReplies && input.quickReplies.length > 0) {
    messagePayload.quick_replies = input.quickReplies.slice(0, 13);
  }

  const payload = {
    recipient,
    message: messagePayload,
  };

  const body = JSON.stringify(payload);

  // Try account messages endpoint first, with me/messages fallback
  const primaryUrl = `https://graph.instagram.com/${input.graphVersion}/${input.accountId}/messages`;
  const fallbackUrl = `https://graph.instagram.com/${input.graphVersion}/me/messages`;

  let response: Response;
  let activeUrl = primaryUrl;

  try {
    console.log(
      `[Meta Client] POST ${primaryUrl} recipient:`,
      JSON.stringify(recipient),
      input.quickReplies ? `(${input.quickReplies.length} quick replies)` : "",
    );

    response = await fetcher(primaryUrl, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json",
      },
      body,
    });

    // If 404 or 400 on accountId endpoint with User Token, attempt fallback to me/messages
    if (response.status === 404) {
      console.warn(
        `[Meta Client] ${primaryUrl} returned 404; falling back to ${fallbackUrl}`,
      );
      activeUrl = fallbackUrl;
      response = await fetcher(fallbackUrl, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(10_000),
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
        },
        body,
      });
    }
  } catch (err) {
    // If request timed out or network disconnected, state is ambiguous
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Meta Client] Transport failure on ${activeUrl}:`, message);
    return {
      status: "unknown",
      reason: `Network transport failure: ${message}`,
    };
  }

  console.log(`[Meta Client] HTTP ${response.status} from ${activeUrl}`);

  // 1. Success
  if (response.ok) {
    try {
      const data = (await response.json()) as { message_id?: string };
      const providerMessageId =
        typeof data?.message_id === "string"
          ? data.message_id
          : "unknown_msg_id";
      console.log(`[Meta Client] Message sent! ID: ${providerMessageId}`);
      return { status: "sent", providerMessageId };
    } catch {
      // 200 OK received but JSON parse failed: still accepted by provider
      return { status: "sent", providerMessageId: "unparsed_msg_id" };
    }
  }

  // 2. Parse error response
  let errorJson:
    | { error?: { message?: string; code?: number; error_subcode?: number } }
    | undefined;
  try {
    errorJson = (await response.json()) as {
      error?: { message?: string; code?: number; error_subcode?: number };
    };
  } catch {
    /* Ignore body drain failure */
  }

  console.warn(
    `[Meta Client] Error from Meta API (HTTP ${response.status}):`,
    JSON.stringify(errorJson),
  );

  const errMessage = errorJson?.error?.message ?? `HTTP ${response.status}`;
  const errorCode =
    typeof errorJson?.error?.code === "number"
      ? String(errorJson.error.code)
      : undefined;

  // 3. Rate limiting (429 or Meta code 4 / 17 / 32 / 613)
  if (
    response.status === 429 ||
    errorCode === "4" ||
    errorCode === "17" ||
    errorCode === "32" ||
    errorCode === "613"
  ) {
    const retryHeader = response.headers.get("retry-after");
    const parsedSeconds = retryHeader
      ? Number.parseInt(retryHeader, 10)
      : Number.NaN;
    return {
      status: "retryable",
      reason: `Meta rate limit (code ${errorCode}): ${errMessage}`,
      ...(Number.isFinite(parsedSeconds)
        ? { retryAfterSeconds: parsedSeconds }
        : { retryAfterSeconds: 60 }),
    };
  }

  // 4. Server error (5xx) -> retryable
  if (response.status >= 500) {
    return {
      status: "retryable",
      reason: `Meta server error (${response.status}): ${errMessage}`,
    };
  }

  // 5. Permanent client failure (4xx) -> not retryable
  return {
    status: "failed",
    reason: errMessage,
    ...(errorCode ? { errorCode } : {}),
  };
}
