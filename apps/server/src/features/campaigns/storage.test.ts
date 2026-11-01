import { readFile } from "node:fs/promises";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCampaignStore } from "./storage";

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

  const sql0001 = await readFile(
    new URL(
      "../../../../../schema/0001_owner_and_accounts.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const sql0002 = await readFile(
    new URL(
      "../../../../../schema/0002_campaigns_and_deliveries.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const sql0003 = await readFile(
    new URL(
      "../../../../../schema/0003_campaign_confirmation_flow.sql",
      import.meta.url,
    ),
    "utf8",
  );

  const applySql = async (sql: string) => {
    // Strip comments
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
  await applySql(sql0003);

  // Set up workspace & connected Instagram account
  await db
    .prepare(
      "INSERT INTO workspaces (id, owner_id, created_at) VALUES (?, ?, ?)",
    )
    .bind("ws_1", "owner_1", now)
    .run();

  await db
    .prepare(
      `INSERT INTO instagram_accounts (
        account_id, workspace_id, generation, status, token_ciphertext, token_expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "ig_acc_1",
      "ws_1",
      "gen_1",
      "connected",
      "enc_token",
      now + 100000,
      now,
    )
    .run();
});

afterAll(async () => {
  await runtime?.dispose();
});

describe("Campaign and delivery D1 storage", () => {
  it("enforces at most ONE published campaign per post/media via database index", async () => {
    // Insert first campaign
    await db
      .prepare(
        "INSERT INTO campaigns (id, workspace_id, account_id, media_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind("camp_1", "ws_1", "ig_acc_1", "media_100", "published", now, now)
      .run();

    // Insert second campaign on same media but paused - should SUCCEED
    await expect(
      db
        .prepare(
          "INSERT INTO campaigns (id, workspace_id, account_id, media_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("camp_2", "ws_1", "ig_acc_1", "media_100", "paused", now, now)
        .run(),
    ).resolves.toBeDefined();

    // Insert another campaign on same media as published - must FAIL with unique constraint
    await expect(
      db
        .prepare(
          "INSERT INTO campaigns (id, workspace_id, account_id, media_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind("camp_3", "ws_1", "ig_acc_1", "media_100", "published", now, now)
        .run(),
    ).rejects.toThrow();
  });

  it("finds active published campaign and its latest revision", async () => {
    // Add revisions
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
        JSON.stringify(["discount"]),
        "Old template",
        null,
        now - 100,
      )
      .run();

    await db
      .prepare(
        `INSERT INTO campaign_revisions (
          id, campaign_id, match_mode, keywords_json, reply_template, resource_url, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "rev_2",
        "camp_1",
        "exact_keyword",
        JSON.stringify(["coupon", "promo"]),
        "New template: https://link.me",
        "https://link.me",
        now,
      )
      .run();

    const store = createCampaignStore(db);
    const result = await store.findActiveCampaignForMedia(
      "ig_acc_1",
      "media_100",
    );

    expect(result).not.toBeNull();
    expect(result?.campaign.id).toBe("camp_1");
    expect(result?.revision.id).toBe("rev_2");
    expect(result?.revision.keywords).toEqual(["coupon", "promo"]);
    expect(result?.revision.replyTemplate).toBe(
      "New template: https://link.me",
    );
  });

  it("atomically claims a comment once and rejects duplicate claims", async () => {
    const store = createCampaignStore(db);
    const claim = {
      actionKey: "ig_acc_1:comment_999",
      workspaceId: "ws_1",
      accountId: "ig_acc_1",
      commentId: "comment_999",
      mediaId: "media_100",
      campaignId: "camp_1",
      revisionId: "rev_2",
      claimedAt: now,
    };

    // First claim should succeed
    const firstClaim = await store.claimDelivery(claim);
    expect(firstClaim).toBe(true);

    // Duplicate claim on same comment must return false (idempotent no-op)
    const secondClaim = await store.claimDelivery(claim);
    expect(secondClaim).toBe(false);

    // Record outcome
    await expect(
      store.recordOutcome({
        id: "outcome_1",
        actionKey: claim.actionKey,
        workspaceId: "ws_1",
        accountId: "ig_acc_1",
        status: "sent",
        providerMessageId: "meta_msg_123",
        attemptCount: 1,
        occurredAt: now,
      }),
    ).resolves.toBeUndefined();
  });

  it("updates campaign revision and status", async () => {
    const store = createCampaignStore(db);

    const found = await store.findCampaignById("camp_1", "ws_1");
    expect(found).not.toBeNull();
    expect(found?.campaign.id).toBe("camp_1");

    const updated = await store.updateCampaign({
      campaignId: "camp_1",
      workspaceId: "ws_1",
      status: "paused",
      revision: {
        matchMode: "any_comment",
        keywords: [],
        replyTemplate: "Updated reply template here",
        resourceUrl: "https://newsite.com/resource",
        confirmationButtonEnabled: true,
        confirmationButtonText: "Get Access",
        confirmationPromptText: "Click below!",
      },
      now: now + 5000,
    });

    expect(updated).not.toBeNull();
    expect(updated?.campaign.status).toBe("paused");
    expect(updated?.revision.matchMode).toBe("any_comment");
    expect(updated?.revision.replyTemplate).toBe("Updated reply template here");
    expect(updated?.revision.resourceUrl).toBe("https://newsite.com/resource");
    expect(updated?.revision.confirmationButtonText).toBe("Get Access");

    // Verify it persists in D1
    const refetched = await store.findCampaignById("camp_1", "ws_1");
    expect(refetched?.campaign.status).toBe("paused");
    expect(refetched?.revision.replyTemplate).toBe(
      "Updated reply template here",
    );
  });

  it("deletes campaign and cascades to revisions and claims", async () => {
    const store = createCampaignStore(db);

    const deleted = await store.deleteCampaign("camp_1", "ws_1");
    expect(deleted).toBe(true);

    const found = await store.findCampaignById("camp_1", "ws_1");
    expect(found).toBeNull();

    // Verify cascade: campaign_revisions for camp_1 should be 0
    const revs = await db
      .prepare(
        "SELECT count(*) as cnt FROM campaign_revisions WHERE campaign_id = ?",
      )
      .bind("camp_1")
      .first<{ cnt: number }>();
    expect(revs?.cnt).toBe(0);

    // Verify cascade: delivery_claims for camp_1 should be 0
    const claims = await db
      .prepare(
        "SELECT count(*) as cnt FROM delivery_claims WHERE campaign_id = ?",
      )
      .bind("camp_1")
      .first<{ cnt: number }>();
    expect(claims?.cnt).toBe(0);
  });
});
