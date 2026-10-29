import {
  isConfiguredEnvironment,
  type WorkerEnvironment,
} from "@fadeloop/worker-common/environment";
import { healthResponse, unavailable } from "@fadeloop/worker-common/http";
import { handleAccounts } from "./features/accounts/routes";
import { handleOwnerLogin } from "./features/owner/login";
import { handleOwnerSession } from "./features/owner/routes";

interface ApiEnvironment extends WorkerEnvironment {
  DB?: D1Database;
  APP_ORIGIN?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  OWNER_SUPABASE_USER_ID?: string;
  LOGIN_RATE_LIMITER?: RateLimit;
}

export default {
  async fetch(request: Request, env: ApiEnvironment): Promise<Response> {
    if (!isConfiguredEnvironment(env)) return unavailable();
    if (
      request.method === "GET" &&
      new URL(request.url).pathname === "/api/health"
    )
      return healthResponse("api");
    const path = new URL(request.url).pathname;
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
      } catch {
        console.error("Owner login unavailable");
        return unavailable();
      }
    }
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
    if (path === "/api/accounts") {
      if (!env.DB) return unavailable();
      try {
        return await handleAccounts(request, env.DB, Date.now());
      } catch {
        console.error("Account metadata storage unavailable");
        return unavailable();
      }
    }
    return unavailable();
  },
} satisfies ExportedHandler<ApiEnvironment>;
