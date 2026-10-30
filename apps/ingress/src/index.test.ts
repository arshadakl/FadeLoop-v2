import type { AutomationEvent } from "@fadeloop/contracts/events";
import { describe, expect, it, vi } from "vitest";
import ingress, { type IngressEnvironment } from "./index";

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

describe("Webhook Ingress Worker", () => {
  const mockQueue = {
    sendBatch: vi.fn(async () => {}),
  } as unknown as Queue<AutomationEvent>;

  const env: IngressEnvironment = {
    APP_ENV: "test",
    META_WEBHOOK_VERIFY_TOKEN: verifyToken,
    META_WEBHOOK_SIGNING_SECRET: secret,
    INCOMING_EVENTS_QUEUE: mockQueue,
  };

  it("handles GET challenge verification successfully with correct token", async () => {
    const res = await ingress.fetch(
      new Request(
        `https://ingress.test/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test_challenge_123`,
      ),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("test_challenge_123");
  });

  it("rejects GET challenge with invalid token or invalid mode", async () => {
    const badTokenRes = await ingress.fetch(
      new Request(
        "https://ingress.test/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=123",
      ),
      env,
    );
    expect(badTokenRes.status).toBe(403);

    const badModeRes = await ingress.fetch(
      new Request(
        `https://ingress.test/webhook?hub.mode=unsubscribe&hub.verify_token=${verifyToken}&hub.challenge=123`,
      ),
      env,
    );
    expect(badModeRes.status).toBe(403);
  });

  it("rejects POST with missing or invalid HMAC signature before parsing or queueing", async () => {
    const noSigRes = await ingress.fetch(
      new Request("https://ingress.test/webhook", {
        method: "POST",
        body: JSON.stringify({ object: "instagram" }),
      }),
      env,
    );
    expect(noSigRes.status).toBe(401);
    expect(mockQueue.sendBatch).not.toHaveBeenCalled();

    const badSigRes = await ingress.fetch(
      new Request("https://ingress.test/webhook", {
        method: "POST",
        headers: {
          "x-hub-signature-256":
            "sha256=invalidhex00000000000000000000000000000000000000000000000000000000",
        },
        body: JSON.stringify({ object: "instagram" }),
      }),
      env,
    );
    expect(badSigRes.status).toBe(401);
    expect(mockQueue.sendBatch).not.toHaveBeenCalled();
  });

  it("accepts valid signed comment event and enqueues normalized event", async () => {
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
                id: "comment_123",
                text: "price please",
                media: { id: "media_456" },
                from: { id: "user_789" },
              },
            },
          ],
        },
      ],
    });

    const sig = await signPayload(payload, secret);
    const res = await ingress.fetch(
      new Request("https://ingress.test/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": sig,
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
      providerEventKey: "comment:comment_123",
      mediaId: "media_456",
      commentId: "comment_123",
      text: "price please",
    });
  });

  it("filters out self-comments posted by the account itself", async () => {
    const payload = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_account_1",
          changes: [
            {
              field: "comments",
              value: {
                id: "comment_self",
                text: "Thanks for checking it out!",
                media: { id: "media_456" },
                from: { id: "ig_account_1" }, // Self comment!
              },
            },
          ],
        },
      ],
    });

    const sig = await signPayload(payload, secret);
    const res = await ingress.fetch(
      new Request("https://ingress.test/webhook", {
        method: "POST",
        headers: { "x-hub-signature-256": sig },
        body: payload,
      }),
      env,
    );

    expect(res.status).toBe(200);
    // Queue sendBatch should not be called because the event was filtered
    expect(mockQueue.sendBatch).not.toHaveBeenCalled();
  });

  it("returns 503 if Queue publication fails so Meta will retry", async () => {
    const failingQueue = {
      sendBatch: vi.fn(async () => {
        throw new Error("Queue down");
      }),
    } as unknown as Queue<AutomationEvent>;

    const payload = JSON.stringify({
      object: "instagram",
      entry: [
        {
          id: "ig_account_1",
          changes: [
            {
              field: "comments",
              value: { id: "c1", text: "hi", media: { id: "m1" } },
            },
          ],
        },
      ],
    });

    const sig = await signPayload(payload, secret);
    const res = await ingress.fetch(
      new Request("https://ingress.test/webhook", {
        method: "POST",
        headers: { "x-hub-signature-256": sig },
        body: payload,
      }),
      { ...env, INCOMING_EVENTS_QUEUE: failingQueue },
    );

    expect(res.status).toBe(503);
  });
});
