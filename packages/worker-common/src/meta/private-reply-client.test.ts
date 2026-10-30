import { describe, expect, it, vi } from "vitest";
import { sendInstagramPrivateReply } from "./private-reply-client";

describe("sendInstagramPrivateReply", () => {
  const baseInput = {
    graphVersion: "v23.0",
    accountId: "17841400000000001",
    accessToken: "EAABtest_token",
    commentId: "comment_999",
    text: "Here is your link: https://example.com",
  };

  it("returns sent outcome with providerMessageId on 200 OK", async () => {
    const mockFetcher = vi.fn(async () =>
      Response.json({ message_id: "m_mid_123456" }),
    );

    const result = await sendInstagramPrivateReply(baseInput, mockFetcher);
    expect(result.status).toBe("sent");
    if (result.status === "sent") {
      expect(result.providerMessageId).toBe("m_mid_123456");
    }

    expect(mockFetcher).toHaveBeenCalledTimes(1);
    const calls = mockFetcher.mock.calls as unknown as [
      string,
      RequestInit | undefined,
    ][];
    expect(calls[0]?.[0]).toBe(
      "https://graph.instagram.com/v23.0/17841400000000001/messages",
    );
  });

  it("classifies 429 rate limit as retryable with optional Retry-After header", async () => {
    const mockFetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { message: "Rate limit reached", code: 613 },
          }),
          {
            status: 429,
            headers: {
              "retry-after": "60",
              "content-type": "application/json",
            },
          },
        ),
    );

    const result = await sendInstagramPrivateReply(baseInput, mockFetcher);
    expect(result.status).toBe("retryable");
    if (result.status === "retryable") {
      expect(result.retryAfterSeconds).toBe(60);
      expect(result.reason).toContain("Rate limit reached");
    }
  });

  it("classifies 5xx server errors as retryable", async () => {
    const mockFetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "Internal error" } }), {
          status: 503,
        }),
    );

    const result = await sendInstagramPrivateReply(baseInput, mockFetcher);
    expect(result.status).toBe("retryable");
    if (result.status === "retryable") {
      expect(result.reason).toContain("503");
    }
  });

  it("classifies 4xx client errors (user blocked / invalid recipient) as permanently failed", async () => {
    const mockFetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "Cannot message this user",
              code: 100,
              error_subcode: 2534015,
            },
          }),
          { status: 400 },
        ),
    );

    const result = await sendInstagramPrivateReply(baseInput, mockFetcher);
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.errorCode).toBe("100");
      expect(result.reason).toContain("Cannot message this user");
    }
  });

  it("classifies network timeout / fetch throw as unknown (no blind retry)", async () => {
    const mockFetcher = vi.fn(async () => {
      throw new Error("Connection reset by peer");
    });

    const result = await sendInstagramPrivateReply(baseInput, mockFetcher);
    expect(result.status).toBe("unknown");
    if (result.status === "unknown") {
      expect(result.reason).toContain("Connection reset by peer");
    }
  });
});
