-- FadeLoop V2: Migration 0002 - Campaigns, Revisions, and Delivery Records
-- Enforces:
-- 1. Workspace tenancy and cascade deletion
-- 2. At most ONE published campaign per (account_id, media_id)
-- 3. Exactly ONE delivery claim per (account_id, comment_id) for idempotent private replies
-- 4. Bounded indexed lookups for dashboard history and active campaign lookup

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES instagram_accounts(account_id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('published', 'paused')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id, updated_at DESC);
-- Enforce strictly ONE published campaign per Instagram post/reel per account:
CREATE UNIQUE INDEX idx_campaigns_published_media ON campaigns(account_id, media_id) WHERE status = 'published';

CREATE TABLE campaign_revisions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  match_mode TEXT NOT NULL CHECK (match_mode IN ('exact_keyword', 'any_comment')),
  keywords_json TEXT NOT NULL, -- JSON array of normalized lowercase keyword strings
  reply_template TEXT NOT NULL, -- Private reply text template
  resource_url TEXT, -- Optional resource/coupon link
  created_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX idx_campaign_revisions_campaign ON campaign_revisions(campaign_id, created_at DESC);

-- Delivery claims guarantee idempotent private-reply execution before contacting Meta.
CREATE TABLE delivery_claims (
  action_key TEXT PRIMARY KEY, -- deterministic hash or composite: "account_id:comment_id"
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  comment_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  revision_id TEXT NOT NULL REFERENCES campaign_revisions(id) ON DELETE CASCADE,
  claimed_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE UNIQUE INDEX idx_delivery_claims_comment ON delivery_claims(account_id, comment_id);
CREATE INDEX idx_delivery_claims_workspace ON delivery_claims(workspace_id, claimed_at DESC);

-- Delivery attempts record final and transient outcomes for auditing, debugging, and DLQ tracking.
CREATE TABLE delivery_outcomes (
  id TEXT PRIMARY KEY,
  action_key TEXT NOT NULL REFERENCES delivery_claims(action_key) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'retryable', 'failed', 'unknown')),
  provider_message_id TEXT,
  error_code TEXT,
  attempt_count INTEGER NOT NULL CHECK (attempt_count >= 1),
  occurred_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX idx_delivery_outcomes_workspace ON delivery_outcomes(workspace_id, occurred_at DESC);
CREATE INDEX idx_delivery_outcomes_action ON delivery_outcomes(action_key, occurred_at DESC);
