CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE owner_sessions (
  digest TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
) WITHOUT ROWID;
CREATE INDEX idx_owner_sessions_expiry ON owner_sessions(expires_at);
CREATE INDEX idx_owner_sessions_workspace ON owner_sessions(workspace_id);

CREATE TABLE oauth_states (
  digest TEXT PRIMARY KEY,
  session_digest TEXT NOT NULL REFERENCES owner_sessions(digest) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
) WITHOUT ROWID;
CREATE INDEX idx_oauth_states_expiry ON oauth_states(expires_at);
CREATE INDEX idx_oauth_states_session ON oauth_states(session_digest);

CREATE TABLE instagram_accounts (
  account_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  generation TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected')),
  token_ciphertext TEXT,
  token_expires_at INTEGER,
  updated_at INTEGER NOT NULL,
  CHECK (status != 'connected' OR (token_ciphertext IS NOT NULL AND token_expires_at IS NOT NULL))
) WITHOUT ROWID;
CREATE INDEX idx_instagram_accounts_workspace ON instagram_accounts(workspace_id, account_id);
CREATE INDEX idx_instagram_accounts_due_token ON instagram_accounts(token_expires_at) WHERE status = 'connected';
