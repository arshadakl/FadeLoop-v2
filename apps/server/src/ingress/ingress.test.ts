import type { AutomationEvent } from "@fadeloop/contracts/events";
import { describe, expect, it, vi } from "vitest";
import type { ServerEnvironment } from "../environment";
import server from "../index";

const secret = "test_signing_secret_1234567890";
const verifyToken = "my_meta_verify_token_xyz";

async function signPayload(payload: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sig), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `sha256=${hex}`;
}

describe("Webhook Ingress Router (Unified Server)", () => {
  const mockQueue = {
    sendBatch: vi.fn(async () => {}),
  } as unknown as Queue<AutomationEvent>;

  const env: ServerEnvironment = {
    APP_ENV: "test",
    META_WEBHOOK_VERIFY_TOKEN: verifyToken,
    META_WEBHOOK_SIGNING_SECRET: secret,
    INCOMING_EVENTS_QUEUE: mockQueue,
  };

  it("handles GET challenge verification successfully with correct token", async () => {
    const res = await server.fetch(
      new Request(
        `https://fadeloop.test/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test_challenge_123`,
      ),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("test_challenge_123");
  });

  it("rejects GET challenge with invalid token or invalid mode", async () => {
    const badTokenRes = await server.fetch(
      new Request(
        "https://fadeloop.test/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=123",
      ),
      env,
    );
    expect(badTokenRes.status).toBe(403);

    const badModeRes = await server.fetch(
      new Request(
        `https://fadeloop.test/webhook?hub.mode=unsubscribe&hub.verify_token=${verifyToken}&hub.challenge=123`,
      ),
      env,
    );
    expect(badModeRes.status).toBe(403);
  });

  it("rejects POST request without signature", async () => {
    const res = await server.fetch(
      new Request("https://fadeloop.test/webhook", {
        method: "POST",
        body: JSON.stringify({ object: "instagram", entry: [] }),
      }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("rejects POST request with invalid signature", async () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const res = await server.fetch(
      new Request("https://fadeloop.test/webhook", {
        method: "POST",
        headers: { "x-hub-signature-256": "sha256=invalid_hash" },
        body,
      }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("authenticates valid signed webhook payload and enqueues normalized events", async () => {
    const payload = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_account_1",
          time: 1700000000,
          changes: [
            {
              field: "comments",
              value: {
                id: "c_1",
                text: "send info",
                from: { id: "user_1", username: "fan" },
                media: { id: "media_1" },
              },
            },
          ],
        },
      ],
    });

    const signature = await signPayload(payload, secret);
    const res = await server.fetch(
      new Request("https://fadeloop.test/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
        },
        body: payload,
      }),
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("EVENT_RECEIVED");
    expect(mockQueue.sendBatch).toHaveBeenCalledTimes(1);

    const callArgs = (
      mockQueue.sendBatch as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls[0];
    const messages = callArgs?.[0] as Array<{ body: AutomationEvent }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.body).toMatchObject({
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_account_1",
      providerEventKey: "comment:c_1",
      mediaId: "media_1",
      commentId: "c_1",
      text: "send info",
    });
  });

  it("returns 503 if Queue publication fails so Meta will retry", async () => {
    const failingQueue = {
      sendBatch: vi.fn(async () => {
        throw new Error("Queue down");
      }),
    } as unknown as Queue<AutomationEvent>;

    const failingEnv: ServerEnvironment = {
      ...env,
      INCOMING_EVENTS_QUEUE: failingQueue,
    };

    const payload = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_account_1",
          time: 1700000000,
          changes: [
            {
              field: "comments",
              value: {
                id: "c_2",
                text: "retry me",
                from: { id: "user_2", username: "fan2" },
                media: { id: "media_2" },
              },
            },
          ],
        },
      ],
    });

    const signature = await signPayload(payload, secret);
    const res = await server.fetch(
      new Request("https://fadeloop.test/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
        },
        body: payload,
      }),
      failingEnv,
    );

    expect(res.status).toBe(503);
  });
});
