import { readFile } from "node:fs/promises";
import type { AutomationEvent } from "@fadeloop/contracts/events";
import { createTokenVault } from "@fadeloop/worker-common/meta/token-vault";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { processQueueMessage } from "./processor";

const now = 1700000000000;
const encryptionKey = "jx0jMSTagqboGF8N1boWJ2N3v65Yrg58ddLmtiKO14Q";
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

  const sql0001 = await readFile(
    new URL("../../../schema/0001_owner_and_accounts.sql", import.meta.url),
    "utf8",
  );
  const sql0002 = await readFile(
    new URL(
      "../../../schema/0002_campaigns_and_deliveries.sql",
      import.meta.url,
    ),
    "utf8",
  );

  const applySql = async (sql: string) => {
    const cleanSql = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    const stmts = cleanSql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    if (stmts.length > 0) {
      await db.batch(stmts.map((s) => db.prepare(s)));
    }
  };

  await applySql(sql0001);
  await applySql(sql0002);

  // Set up workspace & connected Instagram account with encrypted token
  await db
    .prepare(
      "INSERT INTO workspaces (id, owner_id, created_at) VALUES (?, ?, ?)",
    )
    .bind("ws_consumer", "owner_consumer", now)
    .run();

  const vault = await createTokenVault(encryptionKey);
  const encryptedToken = await vault.seal(
    "REAL_ACCESS_TOKEN_XYZ",
    "ig_acc_consumer",
  );

  await db
    .prepare(
      `INSERT INTO instagram_accounts (
        account_id, workspace_id, generation, status, token_ciphertext, token_expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "ig_acc_consumer",
      "ws_consumer",
      "gen_1",
      "connected",
      encryptedToken,
      now + 86400000,
      now,
    )
    .run();

  // Create active published campaign with keyword 'guide'
  await db
    .prepare(
      `INSERT INTO campaigns (
        id, workspace_id, account_id, media_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "camp_1",
      "ws_consumer",
      "ig_acc_consumer",
      "media_reel_100",
      "published",
      now,
      now,
    )
    .run();

  await db
    .prepare(
      `INSERT INTO campaign_revisions (
        id, campaign_id, match_mode, keywords_json, reply_template, resource_url, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "rev_1",
      "camp_1",
      "exact_keyword",
      JSON.stringify(["guide", "link"]),
      "Here is your free guide!",
      "https://example.com/guide.pdf",
      now,
    )
    .run();
});

afterAll(async () => {
  await runtime?.dispose();
});

describe("Consumer Queue message processing", () => {
  const env = {
    APP_ENV: "test",
    DB: () => db, // getter
    TOKEN_ENCRYPTION_KEY: encryptionKey,
    META_GRAPH_VERSION: "v23.0",
  };

  function createMockMessage(event: AutomationEvent, attempts = 1) {
    const ack = vi.fn();
    const retry = vi.fn();
    return {
      message: {
        id: "msg_test_id",
        attempts,
        body: event,
        ack,
        retry,
      } as unknown as Message<AutomationEvent>,
      ack,
      retry,
    };
  }

  it("successfully processes matching comment, sends reply, records outcome, and acks message", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_acc_consumer",
      providerEventKey: "comment:c_success_1",
      mediaId: "media_reel_100",
      commentId: "c_success_1",
      text: "please send me the guide",
      occurredAt: now,
      receivedAt: now,
    };

    const mockFetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.recipient.comment_id).toBe("c_success_1");
      expect(body.message.text).toContain("https://example.com/guide.pdf");
      return Response.json({ message_id: "meta_msg_999" });
    });

    const { message, ack, retry } = createMockMessage(event);
    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher as unknown as typeof fetch,
      now,
    );

    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    // Verify D1 records
    const claim = await db
      .prepare("SELECT * FROM delivery_claims WHERE action_key = ?")
      .bind("ig_acc_consumer:c_success_1")
      .first();
    expect(claim).toBeDefined();

    const outcome = await db
      .prepare("SELECT * FROM delivery_outcomes WHERE action_key = ?")
      .bind("ig_acc_consumer:c_success_1")
      .first<{ status: string; provider_message_id: string }>();
    expect(outcome?.status).toBe("sent");
    expect(outcome?.provider_message_id).toBe("meta_msg_999");
  });

  it("does not send duplicate reply if comment was already claimed (idempotent)", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_acc_consumer",
      providerEventKey: "comment:c_success_1", // already claimed above!
      mediaId: "media_reel_100",
      commentId: "c_success_1",
      text: "please send me the guide",
      occurredAt: now,
      receivedAt: now,
    };

    const mockFetcher = vi.fn();
    const { message, ack, retry } = createMockMessage(event);

    await processQueueMessage(message, { ...env, DB: db }, mockFetcher, now);

    // Meta API must NOT be called again
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("ignores comments that do not match keywords without contacting Meta", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_acc_consumer",
      providerEventKey: "comment:c_unrelated",
      mediaId: "media_reel_100",
      commentId: "c_unrelated",
      text: "awesome post love this",
      occurredAt: now,
      receivedAt: now,
    };

    const mockFetcher = vi.fn();
    const { message, ack } = createMockMessage(event);

    await processQueueMessage(message, { ...env, DB: db }, mockFetcher, now);

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it("drops comments older than 7 days per Meta private reply window", async () => {
    const eightDaysAgo = now - 8 * 24 * 60 * 60 * 1000;
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_acc_consumer",
      providerEventKey: "comment:c_expired",
      mediaId: "media_reel_100",
      commentId: "c_expired",
      text: "guide please",
      occurredAt: eightDaysAgo,
      receivedAt: now,
    };

    const mockFetcher = vi.fn();
    const { message, ack } = createMockMessage(event);

    await processQueueMessage(message, { ...env, DB: db }, mockFetcher, now);

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it("retries with backoff on 429 Meta rate limit", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_acc_consumer",
      providerEventKey: "comment:c_ratelimit",
      mediaId: "media_reel_100",
      commentId: "c_ratelimit",
      text: "guide please",
      occurredAt: now,
      receivedAt: now,
    };

    const mockFetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { message: "Too many calls", code: 613 } }),
          {
            status: 429,
            headers: {
              "retry-after": "45",
              "content-type": "application/json",
            },
          },
        ),
    );

    const { message, ack, retry } = createMockMessage(event, 1);
    await processQueueMessage(message, { ...env, DB: db }, mockFetcher, now);

    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(ack).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith({ delaySeconds: 45 });
  });

  it("marks outcome as unknown and acks on network timeout (no blind retry)", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_acc_consumer",
      providerEventKey: "comment:c_timeout",
      mediaId: "media_reel_100",
      commentId: "c_timeout",
      text: "guide please",
      occurredAt: now,
      receivedAt: now,
    };

    const mockFetcher = vi.fn(async () => {
      throw new Error("ETIMEDOUT");
    });

    const { message, ack, retry } = createMockMessage(event, 1);
    await processQueueMessage(message, { ...env, DB: db }, mockFetcher, now);

    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    const outcome = await db
      .prepare("SELECT * FROM delivery_outcomes WHERE action_key = ?")
      .bind("ig_acc_consumer:c_timeout")
      .first<{ status: string }>();
    expect(outcome?.status).toBe("unknown");
  });
});
