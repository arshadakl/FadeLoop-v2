import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./signature";

const encoder = new TextEncoder();
async function sign(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `sha256=${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
describe("raw webhook authentication", () => {
  it("accepts signed bytes and rejects equivalent JSON with different whitespace", async () => {
    const signature = await sign("test-secret", '{"a":1}');
    expect(
      await verifyWebhookSignature(
        "test-secret",
        encoder.encode('{"a":1}').buffer,
        signature,
      ),
    ).toBe(true);
    expect(
      await verifyWebhookSignature(
        "test-secret",
        encoder.encode('{ "a":1 }').buffer,
        signature,
      ),
    ).toBe(false);
  });
  it("rejects wrong secret, malformed signature, and missing signature", async () => {
    const signature = await sign("test-secret", "{}");
    expect(
      await verifyWebhookSignature(
        "other",
        encoder.encode("{}").buffer,
        signature,
      ),
    ).toBe(false);
    for (const value of [
      null,
      "",
      "sha1=abc",
      "sha256=zz",
      `sha256=${"a".repeat(63)}`,
    ])
      expect(
        await verifyWebhookSignature(
          "test-secret",
          encoder.encode("{}").buffer,
          value,
        ),
      ).toBe(false);
  });
});
