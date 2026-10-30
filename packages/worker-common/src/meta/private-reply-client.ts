export type PrivateReplyResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "retryable"; reason: string; retryAfterSeconds?: number }
  | { status: "failed"; reason: string; errorCode?: string }
  | { status: "unknown"; reason: string };

export interface SendPrivateReplyInput {
  graphVersion: string;
  accountId: string;
  accessToken: string;
  commentId: string;
  text: string;
}

/**
 * Dispatches a private reply to an Instagram comment using the Meta Graph API.
 * Endpoint: POST https://graph.instagram.com/{graphVersion}/{accountId}/messages
 * Payload: { recipient: { comment_id: commentId }, message: { text: text } }
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
  const url = `https://graph.instagram.com/${input.graphVersion}/${input.accountId}/messages`;
  const body = JSON.stringify({
    recipient: { comment_id: input.commentId },
    message: { text: input.text },
  });

  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json",
      },
      body,
    });
  } catch (err) {
    // If request timed out or network disconnected, state is ambiguous
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "unknown",
      reason: `Network transport failure: ${message}`,
    };
  }

  // 1. Success
  if (response.ok) {
    try {
      const data = (await response.json()) as { message_id?: string };
      const providerMessageId =
        typeof data?.message_id === "string"
          ? data.message_id
          : "unknown_msg_id";
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
      reason: `Meta rate limit: ${errMessage}`,
      ...(Number.isFinite(parsedSeconds)
        ? { retryAfterSeconds: parsedSeconds }
        : {}),
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
