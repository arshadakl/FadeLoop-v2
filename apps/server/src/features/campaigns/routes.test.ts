import { readFile } from "node:fs/promises";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sessionCookie, sessionDigest } from "../owner/session";
import { createOwnerStore } from "../owner/storage";
import {
  handleCampaignItem,
  handleCampaigns,
  handleDeliveries,
} from "./routes";

const ownerId = "33333333-3333-4333-8333-333333333333";
const workspaceId = "ws_campaign_routes_test";
const sessionToken = "y".repeat(43);
const now = 1700000000000;

let runtime: Miniflare;
let db: D1Database;

const env = {
  DB: () => db,
  APP_ORIGIN: "https://v2.test",
};

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

  // Setup workspace, account, and owner session
  await db
    .prepare("INSERT INTO workspaces VALUES (?, ?, ?)")
    .bind(workspaceId, ownerId, now)
    .run();

  await db
    .prepare(
      `INSERT INTO instagram_accounts (
        account_id, workspace_id, generation, status, token_ciphertext, token_expires_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      "ig_acc_camp_test",
      workspaceId,
      "gen_1",
      "connected",
      "v1.dummy.cipher",
      now + 86400000,
      now,
    )
    .run();

  const ownerStore = createOwnerStore(db);
  await ownerStore.createSession({
    digest: await sessionDigest(sessionToken),
    workspaceId,
    now,
    expiresAt: now + 3600_000,
  });
}, 30_000);

afterAll(async () => {
  await runtime?.dispose();
});

describe("Campaigns & Deliveries Routes", () => {
  it("creates a campaign with revision, enforcing CSRF origin check and schema", async () => {
    // 1. Missing Origin rejected
    const noOriginReq = new Request("https://v2.test/api/campaigns", {
      method: "POST",
      headers: {
        cookie: sessionCookie(sessionToken, 3600, true),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        accountId: "ig_acc_camp_test",
        mediaId: "post_100",
        replyTemplate: "Check your DMs!",
      }),
    });
    const noOriginRes = await handleCampaigns(
      noOriginReq,
      { ...env, DB: db },
      now,
    );
    expect(noOriginRes.status).toBe(403);

    // 2. Valid creation with trusted Origin
    const validReq = new Request("https://v2.test/api/campaigns", {
      method: "POST",
      headers: {
        origin: "https://v2.test",
        cookie: sessionCookie(sessionToken, 3600, true),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        accountId: "ig_acc_camp_test",
        mediaId: "post_100",
        status: "published",
        matchMode: "exact_keyword",
        keywords: ["PROMO", " guide "], // will be normalized to lowercase
        replyTemplate: "Here is your VIP link!",
        resourceUrl: "https://example.com/vip",
      }),
    });

    const validRes = await handleCampaigns(validReq, { ...env, DB: db }, now);
    expect(validRes.status).toBe(201);
    const body = (await validRes.json()) as {
      campaign: { id: string };
      revision: { keywords: string[] };
    };
    expect(body.campaign.id).toBeDefined();
    expect(body.revision.keywords).toEqual(["promo", "guide"]);

    // 3. Duplicate published campaign on same mediaId fails with 409 Conflict
    const dupReq = new Request("https://v2.test/api/campaigns", {
      method: "POST",
      headers: {
        origin: "https://v2.test",
        cookie: sessionCookie(sessionToken, 3600, true),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        accountId: "ig_acc_camp_test",
        mediaId: "post_100",
        status: "published",
        matchMode: "exact_keyword",
        keywords: ["other"],
        replyTemplate: "Another reply",
      }),
    });
    const dupRes = await handleCampaigns(dupReq, { ...env, DB: db }, now);
    expect(dupRes.status).toBe(409);
  });

  it("lists workspace campaigns with cursor pagination", async () => {
    const req = new Request("https://v2.test/api/campaigns", {
      headers: {
        cookie: sessionCookie(sessionToken, 3600, true),
      },
    });

    const res = await handleCampaigns(req, { ...env, DB: db }, now);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      campaigns: Array<{ campaign: { mediaId: string } }>;
    };
    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0]?.campaign.mediaId).toBe("post_100");
  });

  it("updates campaign status from published to paused", async () => {
    // List campaign to get ID
    const listReq = new Request("https://v2.test/api/campaigns", {
      headers: { cookie: sessionCookie(sessionToken, 3600, true) },
    });
    const listRes = await handleCampaigns(listReq, { ...env, DB: db }, now);
    const { campaigns } = (await listRes.json()) as {
      campaigns: Array<{ campaign: { id: string } }>;
    };
    const firstCamp = campaigns[0];
    expect(firstCamp).toBeDefined();
    const campId = firstCamp?.campaign.id ?? "";

    // Update status
    const updateReq = new Request(`https://v2.test/api/campaigns/${campId}`, {
      method: "PUT",
      headers: {
        origin: "https://v2.test",
        cookie: sessionCookie(sessionToken, 3600, true),
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "paused" }),
    });

    const updateRes = await handleCampaignItem(
      updateReq,
      campId,
      { ...env, DB: db },
      now + 1000,
    );
    expect(updateRes.status).toBe(200);
    expect(await updateRes.json()).toMatchObject({
      success: true,
      status: "paused",
    });
  });

  it("updates campaign revision settings via PUT", async () => {
    const listReq = new Request("https://v2.test/api/campaigns", {
      headers: { cookie: sessionCookie(sessionToken, 3600, true) },
    });
    const listRes = await handleCampaigns(listReq, { ...env, DB: db }, now);
    const { campaigns } = (await listRes.json()) as {
      campaigns: Array<{ campaign: { id: string }; revision: { id: string } }>;
    };
    const campId = campaigns[0]?.campaign.id ?? "";

    const editReq = new Request(`https://v2.test/api/campaigns/${campId}`, {
      method: "PUT",
      headers: {
        origin: "https://v2.test",
        cookie: sessionCookie(sessionToken, 3600, true),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        status: "published",
        matchMode: "exact_keyword",
        keywords: ["updated", "keyword"],
        replyTemplate: "Updated reply message here",
        resourceUrl: "https://example.com/updated",
        confirmationButtonEnabled: true,
        confirmationButtonText: "Claim Now",
      }),
    });

    const editRes = await handleCampaignItem(
      editReq,
      campId,
      { ...env, DB: db },
      now + 2000,
    );
    expect(editRes.status).toBe(200);
    const editJson = (await editRes.json()) as {
      success: boolean;
      status: string;
      campaign: { status: string };
      revision: {
        keywords: string[];
        replyTemplate: string;
        confirmationButtonText: string;
      };
    };
    expect(editJson.success).toBe(true);
    expect(editJson.status).toBe("published");
    expect(editJson.revision.keywords).toEqual(["updated", "keyword"]);
    expect(editJson.revision.replyTemplate).toBe("Updated reply message here");
    expect(editJson.revision.confirmationButtonText).toBe("Claim Now");
  });

  it("lists delivery history", async () => {
    // Get existing campaign and revision id
    const listReq = new Request("https://v2.test/api/campaigns", {
      headers: { cookie: sessionCookie(sessionToken, 3600, true) },
    });
    const listRes = await handleCampaigns(listReq, { ...env, DB: db }, now);
    const { campaigns } = (await listRes.json()) as {
      campaigns: Array<{ campaign: { id: string }; revision: { id: string } }>;
    };
    const target = campaigns[0];
    expect(target).toBeDefined();
    const campId = target?.campaign.id ?? "";
    const revId = target?.revision.id ?? "";

    // Insert a mock delivery outcome directly referencing valid foreign keys
    await db
      .prepare(
        `INSERT INTO delivery_claims (
          action_key, workspace_id, account_id, comment_id, media_id, campaign_id, revision_id, claimed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        "action_d1",
        workspaceId,
        "ig_acc_camp_test",
        "c_1",
        "post_100",
        campId,
        revId,
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
        "out_1",
        "action_d1",
        workspaceId,
        "ig_acc_camp_test",
        "sent",
        "meta_msg_123",
        1,
        now,
      )
      .run();

    const req = new Request("https://v2.test/api/deliveries", {
      headers: { cookie: sessionCookie(sessionToken, 3600, true) },
    });

    const res = await handleDeliveries(req, db, now);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      deliveries: Array<{ id: string; status: string }>;
    };
    expect(body.deliveries).toHaveLength(1);
    expect(body.deliveries[0]?.status).toBe("sent");
  });

  it("deletes campaign via DELETE and cascades cleanly", async () => {
    const listReq = new Request("https://v2.test/api/campaigns", {
      headers: { cookie: sessionCookie(sessionToken, 3600, true) },
    });
    const listRes = await handleCampaigns(listReq, { ...env, DB: db }, now);
    const { campaigns } = (await listRes.json()) as {
      campaigns: Array<{ campaign: { id: string } }>;
    };
    const campId = campaigns[0]?.campaign.id ?? "";

    const delReq = new Request(`https://v2.test/api/campaigns/${campId}`, {
      method: "DELETE",
      headers: {
        origin: "https://v2.test",
        cookie: sessionCookie(sessionToken, 3600, true),
      },
    });

    const delRes = await handleCampaignItem(
      delReq,
      campId,
      { ...env, DB: db },
      now + 3000,
    );
    expect(delRes.status).toBe(200);
    expect(await delRes.json()).toEqual({
      success: true,
      id: campId,
    });

    // Subsequent DELETE should 404
    const delAgain = await handleCampaignItem(
      delReq,
      campId,
      { ...env, DB: db },
      now + 3001,
    );
    expect(delAgain.status).toBe(404);

    // List should now be empty
    const listAfter = await handleCampaigns(listReq, { ...env, DB: db }, now);
    const { campaigns: remaining } = (await listAfter.json()) as {
      campaigns: Array<{ campaign: { id: string } }>;
    };
    expect(remaining.length).toBe(0);
  });
});
