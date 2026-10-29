import { describe, expect, it } from "vitest";
import { encodeBase64url } from "./encoding";
import { createTokenVault } from "./token-vault";

const testKey = encodeBase64url(new Uint8Array(32).fill(7));
describe("account-bound token protection", () => {
  it("round-trips with fresh nonces and does not embed plaintext", async () => {
    const vault = await createTokenVault(testKey);
    const first = await vault.seal("fake-token", "workspace:one/account:one");
    const second = await vault.seal("fake-token", "workspace:one/account:one");
    expect(first).not.toBe(second);
    expect(first).not.toContain("fake-token");
    expect(await vault.open(first, "workspace:one/account:one")).toBe(
      "fake-token",
    );
  });
  it("rejects another account, another key, tampering, and unknown versions", async () => {
    const vault = await createTokenVault(testKey);
    const envelope = await vault.seal("fake-token", "owner");
    await expect(vault.open(envelope, "other")).rejects.toThrow(
      "Unable to decrypt token",
    );
    const otherVault = await createTokenVault(
      encodeBase64url(new Uint8Array(32).fill(8)),
    );
    await expect(otherVault.open(envelope, "owner")).rejects.toThrow(
      "Unable to decrypt token",
    );
    await expect(
      vault.open(envelope.replace("v1.", "v2."), "owner"),
    ).rejects.toThrow("Unable to decrypt token");
    const parts = envelope.split(".");
    const ciphertext = parts[2] ?? "";
    const altered = `${parts[0]}.${parts[1]}.${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
    await expect(vault.open(altered, "owner")).rejects.toThrow(
      "Unable to decrypt token",
    );
  });
  it("rejects invalid encryption keys", async () => {
    await expect(createTokenVault("bad key")).rejects.toThrow();
    await expect(
      createTokenVault(encodeBase64url(new Uint8Array(16))),
    ).rejects.toThrow();
  });
});
