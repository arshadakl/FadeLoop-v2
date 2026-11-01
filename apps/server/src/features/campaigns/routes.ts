import {
  createCampaignInputSchema,
  updateCampaignInputSchema,
} from "@fadeloop/contracts/campaign";
import { apiError, boundedJSON } from "../../common/http";
import { authenticateOwner, hasTrustedOrigin } from "../owner/session";
import { createCampaignStore } from "./storage";

export interface CampaignRouteEnvironment {
  DB: D1Database;
  APP_ORIGIN: string;
}

/**
 * Handle /api/campaigns
 * - GET: list workspace campaigns (cursor pagination)
 * - POST: create a new campaign + revision (enforces 1 published campaign per post/reel)
 */
export async function handleCampaigns(
  request: Request,
  env: CampaignRouteEnvironment,
  now: number = Date.now(),
): Promise<Response> {
  const session = await authenticateOwner(request, env.DB, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);

  const store = createCampaignStore(env.DB);

  if (request.method === "GET") {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit")) || 20;
    const cursor = url.searchParams.get("cursor");
    const cursorUpdatedAt = cursor ? Number(cursor) : undefined;

    const campaigns = await store.listCampaigns(
      session.workspaceId,
      limit,
      cursorUpdatedAt,
    );

    return Response.json(
      { campaigns },
      { headers: { "cache-control": "no-store" } },
    );
  }

  if (request.method === "POST") {
    if (!hasTrustedOrigin(request, env.APP_ORIGIN)) {
      return apiError("FORBIDDEN", 403);
    }

    let body: unknown;
    try {
      body = await boundedJSON(request, 8192);
    } catch {
      return apiError("INVALID_REQUEST", 400);
    }

    const parsed = createCampaignInputSchema.safeParse(body);
    if (!parsed.success) return apiError("INVALID_REQUEST", 400);

    const {
      accountId,
      mediaId,
      status,
      matchMode,
      keywords,
      replyTemplate,
      resourceUrl,
      confirmationButtonEnabled,
      confirmationButtonText,
      confirmationPromptText,
    } = parsed.data;

    // Normalize keywords to lowercase
    const normalizedKeywords = keywords
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    try {
      const created = await store.createCampaign({
        id: crypto.randomUUID(),
        workspaceId: session.workspaceId,
        accountId,
        mediaId,
        status,
        revision: {
          id: crypto.randomUUID(),
          matchMode,
          keywords: normalizedKeywords,
          replyTemplate,
          confirmationButtonEnabled,
          confirmationButtonText,
          confirmationPromptText,
          ...(resourceUrl !== undefined ? { resourceUrl } : {}),
        },
        now,
      });

      return Response.json(created, {
        status: 201,
        headers: { "cache-control": "no-store" },
      });
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message.includes("UNIQUE") || err.message.includes("constraint"))
      ) {
        return apiError("CAMPAIGN_ALREADY_EXISTS_FOR_MEDIA", 409);
      }
      console.error("Failed to create campaign:", err);
      return apiError("DATABASE_ERROR", 500);
    }
  }

  return apiError("METHOD_NOT_ALLOWED", 405);
}

/**
 * Handle /api/campaigns/:id
 * - PUT / PATCH: update campaign details or toggle status
 * - DELETE: permanently remove campaign and cascade deletions
 */
export async function handleCampaignItem(
  request: Request,
  campaignId: string,
  env: CampaignRouteEnvironment,
  now: number = Date.now(),
): Promise<Response> {
  const session = await authenticateOwner(request, env.DB, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);

  // 1. DELETE /api/campaigns/:id
  if (request.method === "DELETE") {
    if (!hasTrustedOrigin(request, env.APP_ORIGIN)) {
      return apiError("FORBIDDEN", 403);
    }

    const store = createCampaignStore(env.DB);
    try {
      const deleted = await store.deleteCampaign(
        campaignId,
        session.workspaceId,
      );
      if (!deleted) return apiError("NOT_FOUND", 404);

      return Response.json(
        { success: true, id: campaignId },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (err: unknown) {
      console.error("Failed to delete campaign:", err);
      return apiError("DATABASE_ERROR", 500);
    }
  }

  // 2. PUT / PATCH /api/campaigns/:id
  if (request.method === "PUT" || request.method === "PATCH") {
    if (!hasTrustedOrigin(request, env.APP_ORIGIN)) {
      return apiError("FORBIDDEN", 403);
    }

    let body: unknown;
    try {
      body = await boundedJSON(request, 8192);
    } catch {
      return apiError("INVALID_REQUEST", 400);
    }

    const parsed = updateCampaignInputSchema.safeParse(body);
    if (!parsed.success) return apiError("INVALID_REQUEST", 400);

    const store = createCampaignStore(env.DB);
    try {
      const normalizedKeywords = parsed.data.keywords
        ? parsed.data.keywords
            .map((k) => k.trim().toLowerCase())
            .filter(Boolean)
        : undefined;

      const updated = await store.updateCampaign({
        campaignId,
        workspaceId: session.workspaceId,
        status: parsed.data.status,
        revision: {
          matchMode: parsed.data.matchMode,
          keywords: normalizedKeywords,
          replyTemplate: parsed.data.replyTemplate,
          resourceUrl: parsed.data.resourceUrl,
          confirmationButtonEnabled: parsed.data.confirmationButtonEnabled,
          confirmationButtonText: parsed.data.confirmationButtonText,
          confirmationPromptText: parsed.data.confirmationPromptText,
        },
        now,
      });

      if (!updated) return apiError("NOT_FOUND", 404);

      return Response.json(
        {
          success: true,
          status: updated.campaign.status,
          campaign: updated.campaign,
          revision: updated.revision,
        },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message.includes("UNIQUE") || err.message.includes("constraint"))
      ) {
        return apiError("CAMPAIGN_ALREADY_EXISTS_FOR_MEDIA", 409);
      }
      console.error("Failed to update campaign:", err);
      return apiError("DATABASE_ERROR", 500);
    }
  }

  return apiError("METHOD_NOT_ALLOWED", 405);
}

/**
 * Handle /api/deliveries
 * - GET: list delivery history for dashboard
 */
export async function handleDeliveries(
  request: Request,
  db: D1Database,
  now: number = Date.now(),
): Promise<Response> {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);

  const session = await authenticateOwner(request, db, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit")) || 25;
  const cursor = url.searchParams.get("cursor");
  const cursorOccurredAt = cursor ? Number(cursor) : undefined;

  const store = createCampaignStore(db);
  const deliveries = await store.listDeliveries(
    session.workspaceId,
    limit,
    cursorOccurredAt,
  );

  return Response.json(
    { deliveries },
    { headers: { "cache-control": "no-store" } },
  );
}
