import { readFile } from "node:fs/promises";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handleOwnerLogin } from "./login";
import { authenticateOwner, readSessionToken, sessionCookie } from "./session";

const ownerId = "11111111-1111-4111-8111-111111111111";
let runtime: Miniflare;
let db: D1Database;
const provider = {
  url: "https://project.supabase.co",
  publishableKey: "fake-publishable-key",
  ownerUserId: ownerId,
};
const limiter: RateLimit = {
  async limit() {
    return { success: true };
  },
};
const now = Date.now();

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
    .bind("owner-workspace", ownerId, now)
    .run();
}, 30_000);
afterAll(async () => {
  await runtime?.dispose();
});

function request(
  body: unknown = { email: "owner@example.test", password: "fake-password" },
  origin = "https://v2.test",
) {
  return new Request("https://v2.test/api/login", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function input() {
  return { db, appOrigin: "https://v2.test", provider, limiter, now };
}

describe("Supabase-backed owner sign-in", () => {
  it("issues an HttpOnly local session only after the configured owner is verified", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        access_token: "fake-provider-token",
        refresh_token: "fake-refresh-token",
        user: { id: ownerId, email_confirmed_at: "2026-01-01T00:00:00Z" },
      }),
    );
    const response = await handleOwnerLogin(request(), input(), fetcher);
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    for (const flag of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/"])
      expect(cookie).toContain(flag);
    const text = await response.text();
    expect(text).not.toContain("fake-provider-token");
    expect(text).not.toContain("fake-refresh-token");
    const sessionRequest = new Request("https://v2.test/api/session", {
      headers: { cookie: cookie.split(";")[0] ?? "" },
    });
    expect((await authenticateOwner(sessionRequest, db, now))?.ownerId).toBe(
      ownerId,
    );
    expect(
      await authenticateOwner(sessionRequest, db, now + 3_600_000),
    ).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects a non-owner, unconfirmed owner, and unhandled MFA challenge", async () => {
    for (const user of [
      { id: "another-user", email_confirmed_at: "2026-01-01T00:00:00Z" },
      { id: ownerId, email_confirmed_at: null },
      {
        id: ownerId,
        email_confirmed_at: "2026-01-01T00:00:00Z",
        factors: [{ status: "verified" }],
      },
    ]) {
      expect(
        (
          await handleOwnerLogin(request(), input(), async () =>
            Response.json({ access_token: "fake-token", user }),
          )
        ).status,
      ).toBe(401);
    }
  });
  it("does not call Supabase for cross-origin, malformed, or rate-limited attempts", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("Must not call provider");
    });
    expect(
      (
        await handleOwnerLogin(
          request(undefined, "https://attacker.test"),
          input(),
          fetcher,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await handleOwnerLogin(
          request({
            email: "owner@example.test",
            password: "x",
            workspaceId: "injected",
          }),
          input(),
          fetcher,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handleOwnerLogin(
          request(),
          {
            ...input(),
            limiter: {
              async limit() {
                return { success: false };
              },
            },
          },
          fetcher,
        )
      ).status,
    ).toBe(429);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("sanitizes provider rejections, malformed responses, and transport failures", async () => {
    const rejected = await handleOwnerLogin(
      request(),
      input(),
      async () => new Response("private credentials", { status: 400 }),
    );
    expect(rejected.status).toBe(401);
    expect(await rejected.text()).not.toContain("private credentials");
    const malformed = await handleOwnerLogin(
      request(),
      input(),
      async () => new Response("x".repeat(65_537)),
    );
    expect(malformed.status).toBe(503);
    const failed = await handleOwnerLogin(request(), input(), async () => {
      throw new Error("secret-url");
    });
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("secret-url");
  });
  it("rejects ambiguous duplicate session cookies", () => {
    const value = "a".repeat(43);
    expect(
      readSessionToken(
        new Request("https://v2.test", {
          headers: {
            cookie: `__Host-fadeloop-session=${value}; __Host-fadeloop-session=${value}`,
          },
        }),
      ),
    ).toBeNull();
    expect(sessionCookie(value, 60)).toContain("Max-Age=60");
  });
});
