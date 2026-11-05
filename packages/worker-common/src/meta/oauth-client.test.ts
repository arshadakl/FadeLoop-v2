import { describe, expect, it, vi } from "vitest";
import { createInstagramOAuthClient } from "./oauth-client";

const config = {
  appId: "123",
  appSecret: "fake-secret",
  redirectUri: "https://v2.example/auth/callback",
};
describe("Instagram Login request contract from legacy reference", () => {
  it("keeps the app secret out of the authorization URL and uses exact callback/state", () => {
    const url = new URL(
      createInstagramOAuthClient(config).authorizeUrl("a".repeat(43)),
    );
    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("state")).toBe("a".repeat(43));
    expect(url.toString()).not.toContain(config.appSecret);
  });
  it("exchanges code server-side and preserves a large string user ID", async () => {
    const fetcher = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        access_token: "fake-token",
        user_id: "99999999999999999999",
      }),
    );
    const result = await createInstagramOAuthClient(
      config,
      fetcher,
    ).exchangeCode("fake-code");
    expect(result.userId).toBe("99999999999999999999");
    const call = fetcher.mock.calls[0];
    expect(call?.[0]).toBe("https://api.instagram.com/oauth/access_token");
    expect(call?.[1]?.method).toBe("POST");
    expect(call?.[1]?.redirect).toBe("manual");
    expect(call?.[1]?.body).toBeInstanceOf(URLSearchParams);
    expect(String(call?.[1]?.body)).toContain(
      "redirect_uri=https%3A%2F%2Fv2.example%2Fauth%2Fcallback",
    );
  });
  it("preserves 64-bit numeric identifiers as exact strings without rounding", async () => {
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          access_token: "fake-token",
        }).replace("}", ',"user_id":17841405793187218}'),
      );
    const result = await createInstagramOAuthClient(
      config,
      fetcher,
    ).exchangeCode("fake-code");
    expect(result.userId).toBe("17841405793187218");
  });
  it("uses unversioned long-token and refresh endpoints, without automatic retry", async () => {
    const requests: string[] = [];
    const fetcher = async (url: string) => {
      requests.push(url);
      return Response.json({
        access_token: "fake-long-token",
        expires_in: 3600,
      });
    };
    const client = createInstagramOAuthClient(config, fetcher);
    await client.exchangeLongLivedToken("fake-short-token");
    await client.refreshToken("fake-long-token");
    expect(new URL(requests[0] ?? "").pathname).toBe("/access_token");
    expect(new URL(requests[1] ?? "").pathname).toBe("/refresh_access_token");
  });
  it("redacts provider failures and does not retry an uncertain code exchange", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("URL contains fake-secret and fake-code");
    });
    const client = createInstagramOAuthClient(config, fetcher);
    await expect(client.exchangeCode("fake-code")).rejects.toThrow(
      "Instagram OAuth request_failed",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized provider replies and missing token fields", async () => {
    const oversized = async () => new Response("a".repeat(32_769));
    await expect(
      createInstagramOAuthClient(config, oversized).exchangeCode("code"),
    ).rejects.toThrow("invalid_response");
    const missing = async () => Response.json({ user_id: "123" });
    await expect(
      createInstagramOAuthClient(config, missing).exchangeCode("code"),
    ).rejects.toThrow("invalid_response");
  });
});
