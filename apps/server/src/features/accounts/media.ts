import { apiError } from "../../common/http";
import type { ServerEnvironment } from "../../environment";
import { authenticateOwner } from "../owner/session";
import { createAccountStore } from "./storage";

export interface InstagramMediaItem {
  id: string;
  caption?: string | undefined;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string | undefined;
  thumbnail_url?: string | undefined;
  permalink: string;
  timestamp: string;
}

export async function handleAccountMedia(
  request: Request,
  env: ServerEnvironment,
  accountId: string,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "GET") return apiError("METHOD_NOT_ALLOWED", 405);
  if (!env.DB || !env.TOKEN_ENCRYPTION_KEY)
    return apiError("SERVER_ERROR", 500);

  const session = await authenticateOwner(request, env.DB, now);
  if (!session) return apiError("UNAUTHENTICATED", 401);

  if (!accountId || !/^\d+$/.test(accountId)) {
    return apiError("INVALID_REQUEST", 400);
  }

  const accountStore = createAccountStore(env.DB, env.TOKEN_ENCRYPTION_KEY);
  const cred = await accountStore.readCredential(
    session.workspaceId,
    accountId,
    now,
  );

  if (!cred) {
    return apiError("ACCOUNT_NOT_FOUND", 404);
  }

  try {
    const url = new URL("https://graph.instagram.com/me/media");
    url.search = new URLSearchParams({
      fields:
        "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp",
      limit: "24",
      access_token: cred.accessToken,
    }).toString();

    let response = await fetcher(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // Fallback: try accountId-specific path if me/media returns 400
      const fallbackUrl = new URL(
        `https://graph.instagram.com/${accountId}/media`,
      );
      fallbackUrl.search = url.search;
      const fallbackResponse = await fetcher(fallbackUrl.toString(), {
        method: "GET",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);

      if (fallbackResponse?.ok) {
        response = fallbackResponse;
      } else {
        const errText = await response.text().catch(() => "");
        console.error(
          `Failed to fetch Instagram media for account ${accountId}: HTTP ${response.status}`,
          errText,
        );
        return Response.json(
          { media: [], error: "provider_error" },
          { status: 502 },
        );
      }
    }

    const data = (await response.json()) as { data?: unknown[] };
    if (!data || !Array.isArray(data.data)) {
      return Response.json({ media: [] });
    }

    const media: InstagramMediaItem[] = [];
    for (const item of data.data) {
      if (
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        typeof (item as { id: unknown }).id === "string"
      ) {
        const raw = item as Record<string, unknown>;
        media.push({
          id: String(raw.id),
          caption: typeof raw.caption === "string" ? raw.caption : undefined,
          media_type:
            (raw.media_type as InstagramMediaItem["media_type"]) || "IMAGE",
          media_url:
            typeof raw.media_url === "string" ? raw.media_url : undefined,
          thumbnail_url:
            typeof raw.thumbnail_url === "string"
              ? raw.thumbnail_url
              : typeof raw.media_url === "string"
                ? raw.media_url
                : undefined,
          permalink: typeof raw.permalink === "string" ? raw.permalink : "",
          timestamp: typeof raw.timestamp === "string" ? raw.timestamp : "",
        });
      }
    }

    return Response.json(
      { media },
      { headers: { "cache-control": "private, max-age=60" } },
    );
  } catch (err) {
    console.error(`Instagram media fetch exception for ${accountId}:`, err);
    return Response.json({ media: [], error: "fetch_failed" }, { status: 500 });
  }
}
