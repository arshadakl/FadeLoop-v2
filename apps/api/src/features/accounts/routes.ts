import { apiError } from "../../common/http";
import { authenticateOwner } from "../owner/session";
import { listAccounts } from "./storage";

export async function handleAccounts(
  request: Request,
  db: D1Database,
  now: number,
): Promise<Response> {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);
  const session = await authenticateOwner(request, db, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);
  const after = new URL(request.url).searchParams.get("after") ?? "";
  if (after.length > 1024) return apiError("INVALID_REQUEST", 400);
  return Response.json(
    { accounts: await listAccounts(db, session.workspaceId, after) },
    { headers: { "cache-control": "no-store" } },
  );
}
