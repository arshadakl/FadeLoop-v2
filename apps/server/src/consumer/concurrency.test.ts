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
    .bind("ws_concur", "owner_concur", now)
    .run();

  const vault = await createTokenVault(encryptionKey);
  const encryptedToken = await vault.seal(
    "ACCESS_TOKEN_CONCUR",
    "ig_concur_acc",
  );

  await db
    .prepare(
      `INSERT INTO instagram_accounts (
        account_id, workspace_id, generation, status, token_ciphertext, token_expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "ig_concur_acc",
      "ws_concur",
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
      "camp_concur_1",
      "ws_concur",
      "ig_concur_acc",
      "media_concur_100",
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
      "rev_concur_1",
      "camp_concur_1",
      "exact_keyword",
      JSON.stringify(["discount", "deal"]),
      "Here is your 20% off discount!",
      "https://example.com/discount",
      now,
    )
    .run();
});

afterAll(async () => {
  await runtime?.dispose();
});

describe("Consumer Concurrency & Contention Guardrails", () => {
  const env = {
    APP_ENV: "test",
    DB: () => db,
    TOKEN_ENCRYPTION_KEY: encryptionKey,
    META_GRAPH_VERSION: "v23.0",
  };

  function createMockMessage(event: AutomationEvent, id: string) {
    const ack = vi.fn();
    const retry = vi.fn();
    return {
      message: {
        id,
        attempts: 1,
        body: event,
        ack,
        retry,
      } as unknown as Message<AutomationEvent>,
      ack,
      retry,
    };
  }

  it("M2.1: resolves 5 simultaneous duplicate deliveries with exactly ONE Meta send", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_concur_acc",
      providerEventKey: "comment:c_race_1",
      mediaId: "media_concur_100",
      commentId: "c_race_1",
      text: "send discount please",
      occurredAt: now,
      receivedAt: now,
    };

    let sendCount = 0;
    const mockFetcher = vi.fn(async () => {
      sendCount++;
      return Response.json({ message_id: `meta_msg_concur_${sendCount}` });
    });

    // Create 5 concurrent workers processing the same comment simultaneously
    const workers = Array.from({ length: 5 }, (_, i) =>
      createMockMessage(event, `msg_worker_${i + 1}`),
    );

    // Launch all 5 simultaneously
    await Promise.all(
      workers.map((w) =>
        processQueueMessage(w.message, { ...env, DB: db }, mockFetcher, now),
      ),
    );

    // CRITICAL ASSERTION: Exactly ONE call was made to Meta Graph API
    expect(sendCount).toBe(1);
    expect(mockFetcher).toHaveBeenCalledTimes(1);

    // All 5 messages must have been safely acknowledged (1 winner, 4 already claimed)
    for (const w of workers) {
      expect(w.ack).toHaveBeenCalledTimes(1);
      expect(w.retry).not.toHaveBeenCalled();
    }

    // Verify D1 records
    const claims = await db
      .prepare("SELECT * FROM delivery_claims WHERE action_key = ?")
      .bind("ig_concur_acc:c_race_1")
      .all();
    expect(claims.results).toHaveLength(1);

    const outcomes = await db
      .prepare("SELECT * FROM delivery_outcomes WHERE action_key = ?")
      .bind("ig_concur_acc:c_race_1")
      .all();
    expect(outcomes.results).toHaveLength(1);
  });

  it("M2.2: drops message safely when creator pauses campaign during queue flight", async () => {
    // 1. Setup a dedicated campaign that starts as published
    await db
      .prepare(
        `INSERT INTO campaigns (id, workspace_id, account_id, media_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "camp_pause_test",
        "ws_concur",
        "ig_concur_acc",
        "media_pause_200",
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
        "rev_pause_test",
        "camp_pause_test",
        "exact_keyword",
        JSON.stringify(["deal"]),
        "Deal reply text",
        null,
        now,
      )
      .run();

    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_concur_acc",
      providerEventKey: "comment:c_paused_1",
      mediaId: "media_pause_200",
      commentId: "c_paused_1",
      text: "give me the deal",
      occurredAt: now,
      receivedAt: now,
    };

    // 2. Creator pauses campaign right before consumer picks up the message
    await db
      .prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?")
      .bind("camp_pause_test")
      .run();

    const mockFetcher = vi.fn();
    const { message, ack, retry } = createMockMessage(event, "msg_paused");

    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher,
      now + 1000,
    );

    // Meta API is NEVER called for paused campaigns
    expect(mockFetcher).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    // No claim or outcome was recorded in D1
    const claim = await db
      .prepare("SELECT * FROM delivery_claims WHERE action_key = ?")
      .bind("ig_concur_acc:c_paused_1")
      .first();
    expect(claim).toBeNull();
  });

  it("M2.3: partial unique index blocks concurrent published campaigns on the same media", async () => {
    // Attempting to publish another campaign for the existing media_concur_100
    const insertAttempt = db
      .prepare(
        `INSERT INTO campaigns (id, workspace_id, account_id, media_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "camp_duplicate_media",
        "ws_concur",
        "ig_concur_acc",
        "media_concur_100",
        "published",
        now,
        now,
      )
      .run();

    // Must be rejected by unique index idx_campaigns_published_media
    await expect(insertAttempt).rejects.toThrow(/UNIQUE|constraint/i);
  });
});
