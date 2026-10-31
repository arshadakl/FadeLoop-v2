import { readFile } from "node:fs/promises";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QueryMetric } from "../../common/database";
import api from "../../index";
import { createAccountStore } from "../accounts/storage";
import { sessionDigest } from "./session";
import { createOwnerStore } from "./storage";

const now = Date.now();
const rawSession = "a".repeat(43);
const expiry = now + 3_600_000;
const encryptionKey = btoa(
  String.fromCharCode(...new Uint8Array(32).fill(9)),
).replace(/=+$/, "");
let runtime: Miniflare;
let db: D1Database;
let digest: string;
const metrics: QueryMetric[] = [];

beforeAll(async () => {
  runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("test"); } }',
      d1Databases: ["DB"],
      compatibilityDate: "2026-01-01",
    }),
  );
  // Miniflare and Worker packages describe the same D1 binding with separate ambient types.
  db = (await runtime.getD1Database("DB")) as unknown as D1Database;
  const sql = await readFile(
    new URL(
      "../../../../../schema/0001_owner_and_accounts.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.batch(
    sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => db.prepare(statement)),
  );
  await db.batch([
    db
      .prepare("INSERT INTO workspaces VALUES (?, ?, ?)")
      .bind("workspace-one", "owner-one", now),
    db
      .prepare("INSERT INTO workspaces VALUES (?, ?, ?)")
      .bind("workspace-two", "owner-two", now),
  ]);
  digest = await sessionDigest(rawSession);
  await createOwnerStore(db).createSession({
    digest,
    workspaceId: "workspace-one",
    now,
    expiresAt: expiry,
  });
}, 30_000);
afterAll(async () => {
  await runtime?.dispose();
});

