import { describe, expect, it } from "vitest";
import {
  getInstagramAccountWebhookSubscriptions,
  subscribeInstagramAccountToWebhooks,
} from "./webhook-subscription";

describe("Instagram Account Webhook Subscription", () => {
  it("subscribes account to comments and messages webhooks", async () => {
    let capturedUrl = "";
    let capturedMethod = "";

    const mockFetch = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      capturedUrl = input.toString();
      capturedMethod = init?.method ?? "GET";
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await subscribeInstagramAccountToWebhooks(
      "17841400000000001",
      "test_access_token",
      "v23.0",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.success).toBe(true);
    expect(result.subscribedFields).toEqual([
      "comments",
      "messages",
      "messaging_postbacks",
    ]);
    expect(capturedMethod).toBe("POST");
    expect(capturedUrl).toContain("/17841400000000001/subscribed_apps");
    expect(capturedUrl).toContain(
      "subscribed_fields=comments%2Cmessages%2Cmessaging_postbacks",
    );
    expect(capturedUrl).toContain("access_token=test_access_token");
  });

  it("reads active webhook subscriptions", async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          data: [{ subscribed_fields: ["comments", "messages"] }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    };

    const result = await getInstagramAccountWebhookSubscriptions(
      "17841400000000001",
      "test_access_token",
      "v23.0",
      mockFetch as unknown as typeof fetch,
    );

    expect(result.subscribedFields).toEqual(["comments", "messages"]);
  });
});
