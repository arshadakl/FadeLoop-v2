import { readFile } from "node:fs/promises";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ServerEnvironment } from "../../environment";
import { sessionCookie, sessionDigest } from "../owner/session";
import { createOwnerStore } from "../owner/storage";
import { handleAccountMedia } from "./media";
import { createAccountStore } from "./storage";

const ownerId = "33333333-3333-4333-8333-333333333333";
const workspaceId = "ws_media_test";
const encryptionKey = "jx0jMSTagqboGF8N1boWJ2N3v65Yrg58ddLmtiKO14Q";
const sessionToken = "m".repeat(43);
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

  const ownerStore = createOwnerStore(db);
  await ownerStore.createSession({
    digest: await sessionDigest(sessionToken),
    workspaceId,
    now,
    expiresAt: now + 3600 * 1000,
  });

  const accountStore = createAccountStore(db, encryptionKey);
  await accountStore.connect({
    workspaceId,
    accountId: "17841405793187218",
    accessToken: "valid-account-token",
    expiresAt: now + 86400 * 1000 * 30,
    now,
  });
});

afterAll(async () => {
  await runtime.dispose();
});

describe("Visual Media Picker: GET /api/accounts/:id/media", () => {
  it("returns sanitized list of Instagram media items for authenticated owner", async () => {
    const mockFetcher = vi.fn(async (url: string) => {
      expect(url).toContain(
        "https://graph.instagram.com/v22.0/17841405793187218/media",
      );
      expect(url).toContain("access_token=valid-account-token");
      return Response.json({
        data: [
          {
            id: "media_reel_1",
            caption: "Amazing new launch reel! #launch",
            media_type: "VIDEO",
            thumbnail_url: "https://cdn.example.com/thumb1.jpg",
            permalink: "https://instagram.com/reel/123",
            timestamp: "2026-10-30T10:00:00+0000",
          },
          {
            id: "media_post_2",
            caption: "Photo update",
            media_type: "IMAGE",
            media_url: "https://cdn.example.com/photo2.jpg",
            permalink: "https://instagram.com/p/456",
            timestamp: "2026-10-29T10:00:00+0000",
          },
        ],
      });
    });

    const env = {
      DB: db,
      TOKEN_ENCRYPTION_KEY: encryptionKey,
    } as unknown as ServerEnvironment;

    const request = new Request(
      "https://v2.test/api/accounts/17841405793187218/media",
      {
        headers: {
          cookie: sessionCookie(sessionToken, 3600, false),
        },
      },
    );

    const response = await handleAccountMedia(
      request,
      env,
      "17841405793187218",
      now,
      mockFetcher as unknown as typeof fetch,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { media: unknown[] };
    expect(body.media).toHaveLength(2);
    expect(body.media[0]).toMatchObject({
      id: "media_reel_1",
      caption: "Amazing new launch reel! #launch",
      media_type: "VIDEO",
      thumbnail_url: "https://cdn.example.com/thumb1.jpg",
    });
    // For images without thumbnail_url, media_url should fallback to thumbnail_url
    expect(body.media[1]).toMatchObject({
      id: "media_post_2",
      thumbnail_url: "https://cdn.example.com/photo2.jpg",
    });
  });

  it("rejects unauthenticated requests", async () => {
    const env = {
      DB: db,
      TOKEN_ENCRYPTION_KEY: encryptionKey,
    } as unknown as ServerEnvironment;

    const request = new Request(
      "https://v2.test/api/accounts/17841405793187218/media",
    );
    const response = await handleAccountMedia(
      request,
      env,
      "17841405793187218",
      now,
    );
    expect(response.status).toBe(401);
  });
});
