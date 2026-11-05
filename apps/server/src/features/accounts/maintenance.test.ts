import { readFile } from "node:fs/promises";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ServerEnvironment } from "../../environment";
import { refreshExpiringTokens } from "./maintenance";
import { createAccountStore } from "./storage";

const ownerId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "ws_maintenance_test";
const encryptionKey = "jx0jMSTagqboGF8N1boWJ2N3v65Yrg58ddLmtiKO14Q";
const now = 1700000000000;

let runtime: Miniflare;
let db: D1Database;

beforeAll(async () => {
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("test"); } }',
      d1Databases: ["DB"],
      compatibilityDate: "2026-01-01",
    }),
  );
  db = (await runtime.getD1Database("DB")) as unknown as D1Database;
  const schema = await readFile(
    new URL(
      "../../../../../schema/0001_owner_and_accounts.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.batch(
    schema
      .split(";")
      .map((sql) => sql.trim())
      .filter(Boolean)
      .map((sql) => db.prepare(sql)),
  );

  await db
    .prepare("INSERT INTO workspaces VALUES (?, ?, ?)")
    .bind(workspaceId, ownerId, now)
    .run();
});

afterAll(async () => {
  await runtime.dispose();
});

describe("Automated Token Refresh Cron (Anti-Disconnect)", () => {
  it("refreshes accounts expiring in <= 15 days and updates sealed token", async () => {
    const store = createAccountStore(db, encryptionKey);

    // 1. Account expiring in 5 days (should be refreshed)
    const fiveDaysMs = 5 * 86_400 * 1000;
    await store.connect({
      workspaceId,
      accountId: "acc_expiring_soon",
      accessToken: "old-short-or-long-token-1",
      expiresAt: now + fiveDaysMs,
      now,
    });

    // 2. Account expiring in 40 days (should NOT be refreshed)
    const fortyDaysMs = 40 * 86_400 * 1000;
    await store.connect({
      workspaceId,
      accountId: "acc_plenty_of_time",
      accessToken: "healthy-token-2",
      expiresAt: now + fortyDaysMs,
      now,
    });

    const mockFetcher = vi.fn(async (url: string) => {
      expect(url).toContain("https://graph.instagram.com/refresh_access_token");
      return Response.json({
        access_token: "brand-new-refreshed-token",
        token_type: "bearer",
        expires_in: 5184000, // 60 days
      });
    });

    const env = {
      DB: db,
      META_APP_ID: "123456",
      META_APP_SECRET: "test_secret",
      META_REDIRECT_URI: "https://test.example/auth/callback",
      TOKEN_ENCRYPTION_KEY: encryptionKey,
    } as unknown as ServerEnvironment;

    const result = await refreshExpiringTokens(
      env,
      now,
      mockFetcher as unknown as typeof fetch,
    );

    expect(result.checked).toBe(1);
    expect(result.refreshed).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockFetcher).toHaveBeenCalledTimes(1);

    // Verify token was updated in database
    const refreshedCred = await store.readCredential(
      workspaceId,
      "acc_expiring_soon",
      now,
    );
    expect(refreshedCred?.accessToken).toBe("brand-new-refreshed-token");
    expect(refreshedCred?.expiresAt).toBe(now + 5184000 * 1000);

    // Verify the healthy account was not modified
    const untouchedCred = await store.readCredential(
      workspaceId,
      "acc_plenty_of_time",
      now,
    );
    expect(untouchedCred?.accessToken).toBe("healthy-token-2");
    expect(untouchedCred?.expiresAt).toBe(now + fortyDaysMs);
  });

  it("handles provider failure gracefully without crashing the maintenance loop", async () => {
    const store = createAccountStore(db, encryptionKey);
    await store.connect({
      workspaceId,
      accountId: "acc_fail_refresh",
      accessToken: "revoked-token",
      expiresAt: now + 86_400 * 1000, // 1 day
      now,
    });

    const mockFailingFetcher = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { message: "Invalid OAuth token" } }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        },
      );
    });

    const env = {
      DB: db,
      META_APP_ID: "123456",
      META_APP_SECRET: "test_secret",
      META_REDIRECT_URI: "https://test.example/auth/callback",
      TOKEN_ENCRYPTION_KEY: encryptionKey,
    } as unknown as ServerEnvironment;

    const result = await refreshExpiringTokens(
      env,
      now,
      mockFailingFetcher as unknown as typeof fetch,
    );

    expect(result.failed).toBeGreaterThanOrEqual(1);
  });
});
