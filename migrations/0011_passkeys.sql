CREATE TABLE passkey (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 public_key BLOB NOT NULL,
 counter INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX passkey_user ON passkey(user_id);
CREATE TABLE passkey_challenge (
 session_id TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,
 challenge TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('register','authenticate')),
 expires_at INTEGER NOT NULL
);
CREATE TABLE session_verification (
 session_id TEXT PRIMARY KEY REFERENCES session(id) ON DELETE CASCADE,
 verified_at INTEGER NOT NULL
);
