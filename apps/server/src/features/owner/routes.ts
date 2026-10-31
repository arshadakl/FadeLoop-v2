import {
  authenticateOwner,
  clearSessionCookie,
  hasTrustedOrigin,
} from "./session";
import { createOwnerStore } from "./storage";

export async function handleOwnerSession(
  request: Request,
  db: D1Database,
  appOrigin: string,
  now: number,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "DELETE")
    return Response.json(
      { error: { code: "METHOD_NOT_ALLOWED" } },
      { status: 405, headers: { allow: "GET, DELETE" } },
    );
  if (request.method === "DELETE" && !hasTrustedOrigin(request, appOrigin))
    return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  const session = await authenticateOwner(request, db, now);
  if (!session)
    return Response.json(
      { error: { code: "UNAUTHENTICATED" } },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  if (request.method === "DELETE") {
    await createOwnerStore(db).revokeSession(session.sessionDigest);
    const isSecure = new URL(appOrigin).protocol === "https:";
    return new Response(null, {
      status: 204,
      headers: {
        "set-cookie": clearSessionCookie(isSecure),
        "cache-control": "no-store",
      },
    });
  }
  return Response.json(
    {
      ownerId: session.ownerId,
      workspaceId: session.workspaceId,
      expiresAt: session.expiresAt,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
