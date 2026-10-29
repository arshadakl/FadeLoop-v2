import { describe, expect, it } from "vitest";
import {
  consumeOAuthState,
  createOAuthAttempt,
  type OAuthStateStore,
} from "./oauth-state";

describe("session-bound OAuth state", () => {
  it("rejects other sessions, expires, and is consumed once by the owner", async () => {
    const { state, record } = await createOAuthAttempt("owner", 1000);
    let consumed = false;
    const store: OAuthStateStore = {
      async consume(input) {
        if (
          consumed ||
          input.digest !== record.digest ||
          input.ownerSessionId !== record.ownerSessionId ||
          input.now >= record.expiresAt
        )
          return false;
        consumed = true;
        return true;
      },
    };
    expect(await consumeOAuthState(state, "other", 2000, store)).toBe(false);
    expect(
      await consumeOAuthState(state, "owner", record.expiresAt, store),
    ).toBe(false);
    expect(await consumeOAuthState(state, "owner", 2000, store)).toBe(true);
    expect(await consumeOAuthState(state, "owner", 2000, store)).toBe(false);
    expect(record.digest).not.toBe(state);
  });
  it("does not consult storage for malformed state", async () => {
    const store: OAuthStateStore = {
      consume() {
        throw new Error("Must not access store");
      },
    };
    expect(await consumeOAuthState(null, "owner", 1, store)).toBe(false);
    expect(await consumeOAuthState("invalid", "owner", 1, store)).toBe(false);
    expect(await consumeOAuthState("a".repeat(43), "", 1, store)).toBe(false);
  });
});