describe("real local D1 ownership and state", () => {
  it("expires sessions without touching their rows on reads", async () => {
    const store = createOwnerStore(db, (metric) => metrics.push(metric));
    expect((await store.findSession(digest, now))?.workspaceId).toBe(
      "workspace-one",
    );
    expect(await store.findSession(digest, expiry)).toBeNull();
    expect(metrics.every((metric) => metric.rowsWritten === 0)).toBe(true);
  });
  it("atomically consumes OAuth state once under concurrent callbacks", async () => {
    const store = createOwnerStore(db);
    await store.createOAuthState(
      { digest: "oauth-one", ownerSessionId: digest, expiresAt: expiry },
      now,
    );
    expect(
      await store.oauthState.consume({
        digest: "oauth-one",
        ownerSessionId: "other-session",
        now,
      }),
    ).toBe(false);
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        store.oauthState.consume({
          digest: "oauth-one",
          ownerSessionId: digest,
          now,
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("does not accept expired state or create state for an expired session", async () => {
    const store = createOwnerStore(db);
    await store.createOAuthState(
      { digest: "oauth-expired", ownerSessionId: digest, expiresAt: now + 1 },
      now,
    );
    expect(
      await store.oauthState.consume({
        digest: "oauth-expired",
        ownerSessionId: digest,
        now: now + 1,
      }),
    ).toBe(false);
    expect(
      await store.createOAuthState(
        {
          digest: "not-created",
          ownerSessionId: digest,
          expiresAt: expiry + 1000,
        },
        expiry,
      ),
    ).toBe(false);
  });
  it("does not permit another workspace to read, replace, or disconnect credentials", async () => {
    const store = createAccountStore(db, encryptionKey);
    expect(
      await store.connect({
        workspaceId: "workspace-one",
        accountId: "ig-one",
        accessToken: "fake-provider-token",
        expiresAt: expiry,
        now,
      }),
    ).toBe(true);
    expect(
      await store.readCredential("workspace-two", "ig-one", now),
    ).toBeNull();
    expect(
      await store.connect({
        workspaceId: "workspace-two",
        accountId: "ig-one",
        accessToken: "attacker-token",
        expiresAt: expiry,
        now,
      }),
    ).toBe(false);
    expect(await store.disconnect("workspace-two", "ig-one", now)).toBe(false);
    expect(
      (await store.readCredential("workspace-one", "ig-one", now))?.accessToken,
    ).toBe("fake-provider-token");
    const row = await db
      .prepare(
        "SELECT token_ciphertext FROM instagram_accounts WHERE account_id = ?",
      )
      .bind("ig-one")
      .first<{ token_ciphertext: string }>();
    expect(row?.token_ciphertext).not.toContain("fake-provider-token");
  });
  it("serves only session-owned account metadata and rejects CSRF logout", async () => {
    const env = { APP_ENV: "test", DB: db, APP_ORIGIN: "https://v2.test" };
    expect(
      (await api.fetch(new Request("https://v2.test/api/accounts"), env))
        .status,
    ).toBe(401);
    const cookie = `__Host-fadeloop-session=${rawSession}`;
    const accounts = await api.fetch(
      new Request("https://v2.test/api/accounts?workspaceId=workspace-two", {
        headers: { cookie },
      }),
      env,
    );
    const text = await accounts.text();
    expect(accounts.status).toBe(200);
    expect(text).toContain("ig-one");
    expect(text).not.toContain("fake-provider-token");
    expect(text).not.toContain("token_ciphertext");
    expect(
      (
        await api.fetch(
          new Request("https://v2.test/api/session", {
            method: "DELETE",
            headers: { cookie, origin: "https://attacker.test" },
          }),
          env,
        )
      ).status,
    ).toBe(403);
  });
  it("uses indexed session and workspace account lookups", async () => {
    const plan = await db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT account_id FROM instagram_accounts WHERE workspace_id = ? AND account_id > ? ORDER BY account_id LIMIT 50",
      )
      .bind("workspace-one", "")
      .all<{ detail: string }>();
    expect(plan.results.map((row) => row.detail).join(" ")).toContain(
      "idx_instagram_accounts_workspace",
    );
    const sessionPlan = await db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT workspace_id FROM owner_sessions WHERE digest = ? AND expires_at > ?",
      )
      .bind(digest, now)
      .all<{ detail: string }>();
    expect(sessionPlan.results.map((row) => row.detail).join(" ")).toContain(
      "PRIMARY KEY",
    );
  });
  it("keeps indexed lookups bounded with unrelated history", async () => {
    await db
      .prepare(
        "WITH RECURSIVE ids(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM ids WHERE n < 1500) INSERT INTO owner_sessions SELECT 'history-' || n, 'workspace-two', ?, ? FROM ids",
      )
      .bind(now, expiry)
      .run();
    await db
      .prepare(
        "WITH RECURSIVE ids(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM ids WHERE n < 1500) INSERT INTO instagram_accounts SELECT 'history-' || n, 'workspace-two', 'fixture', 'disconnected', NULL, NULL, ? FROM ids",
      )
      .bind(now)
      .run();
    const measured: QueryMetric[] = [];
    await createOwnerStore(db, (metric) => measured.push(metric)).findSession(
      digest,
      now,
    );
    await createAccountStore(db, encryptionKey, (metric) =>
      measured.push(metric),
    ).list("workspace-one");
    expect(measured).toHaveLength(2);
    expect(
      measured.every(
        (metric) => metric.rowsRead < 10 && metric.rowsWritten === 0,
      ),
    ).toBe(true);
    console.info(
      JSON.stringify({ evidence: "p03-indexed-reads", metrics: measured }),
    );
  });
  it("clears credentials and changes generation when disconnected", async () => {
    const store = createAccountStore(db, encryptionKey);
    await store.connect({
      workspaceId: "workspace-one",
      accountId: "refresh-test",
      accessToken: "original",
      expiresAt: expiry,
      now,
    });
    const original = await store.readCredential(
      "workspace-one",
      "refresh-test",
      now,
    );
    expect(original).not.toBeNull();
    await store.disconnect("workspace-one", "refresh-test", now);
    const disconnected = await db
      .prepare(
        "SELECT generation, token_ciphertext FROM instagram_accounts WHERE account_id = ?",
      )
      .bind("refresh-test")
      .first<{ generation: string; token_ciphertext: string | null }>();
    expect(disconnected?.generation).not.toBe(original?.generation);
    expect(disconnected?.token_ciphertext).toBeNull();
    expect(
      await store.readCredential("workspace-one", "refresh-test", now),
    ).toBeNull();
  });
  it("revokes a session and cascades its pending OAuth states", async () => {
    const store = createOwnerStore(db);
    await store.createOAuthState(
      {
        digest: "pending-at-logout",
        ownerSessionId: digest,
        expiresAt: expiry,
      },
      now,
    );
    const response = await api.fetch(
      new Request("https://v2.test/api/session", {
        method: "DELETE",
        headers: {
          cookie: `__Host-fadeloop-session=${rawSession}`,
          origin: "https://v2.test",
        },
      }),
      { APP_ENV: "test", DB: db, APP_ORIGIN: "https://v2.test" },
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await store.findSession(digest, now)).toBeNull();
    expect(
      await store.oauthState.consume({
        digest: "pending-at-logout",
        ownerSessionId: digest,
        now,
      }),
    ).toBe(false);
  });
});
