export interface PostCommentReplyInput {
  graphVersion?: string | undefined;
  commentId: string;
  accessToken: string;
  text: string;
}

export interface PostCommentReplyResult {
  success: boolean;
  replyId?: string | undefined;
  error?: string | undefined;
}

/**
 * Posts a public reply to a top-level Instagram comment.
 * Endpoint: POST https://graph.instagram.com/{graphVersion}/{commentId}/replies
 * Fallback: POST https://graph.facebook.com/{graphVersion}/{commentId}/replies
 */
export async function postInstagramCommentReply(
  input: PostCommentReplyInput,
  fetcher: typeof fetch = fetch,
): Promise<PostCommentReplyResult> {
  const version = input.graphVersion || "v23.0";
  const primaryUrl = `https://graph.instagram.com/${version}/${encodeURIComponent(input.commentId)}/replies`;
  const fallbackUrl = `https://graph.facebook.com/${version}/${encodeURIComponent(input.commentId)}/replies`;

  const body = JSON.stringify({ message: input.text });

  let response: Response;
  let activeUrl = primaryUrl;

  try {
    response = await fetcher(primaryUrl, {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        "content-type": "application/json",
      },
      body,
    });

    if (response.status === 404) {
      activeUrl = fallbackUrl;
      response = await fetcher(fallbackUrl, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
        },
        body,
      });
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Comment Reply] Network error on ${activeUrl}:`, errorMsg);
    return { success: false, error: errorMsg };
  }

  if (response.ok) {
    try {
      const data = (await response.json()) as { id?: string };
      console.log(
        `[Comment Reply] Successfully posted public reply to comment ${input.commentId}: id=${data.id}`,
      );
      return { success: true, replyId: data.id };
    } catch {
      return { success: true };
    }
  }

  let errorDetails = `HTTP ${response.status}`;
  try {
    const errJson = (await response.json()) as {
      error?: { message?: string; code?: number };
    };
    if (errJson.error?.message) {
      errorDetails = `${errJson.error.message} (code ${errJson.error.code})`;
    }
  } catch {
    // Ignore JSON parse errors on failure response
  }

  console.warn(
    `[Comment Reply] Failed to post reply to comment ${input.commentId}: ${errorDetails}`,
  );
  return { success: false, error: errorDetails };
}
