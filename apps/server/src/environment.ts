import type { AutomationEvent } from "@fadeloop/contracts/events";
import type { WorkerEnvironment } from "@fadeloop/worker-common/environment";

export interface ServerEnvironment extends WorkerEnvironment {
  // Static Assets binding (Cloudflare Workers Static Assets)
  ASSETS?: Fetcher;

  // D1 Database
  DB?: D1Database;

  // Cloudflare Queues
  INCOMING_EVENTS_QUEUE?: Queue<AutomationEvent>;

  // Rate Limiting
  LOGIN_RATE_LIMITER?: RateLimit;

  // Trusted Frontend Origins (comma-separated or single)
  APP_ORIGIN?: string;

  // Supabase Auth
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  OWNER_SUPABASE_USER_ID?: string;

  // Meta App Credentials
  META_APP_ID?: string;
  META_APP_SECRET?: string;
  META_REDIRECT_URI?: string;
  META_WEBHOOK_VERIFY_TOKEN?: string;
  META_WEBHOOK_SIGNING_SECRET?: string;

  // Token Vault
  TOKEN_ENCRYPTION_KEY?: string;
}
