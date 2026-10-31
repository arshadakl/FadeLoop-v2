import { readFile } from "node:fs/promises";
import type { AutomationEvent } from "@fadeloop/contracts/events";
import type { QueryMetric } from "@fadeloop/worker-common/database";
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

  // Setup workspace & account
  await db
    .prepare("INSERT INTO workspaces VALUES (?, ?, ?)")
    .bind("ws_metered", "owner_metered", now)
    .run();

  const vault = await createTokenVault(encryptionKey);
  const encryptedToken = await vault.seal(
    "ACCESS_TOKEN_METERED",
    "ig_metered_acc",
  );

  await db
    .prepare(
      `INSERT INTO instagram_accounts (
        account_id, workspace_id, generation, status, token_ciphertext, token_expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "ig_metered_acc",
      "ws_metered",
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
      "camp_metered_1",
      "ws_metered",
      "ig_metered_acc",
      "media_metered_100",
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
      "rev_metered_1",
      "camp_metered_1",
      "exact_keyword",
      JSON.stringify(["ebook", "free"]),
      "Here is your free ebook!",
      "https://example.com/ebook.pdf",
      now,
    )
    .run();

  // Seed 100 unrelated delivery rows to verify queries remain bounded
  for (let i = 0; i < 100; i++) {
    await db
      .prepare(
        `INSERT INTO delivery_claims (
          action_key, workspace_id, account_id, comment_id, media_id, campaign_id, revision_id, claimed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `unrelated_acc:c_${i}`,
        "ws_metered",
        "unrelated_acc",
        `c_${i}`,
        "media_metered_100",
        "camp_metered_1",
        "rev_metered_1",
        now - i * 1000,
      )
      .run();
  }
});

afterAll(async () => {
  await runtime?.dispose();
});

describe("P07 Metered D1 Accounting & Free-Tier Quota Proof", () => {
  const env = {
    APP_ENV: "test",
    DB: () => db,
    TOKEN_ENCRYPTION_KEY: encryptionKey,
    META_GRAPH_VERSION: "v23.0",
  };

  function createMockMessage(event: AutomationEvent) {
    const ack = vi.fn();
    const retry = vi.fn();
    return {
      message: {
        id: "msg_metered",
        attempts: 1,
        body: event,
        ack,
        retry,
      } as unknown as Message<AutomationEvent>,
      ack,
      retry,
    };
  }

  it("Class A: non-matching comment consumes exactly 1 read and 0 writes", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_metered_acc",
      providerEventKey: "comment:c_nonmatch",
      mediaId: "media_metered_100",
      commentId: "c_nonmatch",
      text: "unrelated text with no keywords",
      occurredAt: now,
      receivedAt: now,
    };

    const metrics: QueryMetric[] = [];
    const observer = (m: QueryMetric) => metrics.push(m);

    const mockFetcher = vi.fn();
    const { message, ack } = createMockMessage(event);

    const start = performance.now();
    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher,
      now,
      observer,
    );
    const elapsed = performance.now() - start;

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);

    // Assert exact metered D1 quota
    const totalReads = metrics.reduce((sum, m) => sum + m.rowsRead, 0);
    const totalWrites = metrics.reduce((sum, m) => sum + m.rowsWritten, 0);

    // 1 campaign row + 1 revision row read via JOIN = 2 rows read, 0 written
    expect(totalReads).toBe(2);
    expect(totalWrites).toBe(0);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.queryId).toBe("campaigns.find_active_for_media");

    console.info(
      `Class A Non-match: ${totalReads} reads, ${totalWrites} writes, elapsed: ${elapsed.toFixed(2)}ms`,
    );
  });

  it("Class B: matching comment delivery consumes exactly 4 reads and 6 writes (including index amplification & FK check)", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_metered_acc",
      providerEventKey: "comment:c_matched_1",
      mediaId: "media_metered_100",
      commentId: "c_matched_1",
      text: "please send the free ebook",
      occurredAt: now,
      receivedAt: now,
    };

    const metrics: QueryMetric[] = [];
    const observer = (m: QueryMetric) => metrics.push(m);

    const mockFetcher = vi.fn(async () =>
      Response.json({ message_id: "meta_msg_metered_1" }),
    );
    const { message, ack } = createMockMessage(event);

    const start = performance.now();
    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher,
      now,
      observer,
    );
    const elapsed = performance.now() - start;

    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);

    const totalReads = metrics.reduce((sum, m) => sum + m.rowsRead, 0);
    const totalWrites = metrics.reduce((sum, m) => sum + m.rowsWritten, 0);

    // Exact D1 accounting verified:
    // 1. campaigns.find_active_for_media: rowsRead = 2 (campaign + revision JOIN), rowsWritten = 0
    // 2. accounts.find_connected: rowsRead = 1, rowsWritten = 0
    // 3. deliveries.claim_insert: rowsRead = 0, rowsWritten = 3 (1 row + 2 indexes)
    // 4. deliveries.outcome_insert: rowsRead = 1 (FK validation), rowsWritten = 3 (1 row + 2 indexes)
    expect(totalReads).toBe(4);
    expect(totalWrites).toBe(6);
    expect(metrics).toHaveLength(4);

    console.info(
      `Class B Match Send: ${totalReads} reads, ${totalWrites} writes, elapsed: ${elapsed.toFixed(2)}ms`,
    );
  });

  it("Class C: duplicate comment replay consumes 0 writes even with 100 unrelated history rows", async () => {
    const event: AutomationEvent = {
      schemaVersion: 1,
      kind: "comment.created",
      accountId: "ig_metered_acc",
      providerEventKey: "comment:c_matched_1", // already claimed above!
      mediaId: "media_metered_100",
      commentId: "c_matched_1",
      text: "please send the free ebook",
      occurredAt: now,
      receivedAt: now,
    };

    const metrics: QueryMetric[] = [];
    const observer = (m: QueryMetric) => metrics.push(m);

    const mockFetcher = vi.fn();
    const { message, ack } = createMockMessage(event);

    await processQueueMessage(
      message,
      { ...env, DB: db },
      mockFetcher,
      now,
      observer,
    );

    expect(mockFetcher).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);

    const totalWrites = metrics.reduce((sum, m) => sum + m.rowsWritten, 0);
    expect(totalWrites).toBe(0);

    // Bounded reads even with 100 prior claims
    const claimInsertMetric = metrics.find(
      (m) => m.queryId === "deliveries.claim_insert",
    );
    expect(claimInsertMetric).toBeUndefined(); // Throws on unique constraint before recording success
  });
});
