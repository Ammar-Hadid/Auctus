-- Showcase identities never receive an account_access or credential row.
CREATE TABLE showcase_visitor (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX showcase_expiry ON showcase_visitor(expires_at);
