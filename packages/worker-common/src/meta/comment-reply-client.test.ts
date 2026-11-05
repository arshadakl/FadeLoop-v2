import { describe, expect, it } from "vitest";
import { postInstagramCommentReply } from "./comment-reply-client";

describe("postInstagramCommentReply", () => {
  it("posts public reply successfully with HTTP 200", async () => {
    let capturedUrl = "";
    let capturedBody = "";

    const mockFetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      capturedUrl = input.toString();
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ id: "reply_12345" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await postInstagramCommentReply(
      {
        commentId: "c_999",
        accessToken: "token_abc",
        text: "Sent to your DM! 📩",
      },
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(true);
    expect(result.replyId).toBe("reply_12345");
    expect(capturedUrl).toContain("/c_999/replies");
    expect(capturedBody).toContain("Sent to your DM! 📩");
  });

  it("handles 404 with fallback gracefully", async () => {
    let callCount = 0;
    const mockFetch = async (input: string | URL | Request) => {
      callCount++;
      if (input.toString().includes("graph.instagram.com")) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(JSON.stringify({ id: "reply_fallback" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await postInstagramCommentReply(
      {
        commentId: "c_fallback",
        accessToken: "token_abc",
        text: "Checked!",
      },
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(true);
    expect(result.replyId).toBe("reply_fallback");
    expect(callCount).toBe(2);
  });
});
