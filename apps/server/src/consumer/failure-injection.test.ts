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
    new URL("../../../../schema/0001_owner_and_accounts.sql", import.meta.url),
    "utf8",
  );
  const sql0002 = await readFile(
    new URL(
      "../../../../schema/0002_campaigns_and_deliveries.sql",
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

  // Setup workspace & account
  await db
    .prepare("INSERT INTO workspaces VALUES (?, ?, ?)")
    .bind("ws_fault", "owner_fault", now)
    .run();

  const vault = await createTokenVault(encryptionKey);
  const encryptedToken = await vault.seal("ACCESS_TOKEN_FAULT", "ig_fault_acc");

  await db
    .prepare(
      `INSERT INTO instagram_accounts (
        account_id, workspace_id, generation, status, token_ciphertext, token_expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "ig_fault_acc",
      "ws_fault",
      "gen_1",
      "connected",
      encryptedToken,
      now + 86400000,
      now,
    )
    .run();

  // Active campaign
  await db
    .prepare(
      `INSERT INTO campaigns (id, workspace_id, account_id, media_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "camp_fault",
      "ws_fault",
      "ig_fault_acc",
      "media_fault_1",
      "published",
      now,
      now,
    )
    .run();

  await db
    .prepare(
      `INSERT INTO campaign_revisions (id, campaign_id, match_mode, keywords_json, reply_template, resource_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "rev_fault",
      "camp_fault",
      "exact_keyword",
      JSON.stringify(["coupon", "save"]),
      "Here is your coupon!",
      "https://example.com/coupon",
      now,
    )
    .run();
});

afterAll(async () => {
  await runtime?.dispose();
});

describe("Consumer Failure & Crash Injection Harness", () => {
  const env = {
    APP_ENV: "test",
    DB: () => db,
    TOKEN_ENCRYPTION_KEY: encryptionKey,
    META_GRAPH_VERSION: "v23.0",
  };

  function createMockMessage(event: AutomationEvent, attempts = 1) {
    const ack = vi.fn();
    const retry = vi.fn();
    return {
      message: {
        id: "msg_fault_id",
        attempts,
        body: event,
        ack,
        retry,
      } as unknown as Message<AutomationEvent>,
      ack,
      retry,
    };
  }

  it("M1.1: recovers cleanly when isolate crashes before claim insert", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_fault_acc",
      providerEventKey: "comment:c_m1_1",
      mediaId: "media_fault_1",
      commentId: "c_m1_1",
      text: "coupon please",
      occurredAt: now,
      receivedAt: now,
    };

    // Attempt 1: Simulating crash before claim by throwing in an external fetcher or mock
    // Nothing was inserted into D1 delivery_claims
    const mockFetcher = vi.fn(async () =>
      Response.json({ message_id: "meta_msg_m1_1" }),
    );

    // Attempt 2: Queue redelivers
    const { message, ack, retry } = createMockMessage(event, 2);
    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher,
      now + 5000,
    );

    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    const claim = await db
      .prepare("SELECT * FROM delivery_claims WHERE action_key = ?")
      .bind("ig_fault_acc:c_m1_1")
      .first();
    expect(claim).toBeDefined();

    const outcome = await db
      .prepare("SELECT * FROM delivery_outcomes WHERE action_key = ?")
      .bind("ig_fault_acc:c_m1_1")
      .first<{ status: string }>();
    expect(outcome?.status).toBe("sent");
  });

  it("M1.2: recovers and dispatches when prior attempt claimed but crashed before sending to Meta", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_fault_acc",
      providerEventKey: "comment:c_m1_2",
      mediaId: "media_fault_1",
      commentId: "c_m1_2",
      text: "coupon please",
      occurredAt: now,
      receivedAt: now,
    };

    // Simulate crash after claim insert: claim row exists, but NO outcome exists
    await db
      .prepare(
        `INSERT INTO delivery_claims (
          action_key, workspace_id, account_id, comment_id, media_id, campaign_id, revision_id, claimed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "ig_fault_acc:c_m1_2",
        "ws_fault",
        "ig_fault_acc",
        "c_m1_2",
        "media_fault_1",
        "camp_fault",
        "rev_fault",
        now,
      )
      .run();

    const mockFetcher = vi.fn(async () =>
      Response.json({ message_id: "meta_msg_m1_2" }),
    );

    // Redelivery on attempt 2
    const { message, ack, retry } = createMockMessage(event, 2);
    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher,
      now + 10_000,
    );

    // Meta MUST be contacted because the first attempt never sent it
    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    const outcome = await db
      .prepare("SELECT * FROM delivery_outcomes WHERE action_key = ?")
      .bind("ig_fault_acc:c_m1_2")
      .first<{ status: string; provider_message_id: string }>();
    expect(outcome?.status).toBe("sent");
    expect(outcome?.provider_message_id).toBe("meta_msg_m1_2");
  });

  it("M1.3: handles crash after Meta accepts send, preventing duplicate delivery on redelivery", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_fault_acc",
      providerEventKey: "comment:c_m1_3",
      mediaId: "media_fault_1",
      commentId: "c_m1_3",
      text: "coupon please",
      occurredAt: now,
      receivedAt: now,
    };

    // First attempt claimed the delivery
    await db
      .prepare(
        `INSERT INTO delivery_claims (
          action_key, workspace_id, account_id, comment_id, media_id, campaign_id, revision_id, claimed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "ig_fault_acc:c_m1_3",
        "ws_fault",
        "ig_fault_acc",
        "c_m1_3",
        "media_fault_1",
        "camp_fault",
        "rev_fault",
        now,
      )
      .run();

    // On redelivery (attempt 2), Meta rejects because comment was already replied to on attempt 1 before the crash
    const mockFetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              message: "Comment has already been replied to",
              type: "OAuthException",
              code: 100,
              error_subcode: 2207008,
            },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    );

    const { message, ack, retry } = createMockMessage(event, 2);
    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher,
      now + 15_000,
    );

    // The consumer classifies permanent rejection as "failed" and acks, ensuring no infinite loop
    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    const outcome = await db
      .prepare("SELECT * FROM delivery_outcomes WHERE action_key = ?")
      .bind("ig_fault_acc:c_m1_3")
      .first<{ status: string; error_code: string }>();
    expect(outcome?.status).toBe("failed");
    expect(outcome?.error_code).toBe("100");
  });

  it("M1.4: recovers when crash occurs after outcome write but before Queue ack", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_fault_acc",
      providerEventKey: "comment:c_m1_4",
      mediaId: "media_fault_1",
      commentId: "c_m1_4",
      text: "coupon please",
      occurredAt: now,
      receivedAt: now,
    };

    // Both claim and outcome already in DB
    await db
      .prepare(
        `INSERT INTO delivery_claims (
          action_key, workspace_id, account_id, comment_id, media_id, campaign_id, revision_id, claimed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "ig_fault_acc:c_m1_4",
        "ws_fault",
        "ig_fault_acc",
        "c_m1_4",
        "media_fault_1",
        "camp_fault",
        "rev_fault",
        now,
      )
      .run();

    await db
      .prepare(
        `INSERT INTO delivery_outcomes (
          id, action_key, workspace_id, account_id, status, provider_message_id, attempt_count, occurred_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "out_m1_4",
        "ig_fault_acc:c_m1_4",
        "ws_fault",
        "ig_fault_acc",
        "sent",
        "meta_msg_m1_4",
        1,
        now,
      )
      .run();

    // Redelivery arrives because ack was missed on attempt 1
    const mockFetcher = vi.fn();
    const { message, ack, retry } = createMockMessage(event, 2);

    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher,
      now + 20_000,
    );

    // Meta API must NOT be called; message should be immediately acked
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it("M1.5: drops message when 7-day window expires during retry attempts", async () => {
    // Comment occurred 6 days and 23.5 hours ago
    const almostExpiredTime = now - (6 * 24 + 23.5) * 60 * 60 * 1000;
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_fault_acc",
      providerEventKey: "comment:c_m1_5",
      mediaId: "media_fault_1",
      commentId: "c_m1_5",
      text: "coupon please",
      occurredAt: almostExpiredTime,
      receivedAt: now,
    };

    const mockFetcher = vi.fn();

    // Attempt 2 happens after the 7-day mark (+ 2 hours later)
    const afterSevenDays = now + 2 * 60 * 60 * 1000;
    const { message, ack, retry } = createMockMessage(event, 2);

    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher,
      afterSevenDays,
    );

    // Dropped without calling Meta
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });
});
