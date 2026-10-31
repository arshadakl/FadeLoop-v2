import { healthResponse, unavailable } from "@fadeloop/worker-common/http";
import type { ServerEnvironment } from "../environment";
import {
  handleInstagramCallback,
  handleInstagramConnect,
} from "../features/accounts/oauth";
import { handleAccounts } from "../features/accounts/routes";
import {
  handleCampaignItem,
  handleCampaigns,
  handleDeliveries,
} from "../features/campaigns/routes";
import { handleOwnerLogin } from "../features/owner/login";
import { handleOwnerSession } from "../features/owner/routes";

export async function handleApiRequest(
  request: Request,
  env: ServerEnvironment,
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/health") {
    return healthResponse("api");
  }

  // Owner Login
  if (path === "/api/login") {
    if (
      !env.DB ||
      !env.APP_ORIGIN ||
      !env.SUPABASE_URL ||
      !env.SUPABASE_PUBLISHABLE_KEY ||
      !env.OWNER_SUPABASE_USER_ID ||
      !env.LOGIN_RATE_LIMITER
    )
      return unavailable();
    try {
      return await handleOwnerLogin(request, {
        db: env.DB,
        appOrigin: env.APP_ORIGIN,
        provider: {
          url: env.SUPABASE_URL,
          publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
          ownerUserId: env.OWNER_SUPABASE_USER_ID,
        },
        limiter: env.LOGIN_RATE_LIMITER,
        now: Date.now(),
      });
    } catch (err) {
      console.error("Owner login error:", err);
      return unavailable();
    }
  }

  // Owner Session
  if (path === "/api/session") {
    if (!env.DB || !env.APP_ORIGIN) return unavailable();
    try {
      return await handleOwnerSession(
        request,
        env.DB,
        env.APP_ORIGIN,
        Date.now(),
      );
    } catch {
      console.error("Owner session storage unavailable");
      return unavailable();
    }
  }

  // Instagram OAuth Connect
  if (path === "/api/auth/instagram/connect") {
    if (
      !env.DB ||
      !env.APP_ORIGIN ||
      !env.META_APP_ID ||
      !env.META_APP_SECRET ||
      !env.META_REDIRECT_URI ||
      !env.TOKEN_ENCRYPTION_KEY
    )
      return unavailable();
    try {
      return await handleInstagramConnect(
        request,
        {
          DB: env.DB,
          APP_ORIGIN: env.APP_ORIGIN,
          META_APP_ID: env.META_APP_ID,
          META_APP_SECRET: env.META_APP_SECRET,
          META_REDIRECT_URI: env.META_REDIRECT_URI,
          TOKEN_ENCRYPTION_KEY: env.TOKEN_ENCRYPTION_KEY,
        },
        Date.now(),
      );
    } catch (err) {
      console.error("Instagram connect error:", err);
      return unavailable();
    }
  }

  // Instagram OAuth Callback
  if (path === "/api/auth/instagram/callback") {
    if (
      !env.DB ||
      !env.APP_ORIGIN ||
      !env.META_APP_ID ||
      !env.META_APP_SECRET ||
      !env.META_REDIRECT_URI ||
      !env.TOKEN_ENCRYPTION_KEY
    )
      return unavailable();
    try {
      return await handleInstagramCallback(
        request,
        {
          DB: env.DB,
          APP_ORIGIN: env.APP_ORIGIN,
          META_APP_ID: env.META_APP_ID,
          META_APP_SECRET: env.META_APP_SECRET,
          META_REDIRECT_URI: env.META_REDIRECT_URI,
          TOKEN_ENCRYPTION_KEY: env.TOKEN_ENCRYPTION_KEY,
        },
        fetch,
        Date.now(),
      );
    } catch (err) {
      console.error("Instagram callback error:", err);
      return unavailable();
    }
  }

  // Instagram Accounts metadata
  if (path === "/api/accounts") {
    if (!env.DB) return unavailable();
    try {
      return await handleAccounts(request, env.DB, Date.now());
    } catch {
      console.error("Account metadata storage unavailable");
      return unavailable();
    }
  }

  // Campaigns Collection (GET list, POST create)
  if (path === "/api/campaigns") {
    if (!env.DB || !env.APP_ORIGIN) return unavailable();
    try {
      return await handleCampaigns(
        request,
        { DB: env.DB, APP_ORIGIN: env.APP_ORIGIN },
        Date.now(),
      );
    } catch (err) {
      console.error("Campaigns collection error:", err);
      return unavailable();
    }
  }

  // Single Campaign Item (PUT status)
  if (path.startsWith("/api/campaigns/")) {
    const campaignId = path.slice("/api/campaigns/".length).trim();
    if (!campaignId || !env.DB || !env.APP_ORIGIN) return unavailable();
    try {
      return await handleCampaignItem(
        request,
        campaignId,
        { DB: env.DB, APP_ORIGIN: env.APP_ORIGIN },
        Date.now(),
      );
    } catch (err) {
      console.error("Campaign item error:", err);
      return unavailable();
    }
  }

  // Deliveries History
  if (path === "/api/deliveries") {
    if (!env.DB) return unavailable();
    try {
      return await handleDeliveries(request, env.DB, Date.now());
    } catch (err) {
      console.error("Deliveries list error:", err);
      return unavailable();
    }
  }

  return unavailable();
}
