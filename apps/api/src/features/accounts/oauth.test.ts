import { readFile } from "node:fs/promises";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sessionCookie, sessionDigest } from "../owner/session";
import { createOwnerStore } from "../owner/storage";
import { handleInstagramCallback, handleInstagramConnect } from "./oauth";
import { createAccountStore } from "./storage";

const ownerId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "ws_oauth_test";
const encryptionKey = "jx0jMSTagqboGF8N1boWJ2N3v65Yrg58ddLmtiKO14Q";
const sessionToken = "x".repeat(43);
const now = 1700000000000;

let runtime: Miniflare;
let db: D1Database;

const env = {
  DB: () => db,
  APP_ORIGIN: "https://v2.test",
  META_APP_ID: "1234567890",
  META_APP_SECRET: "mock_secret_abcdef",
  META_REDIRECT_URI: "https://v2.test/api/auth/instagram/callback",
  TOKEN_ENCRYPTION_KEY: encryptionKey,
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

  // Setup workspace and session
  await db
    .prepare("INSERT INTO workspaces VALUES (?, ?, ?)")
    .bind(workspaceId, ownerId, now)
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

describe("Instagram OAuth Handshake", () => {
  it("generates an authorizeUrl and records atomic state for authenticated owner", async () => {
    const req = new Request("https://v2.test/api/auth/instagram/connect", {
      headers: {
        cookie: sessionCookie(sessionToken, 3600, true),
      },
    });

    const res = await handleInstagramConnect(req, { ...env, DB: db }, now);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { authorizeUrl: string };
    expect(body.authorizeUrl).toContain(
      "https://www.instagram.com/oauth/authorize",
    );
    expect(body.authorizeUrl).toContain("client_id=1234567890");

    const stateParam = new URL(body.authorizeUrl).searchParams.get("state");
    expect(stateParam).toHaveLength(43);

    // Verify state row exists in D1
    const states = await db.prepare("SELECT * FROM oauth_states").all();
    expect(states.results).toHaveLength(1);
  });

  it("rejects unauthenticated requests to connect", async () => {
    const req = new Request("https://v2.test/api/auth/instagram/connect");
    const res = await handleInstagramConnect(req, { ...env, DB: db }, now);
    expect(res.status).toBe(401);
  });

  it("successfully handles callback, exchanges tokens, encrypts in D1, and consumes state atomically", async () => {
    // 1. Generate fresh state
    const connectReq = new Request(
      "https://v2.test/api/auth/instagram/connect",
      {
        headers: {
          cookie: sessionCookie(sessionToken, 3600, true),
        },
      },
    );
    const connectRes = await handleInstagramConnect(
      connectReq,
      { ...env, DB: db },
      now,
    );
    const { authorizeUrl } = (await connectRes.json()) as {
      authorizeUrl: string;
    };
    const state = new URL(authorizeUrl).searchParams.get("state") ?? "";
    expect(state).toHaveLength(43);

    // 2. Mock Meta OAuth exchange responses
    const mockFetcher = vi.fn(async (url: string) => {
      if (url.includes("oauth/access_token")) {
        return Response.json({
          access_token: "short_lived_token_123",
          user_id: "987654321",
        });
      }
      if (url.includes("graph.instagram.com/access_token")) {
        return Response.json({
          access_token: "long_lived_token_456",
          expires_in: 5184000, // 60 days in seconds
        });
      }
      return new Response("Not Found", { status: 404 });
    });

    // 3. Perform callback
    const callbackReq = new Request(
      `https://v2.test/api/auth/instagram/callback?code=valid_auth_code&state=${state}`,
      {
        headers: {
          cookie: sessionCookie(sessionToken, 3600, true),
        },
      },
    );

    const res = await handleInstagramCallback(
      callbackReq,
      { ...env, DB: db },
      mockFetcher as unknown as typeof fetch,
      now,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://v2.test/accounts?connected=true&accountId=987654321",
    );

    // 4. Verify account in D1 is connected and token is encrypted
    const accountStore = createAccountStore(db, encryptionKey);
    const credential = await accountStore.readCredential(
      workspaceId,
      "987654321",
      now,
    );
    expect(credential?.accessToken).toBe("long_lived_token_456");
    expect(credential?.expiresAt).toBe(now + 5184000 * 1000);

    // 5. Verify state was consumed (cannot be replayed)
    const replayRes = await handleInstagramCallback(
      callbackReq,
      { ...env, DB: db },
      mockFetcher as unknown as typeof fetch,
      now,
    );
    expect(replayRes.status).toBe(302);
    expect(replayRes.headers.get("location")).toBe(
      "https://v2.test/accounts?error=state_expired",
    );
  });
});
